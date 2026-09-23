/**
 * BioAzúcar 4.0 — Siemens S7 PLC Driver Adapter
 * 
 * Canonical implementation of IIndustrialDriver for Siemens S7-300, S7-400, S7-1200,
 * and S7-1500 PLCs communicating over ISO-on-TCP (RFC 1006 / COTP TP0) on TCP port 102.
 * 
 * Integrated Architecture:
 * - Capa 1: S7BinaryCodec (TPKT, COTP CR/CC/DT, S7 Comm PDU, IEEE 754 Big-Endian)
 * - Capa 2: S7ClientSession (Stateful transaction management, PDU reference, Setup Comm)
 * - Capa 3: ITransportLayer (TcpSocketTransport over port 102 or LoopbackVirtualTransport)
 * - Capa 4: SiemensS7DriverAdapter (Contract IIndustrialDriver, 17-field IndustrialDataPoint, Fail-Closed)
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
  S7ParsedAddress,
  S7AreaType,
  parseS7Address,
  S7FunctionCode,
  S7Rosctr,
  S7ReturnCode,
  CotpPduType,
  S7TransportSize,
  S7DataTransportSize,
} from "../s7/S7Types";
import { S7ClientSession } from "../s7/S7ClientSession";
import { S7BinaryCodec } from "../s7/S7BinaryCodec";

export type { S7AreaType, S7ParsedAddress };

export class SiemensS7DriverAdapter implements IIndustrialDriver {
  readonly id: string;
  readonly protocol: IndustrialProtocol = "SIEMENS_S7";
  readonly config: DriverConfig;

  private _status: DriverStatus = "DISCONNECTED";
  private connectedSince: string | null = null;
  private lastHeartbeat: string | null = null;
  private lastError: DriverError | null = null;

  private rack: number = 0;
  private slot: number = 1;

  private readSuccessCount = 0;
  private readErrorCount = 0;
  private writeSuccessCount = 0;
  private writeErrorCount = 0;
  private txPackets = 0;
  private rxPackets = 0;
  private avgLatencyMs = 9;

  private transport: ITransportLayer | null = null;
  private session: S7ClientSession | null = null;

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

  // S7 Memory cache representing sugar plant boiler and cogeneration automation
  private memoryMap = new Map<string, number>([
    ["DB1.DBD0", 64.5],   // Boiler 1 Main Steam Pressure (bar)
    ["DB1.DBD4", 515.0],  // Boiler 1 Main Steam Temp (°C)
    ["DB1.DBD8", 98.2],   // Boiler 1 Feedwater Flow (t/h)
    ["DB2.DBD0", 18.4],   // Turbine 1 Active Power (MW)
    ["DB2.DBD4", 59.98],  // Turbine 1 Generator Frequency (Hz)
    ["DB3.DBW0", 1150],   // Sugar Centrifugal #1 Speed (RPM)
    ["IW0", 4096],        // Raw analog input
    ["QW0", 2048],        // Raw analog output
    ["MW10", 100],        // Flag word
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
        protocol: "SIEMENS_S7",
        endpoint: config.endpoint,
      });
    }

    this.rack = config.customParameters?.rack ?? 0;
    this.slot = config.customParameters?.slot ?? (config.endpoint?.includes("s7-1200") ? 1 : 2);

    if (transport) {
      this.transport = transport;
    } else {
      const endpoint = config.endpoint || "127.0.0.1:102";
      const parts = endpoint.split(":");
      const host = parts[0] || "127.0.0.1";
      const port = parts[1] ? parseInt(parts[1], 10) : 102;

      if (profile === "PRODUCTION") {
        this.transport = new TcpSocketTransport(`tcp-${this.id}`, { host, port });
      } else {
        // In SIMULATION / DEVELOPMENT, default to LoopbackVirtualTransport with automated S7 PLC responder
        const loopback = new LoopbackVirtualTransport(`loopback-${this.id}`, { host, port });
        loopback.setLoopbackResponder(this.createVirtualS7Responder());
        this.transport = loopback;
      }
    }

    if (this.transport instanceof LoopbackVirtualTransport && !this.transport.hasCustomResponder()) {
      this.transport.setLoopbackResponder(this.createVirtualS7Responder());
    }

    this.session = new S7ClientSession(
      this.transport,
      {
        rack: this.rack,
        slot: this.slot,
        connectionType: config.customParameters?.connectionType ?? 0x03,
      },
      config.timeoutMs || 3000
    );

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

  public getRack(): number {
    return this.rack;
  }

  public getSlot(): number {
    return this.slot;
  }

  public getSession(): S7ClientSession | null {
    return this.session;
  }

  /**
   * Static address parser for backwards-compatibility.
   */
  public static parseS7Address(rawAddress: string): S7ParsedAddress {
    return parseS7Address(rawAddress);
  }

  /**
   * Builds an automated virtual S7 PLC responder for loopback testing.
   */
  private createVirtualS7Responder(): (req: Uint8Array) => Uint8Array | null {
    return (req: Uint8Array): Uint8Array | null => {
      try {
        const decodedTpkt = S7BinaryCodec.decodeTpktFrame(req);
        if (!decodedTpkt.valid) return null;

        const cotp = S7BinaryCodec.decodeCotp(decodedTpkt.payload);

        // 1. COTP Connection Request -> Connection Confirm
        if (cotp.pduType === CotpPduType.CR) {
          return S7BinaryCodec.buildCotpConnectionConfirm(0x0001, 0x0001);
        }

        // 2. COTP Data Transfer -> S7 Comm
        if (cotp.pduType === CotpPduType.DT) {
          const s7Pdu = cotp.userData;
          if (s7Pdu.length < 10) return null;

          const decodedHeader = S7BinaryCodec.decodeS7Pdu(s7Pdu);
          const pduRef = decodedHeader.pduReference;
          const param = decodedHeader.paramData;
          if (param.length === 0) return null;

          const fc = param[0];

          // Setup Communication
          if (fc === S7FunctionCode.SETUP_COMM) {
            const ackPdu = S7BinaryCodec.buildSetupCommunicationAck(pduRef, 8, 8, 480);
            return S7BinaryCodec.buildCotpDataFrame(ackPdu);
          }

          // Read Variable
          if (fc === S7FunctionCode.READ_VAR) {
            const itemCount = param[1];
            let paramOffset = 2;
            let dataTotalLength = 0;
            const itemsData: Array<{ returnCode: number; transportSize: number; lengthBits: number; data: Uint8Array }> = [];

            for (let i = 0; i < itemCount; i++) {
              if (paramOffset + 12 > param.length) break;
              const transportSize = param[paramOffset + 3];
              const dbNumber = (param[paramOffset + 6] << 8) | param[paramOffset + 7];
              const area = param[paramOffset + 8];
              const bitAddr = (param[paramOffset + 9] << 16) | (param[paramOffset + 10] << 8) | param[paramOffset + 11];
              const byteOffset = Math.floor(bitAddr / 8);
              const bitOffset = bitAddr % 8;

              // Synthesize key
              let key = `DB${dbNumber}.DBD${byteOffset}`;
              if (transportSize === S7TransportSize.BIT) key = `DB${dbNumber}.DBX${byteOffset}.${bitOffset}`;
              else if (transportSize === S7TransportSize.WORD) key = `DB${dbNumber}.DBW${byteOffset}`;
              else if (transportSize === S7TransportSize.BYTE) key = `DB${dbNumber}.DBB${byteOffset}`;

              let val = this.memoryMap.get(key);
              if (val === undefined) {
                // Check generalized key or default
                val = this.memoryMap.get(`DB1.DBD${byteOffset}`) ?? 50.0;
              }

              const encoded = S7BinaryCodec.encodeValueToBytes(
                val,
                transportSize === S7TransportSize.BIT ? "BOOL" : (transportSize === S7TransportSize.REAL ? "REAL" : "WORD"),
                bitOffset
              );

              const isBit = transportSize === S7TransportSize.BIT;
              const s7DataTs = isBit ? S7DataTransportSize.BIT : S7DataTransportSize.BYTE_WORD_DWORD;
              const lenBits = isBit ? 1 : encoded.length * 8;

              itemsData.push({
                returnCode: S7ReturnCode.SUCCESS,
                transportSize: s7DataTs,
                lengthBits: lenBits,
                data: encoded,
              });

              dataTotalLength += 4 + encoded.length + (encoded.length % 2 !== 0 ? 1 : 0);
              paramOffset += 12;
            }

            // Build Ack_Data PDU
            // Header: 12 bytes + Param: 2 bytes + Data
            const respPdu = new Uint8Array(12 + 2 + dataTotalLength);
            const view = new DataView(respPdu.buffer);

            // S7 Ack_Data Header
            respPdu[0] = 0x32;
            respPdu[1] = S7Rosctr.ACK_DATA;
            view.setUint16(2, 0x0000, false);
            view.setUint16(4, pduRef, false);
            view.setUint16(6, 0x0002, false); // Param length (2 bytes: FC + ItemCount)
            view.setUint16(8, dataTotalLength, false);
            respPdu[10] = 0x00; // Error Class
            respPdu[11] = 0x00; // Error Code

            // Param
            respPdu[12] = S7FunctionCode.READ_VAR;
            respPdu[13] = itemsData.length;

            // Data
            let dOffset = 14;
            for (const item of itemsData) {
              respPdu[dOffset] = item.returnCode;
              respPdu[dOffset + 1] = item.transportSize;
              view.setUint16(dOffset + 2, item.lengthBits, false);
              respPdu.set(item.data, dOffset + 4);
              dOffset += 4 + item.data.length;
              if (item.data.length % 2 !== 0) {
                respPdu[dOffset] = 0x00;
                dOffset += 1;
              }
            }

            return S7BinaryCodec.buildCotpDataFrame(respPdu);
          }

          // Write Variable
          if (fc === S7FunctionCode.WRITE_VAR) {
            const itemCount = param[1];
            const dataSec = decodedHeader.data;
            let dOffset = 0;
            let pOffset = 2;

            for (let i = 0; i < itemCount; i++) {
              if (pOffset + 12 > param.length || dOffset + 4 > dataSec.length) break;
              const transportSize = param[pOffset + 3];
              const dbNumber = (param[pOffset + 6] << 8) | param[pOffset + 7];
              const bitAddr = (param[pOffset + 9] << 16) | (param[pOffset + 10] << 8) | param[pOffset + 11];
              const byteOffset = Math.floor(bitAddr / 8);
              const bitOffset = bitAddr % 8;

              const lenBits = (dataSec[dOffset + 2] << 8) | dataSec[dOffset + 3];
              const byteCount = transportSize === S7TransportSize.BIT ? 1 : Math.floor(lenBits / 8);
              const rawData = dataSec.subarray(dOffset + 4, dOffset + 4 + byteCount);

              const decodedVal = S7BinaryCodec.decodeBytesToValue(
                rawData,
                transportSize === S7TransportSize.BIT ? "BOOL" : (transportSize === S7TransportSize.REAL ? "REAL" : "WORD"),
                bitOffset
              );

              let key = `DB${dbNumber}.DBD${byteOffset}`;
              if (transportSize === S7TransportSize.BIT) key = `DB${dbNumber}.DBX${byteOffset}.${bitOffset}`;
              else if (transportSize === S7TransportSize.WORD) key = `DB${dbNumber}.DBW${byteOffset}`;

              const numVal = typeof decodedVal === "boolean" ? (decodedVal ? 1 : 0) : decodedVal;
              this.memoryMap.set(key, numVal);

              dOffset += 4 + byteCount + (byteCount % 2 !== 0 ? 1 : 0);
              pOffset += 12;
            }

            // Build Write Var Ack_Data
            const respPdu = new Uint8Array(12 + 2 + itemCount);
            const view = new DataView(respPdu.buffer);
            respPdu[0] = 0x32;
            respPdu[1] = S7Rosctr.ACK_DATA;
            view.setUint16(2, 0x0000, false);
            view.setUint16(4, pduRef, false);
            view.setUint16(6, 0x0002, false);
            view.setUint16(8, itemCount, false);
            respPdu[10] = 0x00;
            respPdu[11] = 0x00;

            respPdu[12] = S7FunctionCode.WRITE_VAR;
            respPdu[13] = itemCount;
            for (let i = 0; i < itemCount; i++) {
              respPdu[14 + i] = S7ReturnCode.SUCCESS;
            }

            return S7BinaryCodec.buildCotpDataFrame(respPdu);
          }
        }

        return null;
      } catch {
        return null;
      }
    };
  }

  public async connect(): Promise<boolean> {
    this._status = "CONNECTING";
    this.txPackets++;

    try {
      if (!this.config.endpoint) {
        throw new Error("Missing Siemens S7 endpoint configuration (expected IP:port or IP)");
      }

      const port = this.config.endpoint.includes(":")
        ? parseInt(this.config.endpoint.split(":")[1], 10)
        : 102;

      if (port <= 0 || port > 65535) {
        throw new Error(`Invalid ISO-on-TCP port: ${port}`);
      }

      if (!this.session) {
        throw new Error("S7 Client Session is uninitialized");
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
        code: "S7_COMMUNICATION_ERROR",
        message: err.message || "Failed to establish ISO-on-TCP COTP connection to S7 PLC",
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

    if (this.session) {
      await this.session.disconnect("SiemensS7DriverAdapter disconnect");
    }

    this._status = "DISCONNECTED";
    this.connectedSince = null;
  }

  public resolveAddress(tag: string): string {
    const dbMatch = tag.match(/DB\d+\.DB[XBWDbxwd]\d+(?:\.\d+)?/i);
    if (dbMatch) {
      return dbMatch[0].toUpperCase();
    }
    const offsetMatch = tag.match(/DB([XBWDbxwd])(\d+)(?:\.(\d+))?/i);
    if (offsetMatch) {
      return `DB1.DB${offsetMatch[1].toUpperCase()}${offsetMatch[2]}${offsetMatch[3] ? `.${offsetMatch[3]}` : ""}`;
    }
    return tag;
  }

  public async readTag(tag: string): Promise<IndustrialDataPoint> {
    if (this._status !== "AUTHENTICATED" && this._status !== "CONNECTED") {
      this.readErrorCount++;
      throw new Error(`Cannot read S7 tag '${tag}': Driver '${this.id}' is ${this._status}`);
    }

    const t0 = Date.now();
    this.txPackets++;

    const profile = getRuntimeProfile();
    const isSimulated = profile === "PRODUCTION" ? false : (this.config.isSimulatedFallback ?? true);
    const resolvedAddress = this.resolveAddress(tag);

    let val: number | boolean | null = null;

    if (this.session && this.session.isConnected) {
      try {
        val = await this.session.readTag(resolvedAddress);
      } catch (err: any) {
        if (profile === "PRODUCTION") {
          this.readErrorCount++;
          throw err;
        }
        // Fallback to memory map in non-production
        val = this.memoryMap.get(resolvedAddress) ?? this.memoryMap.get(tag) ?? 50.0;
      }
    } else {
      if (profile === "PRODUCTION") {
        this.readErrorCount++;
        throw new Error(`S7 session not connected to PLC '${this.id}' in PRODUCTION profile.`);
      }
      val = this.memoryMap.get(resolvedAddress) ?? this.memoryMap.get(tag) ?? 50.0;
    }

    const numericValue = typeof val === "boolean" ? (val ? 1 : 0) : val;
    this.memoryMap.set(resolvedAddress, numericValue);
    this.memoryMap.set(tag, numericValue);

    const latency = Math.max(1, Date.now() - t0 + (profile === "PRODUCTION" ? 2 : Math.floor(Math.random() * 4)));
    this.avgLatencyMs = Number(((this.avgLatencyMs * 0.9) + (latency * 0.1)).toFixed(2));
    this.readSuccessCount++;
    this.rxPackets++;
    const nowIso = new Date().toISOString();
    this.lastHeartbeat = nowIso;

    const unit = this.resolveUnit(tag);

    const dataPoint: IndustrialDataPoint = {
      runtimeMode: profile,
      sourceType: isSimulated ? "SIMULATOR" : "PLC",
      sourceId: this.config.sourceId || this.id,
      driverId: this.id,
      protocol: "SIEMENS_S7",
      deviceId: this.id,
      assetId: this.config.assetId || tag.split(".")[0] || "ASSET-DEFAULT",
      tagId: tag,
      value: numericValue,
      engineeringUnit: unit,
      dataType: typeof val === "boolean" ? "BOOLEAN" : "FLOAT32",
      deviceTimestamp: nowIso,
      ingestionTimestamp: nowIso,
      sequence: this.readSuccessCount,
      quality: "GOOD",
      qualityReason: "NORMAL",
      calibrationState: "CALIBRATED",
      schemaVersion: "4.0.0",

      // Compatibility fields
      id: `dp-s7-${Date.now()}-${this.readSuccessCount}`,
      tag,
      rawValue: numericValue,
      engValue: numericValue,
      unit,
      source: isSimulated ? "SIMULATION" : "SIEMENS_S7",
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
      throw new Error(`Write denied: Operational justification mandatory for S7 PLC write.`);
    }

    const resolvedAddress = this.resolveAddress(tag);
    try {
      parseS7Address(resolvedAddress);
    } catch (err: any) {
      this.writeErrorCount++;
      throw new Error(`S7 Write Error: Invalid tag address '${tag}' (${err.message})`);
    }

    const numVal = typeof value === "boolean" ? value : (typeof value === "number" ? value : Number(value));
    if (typeof value !== "boolean" && isNaN(numVal as number)) {
      this.writeErrorCount++;
      throw new Error(`S7 write failed: Non-numeric value '${value}'`);
    }

    this.txPackets++;

    if (this.session && this.session.isConnected) {
      await this.session.writeTag(resolvedAddress, numVal);
    }

    const numericStore = typeof numVal === "boolean" ? (numVal ? 1 : 0) : numVal;
    this.memoryMap.set(resolvedAddress, numericStore);
    this.memoryMap.set(tag, numericStore);

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
    const handleId = `sub-s7-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
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
        rack: this.rack,
        slot: this.slot,
        memoryMapSize: this.memoryMap.size,
        readOnly: this.config.readOnly ?? false,
        negotiatedPduLength: this.session?.pduLength ?? 480,
      },
    };
  }

  public async checkHealth(): Promise<DriverHealth> {
    return this.getHealth();
  }

  private resolveUnit(tag: string): string {
    const lower = tag.toLowerCase();
    if (lower.includes("press") || lower.includes("dbd0")) return "bar";
    if (lower.includes("temp") || lower.includes("dbd4")) return "°C";
    if (lower.includes("flow") || lower.includes("dbd8")) return "t/h";
    if (lower.includes("mw")) return "MW";
    if (lower.includes("hz")) return "Hz";
    if (lower.includes("rpm") || lower.includes("dbw0")) return "RPM";
    return "";
  }
}
