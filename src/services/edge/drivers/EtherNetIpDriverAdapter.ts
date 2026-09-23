/**
 * BioAzúcar 4.0 — Rockwell Allen-Bradley EtherNet/IP (CIP) Driver Adapter
 * 
 * Canonical implementation of IIndustrialDriver for Rockwell Allen-Bradley ControlLogix,
 * CompactLogix, and Micro800 PLCs communicating over EtherNet/IP (CIP - Common Industrial Protocol)
 * on TCP/UDP port 44818.
 * 
 * Integrated Architecture:
 * - Capa 1: CipBinaryCodec (24-byte Encapsulation Header, CPF, EPATH 0x91, Little-Endian IEEE 754)
 * - Capa 2: CipClientSession (Stateful transaction management, 8-byte context matching, explicit messaging)
 * - Capa 3: ITransportLayer (TcpSocketTransport over port 44818 or LoopbackVirtualTransport)
 * - Capa 4: EtherNetIpDriverAdapter (Contract IIndustrialDriver, 17-field IndustrialDataPoint, Fail-Closed)
 */

import {
  IIndustrialDriver,
  DriverConfig,
  DriverStatus,
  DriverHealth,
  DriverDiagnostics,
  DriverError,
  TagSubscriptionOptions,
  TagSubscriptionCallback,
  TagSubscriptionHandle,
} from "./IIndustrialDriver";
import { IndustrialProtocol, IndustrialDataPoint } from "../../../types";
import {
  getRuntimeProfile,
  assertValidProductionEnvironment,
} from "../config/runtimeProfile";
import { ITransportLayer } from "../transport/ITransportLayer";
import { TcpSocketTransport } from "../transport/TcpSocketTransport";
import { LoopbackVirtualTransport } from "../transport/LoopbackVirtualTransport";
import {
  CipStandardDataType,
  EipCommand,
  CpfTypeId,
  CipServiceCode,
  CipGeneralStatus,
  CipDataTypeCode,
  getCipDataTypeCode,
  getCipDataTypeName,
} from "../cip/CipTypes";
import { CipBinaryCodec } from "../cip/CipBinaryCodec";
import { CipClientSession } from "../cip/CipClientSession";

export type CipDataType = CipStandardDataType;

export interface CipTagDefinition {
  tagName: string;
  dataType: CipDataType;
  value: number | boolean | string;
  unit?: string;
  description?: string;
}

export class EtherNetIpDriverAdapter implements IIndustrialDriver {
  readonly id: string;
  readonly protocol: IndustrialProtocol = "ETHERNET_IP";
  readonly config: DriverConfig;

  private _status: DriverStatus = "DISCONNECTED";
  private connectedSince: string | null = null;
  private lastHeartbeat: string | null = null;
  private lastError: DriverError | null = null;

  private readSuccessCount = 0;
  private readErrorCount = 0;
  private writeSuccessCount = 0;
  private writeErrorCount = 0;
  private txPackets = 0;
  private rxPackets = 0;
  private avgLatencyMs = 7;

  private transport: ITransportLayer;
  private session: CipClientSession;

  private subscriptions = new Map<
    string,
    {
      handleId: string;
      tag: string;
      options: TagSubscriptionOptions;
      callback: TagSubscriptionCallback;
      intervalTimer?: any;
    }
  >();

  // Symbolic tag database (ControlLogix native tags for sugar milling and cogeneration)
  private tagDatabase = new Map<string, CipTagDefinition>([
    [
      "Boiler_1_Main_Steam_Pressure",
      { tagName: "Boiler_1_Main_Steam_Pressure", dataType: "REAL", value: 64.2, unit: "bar" },
    ],
    [
      "Boiler_1_Feedwater_Drum_Level",
      { tagName: "Boiler_1_Feedwater_Drum_Level", dataType: "REAL", value: 52.8, unit: "%" },
    ],
    [
      "Tandem_1_Main_Drive_Speed",
      { tagName: "Tandem_1_Main_Drive_Speed", dataType: "REAL", value: 4.85, unit: "RPM" },
    ],
    [
      "Turbine_1_Governor_Setpoint",
      { tagName: "Turbine_1_Governor_Setpoint", dataType: "REAL", value: 18.0, unit: "MW" },
    ],
    [
      "Bagasse_Feeder_Running",
      { tagName: "Bagasse_Feeder_Running", dataType: "BOOL", value: true, unit: "" },
    ],
    [
      "Cane_Carrier_Speed_Pct",
      { tagName: "Cane_Carrier_Speed_Pct", dataType: "REAL", value: 75.0, unit: "%" },
    ],
  ]);

  constructor(config: DriverConfig, transport?: ITransportLayer) {
    this.id = config.id;
    this.config = config;

    const profile = getRuntimeProfile();
    if (profile === "PRODUCTION") {
      assertValidProductionEnvironment({
        driverId: this.id,
        driverType: "PLC",
        isSimulated: config.isSimulatedFallback === true || config.customParameters?.isSimulated === true,
        isSimulatedFallback: config.isSimulatedFallback === true,
        isMock: config.isMock === true || config.customParameters?.isMock === true,
        protocol: "ETHERNET_IP",
        endpoint: config.endpoint,
      });
    }

    if (transport) {
      this.transport = transport;
    } else {
      const endpoint = config.endpoint || "127.0.0.1:44818";
      const parts = endpoint.split(":");
      const host = parts[0] || "127.0.0.1";
      const port = parts[1] ? parseInt(parts[1], 10) : 44818;

      if (profile === "PRODUCTION") {
        this.transport = new TcpSocketTransport(`tcp-${this.id}`, { host, port });
      } else {
        const loopback = new LoopbackVirtualTransport(`loopback-${this.id}`, { host, port });
        loopback.setLoopbackResponder(this.createVirtualCipResponder());
        this.transport = loopback;
      }
    }

    if (this.transport instanceof LoopbackVirtualTransport && !this.transport.hasCustomResponder()) {
      this.transport.setLoopbackResponder(this.createVirtualCipResponder());
    }

    this.session = new CipClientSession(this.transport, config.timeoutMs || 3000);

    this.transport.onStateChange((_oldState, newState) => {
      if (newState === "FAULTED") {
        this._status = "FAULTED";
      } else if (newState === "RECONNECTING") {
        this._status = "CONNECTING";
      } else if (newState === "DISCONNECTED") {
        this._status = "DISCONNECTED";
      }
    });
  }

  get status(): DriverStatus {
    return this._status;
  }

  public getSessionHandle(): number {
    return this.session.activeSessionHandle;
  }

  public getSession(): CipClientSession {
    return this.session;
  }

  /**
   * Virtual ControlLogix CIP responder for automated loopback verification.
   */
  private createVirtualCipResponder(): (req: Uint8Array) => Uint8Array | null {
    return (req: Uint8Array): Uint8Array | null => {
      try {
        const decoded = CipBinaryCodec.decodeEncapsulationPacket(req);
        if (!decoded.valid) return null;

        const header = decoded.header;

        // 1. RegisterSession (0x0065)
        if (header.command === EipCommand.REGISTER_SESSION) {
          const sessionHandle = 0x5a1e0001;
          return CipBinaryCodec.buildRegisterSessionResponse(sessionHandle, header.senderContext);
        }

        // 2. UnRegisterSession (0x0066)
        if (header.command === EipCommand.UNREGISTER_SESSION) {
          return null;
        }

        // 3. SendRRData (0x006F)
        if (header.command === EipCommand.SEND_RR_DATA) {
          const cpf = CipBinaryCodec.decodeCpfPacket(decoded.payload);
          const dataItem = cpf.items.find((it) => it.typeId === CpfTypeId.UNCONNECTED_DATA);
          if (!dataItem) return null;

          const cipReq = dataItem.data;
          const service = cipReq[0];

          // Read Tag Service (0x4C)
          if (service === CipServiceCode.READ_TAG) {
            const tagName = this.extractTagFromCipPath(cipReq);
            let entry = this.tagDatabase.get(tagName);

            if (!entry) {
              // Respond with 0x05 (Path Destination Unknown)
              const errResp = new Uint8Array([CipServiceCode.READ_TAG | 0x80, 0x00, CipGeneralStatus.PATH_DESTINATION_UNKNOWN, 0x00]);
              return CipBinaryCodec.buildSendRRDataResponse(header.sessionHandle, errResp, header.senderContext);
            }

            const dataTypeCode = getCipDataTypeCode(entry.dataType);
            const valBytes = CipBinaryCodec.encodeValueToBytes(entry.value, entry.dataType);

            // Read Tag Response: Service (0xCC), Reserved (0x00), Status (0x00), ExtStatus (0x00), TypeCode (2 bytes), Value
            const resp = new Uint8Array(4 + 2 + valBytes.length);
            resp[0] = CipServiceCode.READ_TAG | 0x80;
            resp[1] = 0x00;
            resp[2] = CipGeneralStatus.SUCCESS;
            resp[3] = 0x00;
            const view = new DataView(resp.buffer);
            view.setUint16(4, dataTypeCode, true);
            resp.set(valBytes, 6);

            return CipBinaryCodec.buildSendRRDataResponse(header.sessionHandle, resp, header.senderContext);
          }

          // Write Tag Service (0x4D)
          if (service === CipServiceCode.WRITE_TAG) {
            const tagName = this.extractTagFromCipPath(cipReq);
            const pathWords = cipReq[1];
            const offset = 2 + pathWords * 2;
            const view = new DataView(cipReq.buffer, cipReq.byteOffset, cipReq.byteLength);
            const dataTypeCode = view.getUint16(offset, true);
            const valBytes = cipReq.subarray(offset + 4);

            const decodedVal = CipBinaryCodec.decodeByType(dataTypeCode, valBytes);
            const typeName = getCipDataTypeName(dataTypeCode);

            let entry = this.tagDatabase.get(tagName);
            if (!entry) {
              entry = {
                tagName,
                dataType: typeName,
                value: decodedVal,
                unit: this.resolveUnit(tagName),
              };
              this.tagDatabase.set(tagName, entry);
            } else {
              entry.value = decodedVal;
            }

            // Write Tag Response: Service (0xCD), Reserved (0x00), Status (0x00), ExtStatus (0x00)
            const resp = new Uint8Array([CipServiceCode.WRITE_TAG | 0x80, 0x00, CipGeneralStatus.SUCCESS, 0x00]);
            return CipBinaryCodec.buildSendRRDataResponse(header.sessionHandle, resp, header.senderContext);
          }
        }

        return null;
      } catch {
        return null;
      }
    };
  }

  private extractTagFromCipPath(cipReq: Uint8Array): string {
    const pathWords = cipReq[1];
    const pathBytes = cipReq.subarray(2, 2 + pathWords * 2);
    if (pathBytes.length < 2) return "";

    let tag = "";
    let offset = 0;
    while (offset < pathBytes.length) {
      const segType = pathBytes[offset];
      if (segType === 0x91) {
        // ANSI Extended Symbol Segment
        const len = pathBytes[offset + 1];
        const strBytes = pathBytes.subarray(offset + 2, offset + 2 + len);
        const segName = new TextDecoder().decode(strBytes);
        tag = tag ? `${tag}.${segName}` : segName;
        offset += 2 + len + (len % 2 !== 0 ? 1 : 0);
      } else if (segType === 0x28) {
        // 8-bit array index
        const idx = pathBytes[offset + 1];
        tag += `[${idx}]`;
        offset += 2;
      } else {
        break;
      }
    }

    return tag;
  }

  public async connect(): Promise<boolean> {
    this._status = "CONNECTING";
    this.txPackets++;

    try {
      if (!this.config.endpoint) {
        throw new Error("Missing EtherNet/IP endpoint configuration");
      }

      const port = this.config.endpoint.includes(":")
        ? parseInt(this.config.endpoint.split(":")[1], 10)
        : 44818;

      if (port <= 0 || port > 65535) {
        throw new Error(`Invalid EtherNet/IP port: ${port}`);
      }

      await this.session.connect();

      this._status = "AUTHENTICATED";
      this.connectedSince = new Date().toISOString();
      this.lastHeartbeat = this.connectedSince;
      this.rxPackets++;
      this.lastError = null;
      return true;
    } catch (err: any) {
      this._status = "FAULTED";
      this.lastError = {
        code: "CIP_SESSION_FAILED",
        message: err.message || "Failed to register CIP session on port 44818",
        timestamp: new Date().toISOString(),
        underlyingError: err,
      };
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      if (sub.intervalTimer) clearInterval(sub.intervalTimer);
    }
    this.subscriptions.clear();

    await this.session.disconnect("EtherNetIpDriverAdapter disconnect");

    this._status = "DISCONNECTED";
    this.connectedSince = null;
  }

  public async readTag(tag: string): Promise<IndustrialDataPoint> {
    if (this._status !== "AUTHENTICATED" && this._status !== "CONNECTED") {
      this.readErrorCount++;
      throw new Error(`Cannot read CIP tag '${tag}': Driver '${this.id}' is ${this._status}`);
    }

    const t0 = Date.now();
    this.txPackets++;

    const profile = getRuntimeProfile();
    const isSimulated = profile === "PRODUCTION" ? false : (this.config.isSimulatedFallback ?? true);

    let val: number | boolean | string | null = null;
    let detectedType: CipStandardDataType = "REAL";

    if (this.session && this.session.isConnected) {
      try {
        const res = await this.session.readTag(tag);
        val = res.value;
        detectedType = res.dataType;
      } catch (err: any) {
        if (profile === "PRODUCTION") {
          this.readErrorCount++;
          throw err;
        }
        const entry = this.tagDatabase.get(tag);
        if (!entry) {
          this.readErrorCount++;
          throw new Error(`CIP tag '${tag}' not mapped on device '${this.id}'`);
        }
        val = entry.value;
        detectedType = entry.dataType;
      }
    } else {
      if (profile === "PRODUCTION") {
        this.readErrorCount++;
        throw new Error(`CIP session not connected to PLC '${this.id}' in PRODUCTION profile.`);
      }
      const entry = this.tagDatabase.get(tag);
      if (!entry) {
        this.readErrorCount++;
        throw new Error(`CIP tag '${tag}' not mapped on device '${this.id}'`);
      }
      val = entry.value;
      detectedType = entry.dataType;
    }

    const numericValue = typeof val === "boolean" ? (val ? 1 : 0) : (typeof val === "number" ? val : Number(val));
    const unit = this.resolveUnit(tag);

    const latency = Math.max(1, Date.now() - t0 + (profile === "PRODUCTION" ? 2 : Math.floor(Math.random() * 3)));
    this.avgLatencyMs = Number(((this.avgLatencyMs * 0.9) + (latency * 0.1)).toFixed(2));
    this.readSuccessCount++;
    this.rxPackets++;
    const nowIso = new Date().toISOString();
    this.lastHeartbeat = nowIso;

    const dataPoint: IndustrialDataPoint = {
      runtimeMode: profile,
      sourceType: isSimulated ? "SIMULATOR" : "PLC",
      sourceId: this.config.sourceId || this.id,
      driverId: this.id,
      protocol: "ETHERNET_IP",
      deviceId: this.id,
      assetId: this.config.assetId || tag.split(".")[0] || "ASSET-DEFAULT",
      tagId: tag,
      value: numericValue,
      engineeringUnit: unit,
      dataType: detectedType === "BOOL" ? "BOOLEAN" : "FLOAT32",
      deviceTimestamp: nowIso,
      ingestionTimestamp: nowIso,
      sequence: this.readSuccessCount,
      quality: "GOOD",
      qualityReason: "NORMAL",
      calibrationState: "CALIBRATED",
      schemaVersion: "4.0.0",

      // Legacy fields
      id: `dp-cip-${Date.now()}-${this.readSuccessCount}`,
      tag,
      rawValue: numericValue,
      engValue: numericValue,
      unit,
      source: isSimulated ? "SIMULATION" : "ETHERNET_IP",
      isSimulated,
      provenance: isSimulated ? "SIMULATED_PROCESS_MODEL" : "PHYSICAL_OT",
    };

    return Object.freeze(dataPoint);
  }

  public async writeTag(
    tag: string,
    value: number | string | boolean,
    clearanceLevel?: number,
    justification?: string
  ): Promise<boolean> {
    if (this.config.readOnly) {
      this.writeErrorCount++;
      throw new Error(`Write denied: Driver '${this.id}' operates in strict READ_ONLY mode.`);
    }

    if ((clearanceLevel ?? 0) < 2) {
      this.writeErrorCount++;
      throw new Error(`Write denied: Insufficient clearance level (${clearanceLevel ?? 0} < required 2).`);
    }

    if (!justification || justification.trim().length < 5) {
      this.writeErrorCount++;
      throw new Error(`Write denied: Operational justification mandatory for CIP tag write.`);
    }

    this.txPackets++;

    if (this.session && this.session.isConnected) {
      await this.session.writeTag(tag, value);
    }

    let entry = this.tagDatabase.get(tag);
    if (!entry) {
      entry = {
        tagName: tag,
        dataType: typeof value === "boolean" ? "BOOL" : "REAL",
        value,
        unit: this.resolveUnit(tag),
      };
      this.tagDatabase.set(tag, entry);
    } else {
      entry.value = value;
    }

    this.writeSuccessCount++;
    this.rxPackets++;
    this.lastHeartbeat = new Date().toISOString();
    return true;
  }

  public async subscribe(
    tag: string,
    options: TagSubscriptionOptions,
    callback: TagSubscriptionCallback
  ): Promise<TagSubscriptionHandle> {
    const handleId = `sub-cip-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const intervalMs = Math.max(100, options.samplingIntervalMs || 1000);

    const timer = setInterval(async () => {
      if (this._status === "AUTHENTICATED" || this._status === "CONNECTED") {
        try {
          const pt = await this.readTag(tag);
          callback(pt);
        } catch {
          // Handled via diagnostics
        }
      }
    }, intervalMs);

    this.subscriptions.set(handleId, {
      handleId,
      tag,
      options,
      callback,
      intervalTimer: timer,
    });

    return {
      id: handleId,
      tag,
      driverId: this.id,
      active: true,
      unsubscribe: async () => {
        clearInterval(timer);
        this.subscriptions.delete(handleId);
      },
    };
  }

  public getHealth(): DriverHealth {
    const now = Date.now();
    const uptime = this.connectedSince ? now - new Date(this.connectedSince).getTime() : 0;

    return {
      driverId: this.id,
      protocol: this.protocol,
      status: this._status,
      uptimeMs: uptime,
      connectedSince: this.connectedSince,
      lastHeartbeat: this.lastHeartbeat,
      activeSubscriptionsCount: this.subscriptions.size,
      readSuccessCount: this.readSuccessCount,
      readErrorCount: this.readErrorCount,
      writeSuccessCount: this.writeSuccessCount,
      writeErrorCount: this.writeErrorCount,
      avgLatencyMs: this.avgLatencyMs,
      lastError: this.lastError,
      isPhysical: !(this.config.isSimulatedFallback ?? true),
    };
  }

  public getDiagnostics(): DriverDiagnostics {
    return {
      driverId: this.id,
      protocol: this.protocol,
      endpoint: this.config.endpoint,
      securityMode: this.config.securityProfile?.securityMode || "None",
      txPackets: this.txPackets,
      rxPackets: this.rxPackets,
      bufferOccupancyPercent: Math.min(100, this.subscriptions.size * 5),
      lastError: this.lastError,
      details: {
        sessionHandle: this.session.activeSessionHandle,
        tagDatabaseSize: this.tagDatabase.size,
        readOnly: this.config.readOnly ?? false,
      },
    };
  }

  public async checkHealth(): Promise<DriverHealth> {
    return this.getHealth();
  }

  private resolveUnit(tag: string): string {
    const lower = tag.toLowerCase();
    if (lower.includes("pressure") || lower.includes("bar")) return "bar";
    if (lower.includes("speed") || lower.includes("rpm")) return "RPM";
    if (lower.includes("level") || lower.includes("pct")) return "%";
    if (lower.includes("mw") || lower.includes("power")) return "MW";
    if (lower.includes("flow") || lower.includes("m3h")) return "m³/h";
    return "";
  }
}
