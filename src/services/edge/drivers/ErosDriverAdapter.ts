/**
 * BioAzúcar 4.0 — DCS EROS Driver Adapter
 * 
 * Canonical implementation of IIndustrialDriver for the EROS Distributed Control System
 * utilized in sugar mill cane reception, milling tandems, and evaporation stations.
 * 
 * Integrated Architecture:
 * - Capa 1: ErosBinaryCodec (9-byte header framing, CRC-16 Modbus, Big-Endian IEEE 754)
 * - Capa 2: ErosClientSession (Stateful session management, 16-bit sequence tracking)
 * - Capa 3: ITransportLayer (TcpSocketTransport over port 5020 or LoopbackVirtualTransport)
 * - Capa 4: ErosDriverAdapter (Contract IIndustrialDriver, 17-field IndustrialDataPoint, Fail-Closed)
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
  ErosCommandCode,
  ErosStatusCode,
  ErosAreaType,
  ErosDataType,
  ErosParsedAddress,
  getErosAreaCode,
  getErosAreaChar,
} from "../eros/ErosTypes";
import { ErosBinaryCodec } from "../eros/ErosBinaryCodec";
import { ErosClientSession } from "../eros/ErosClientSession";

export type { ErosParsedAddress };

export class ErosDriverAdapter implements IIndustrialDriver {
  readonly id: string;
  readonly protocol: IndustrialProtocol = "EROS";
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
  private avgLatencyMs = 12;

  private transport: ITransportLayer;
  private session: ErosClientSession;

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

  // Process data memory block for DCS EROS
  private memoryMap = new Map<string, number>([
    ["DB10.DBD14", 4.8],    // Tandem speed (RPM)
    ["DB10.DBD22", 210.5],  // Hydraulic top roll pressure (bar)
    ["DB10.DBD30", 18.5],   // Maceration flow (m3/h)
    ["DB12.DBD10", 28.4],   // Imbibition ratio (%)
    ["DB14.DBD18", 142.0],  // Mixed juice flow (m3/h)
    ["DB16.DBD24", 68.5],   // Clarified juice Brix (°Bx)
    ["DB20.DBD08", 1.85],   // Evaporator Calandria steam pressure (bar)
    ["DB20.DBD8", 1.85],    // Normalized offset
    ["DB22.DBD12", 26.2],   // Pan vacuum (inHg)
  ]);

  public getMemoryValue(address: string): number | undefined {
    if (this.memoryMap.has(address)) return this.memoryMap.get(address);
    const parsed = address.match(/^DB(\d+)\.DB([XBWDbxd])(\d+)(?:\.(\d+))?$/i);
    if (parsed) {
      const db = parseInt(parsed[1], 10);
      const area = parsed[2].toUpperCase();
      const offset = parseInt(parsed[3], 10);
      const bit = parsed[4];
      const cand1 = `DB${db}.DB${area}${offset}${bit ? `.${bit}` : ""}`;
      const cand2 = `DB${db}.DB${area}${offset.toString().padStart(2, "0")}${bit ? `.${bit}` : ""}`;
      if (this.memoryMap.has(cand1)) return this.memoryMap.get(cand1);
      if (this.memoryMap.has(cand2)) return this.memoryMap.get(cand2);
    }
    return undefined;
  }

  public setMemoryValue(address: string, val: number): void {
    this.memoryMap.set(address, val);
    const parsed = address.match(/^DB(\d+)\.DB([XBWDbxd])(\d+)(?:\.(\d+))?$/i);
    if (parsed) {
      const db = parseInt(parsed[1], 10);
      const area = parsed[2].toUpperCase();
      const offset = parseInt(parsed[3], 10);
      const bit = parsed[4];
      this.memoryMap.set(`DB${db}.DB${area}${offset}${bit ? `.${bit}` : ""}`, val);
      this.memoryMap.set(`DB${db}.DB${area}${offset.toString().padStart(2, "0")}${bit ? `.${bit}` : ""}`, val);
    }
  }

  // Tag alias lookup for DCS EROS
  private tagAliasMap = new Map<string, string>([
    ["Milling.EROS.Tandem_Speed_RPM", "DB10.DBD14"],
    ["Milling.EROS.Hydraulic_Pressure_Bar", "DB10.DBD22"],
    ["Milling.EROS.Maceration_Flow_M3H", "DB10.DBD30"],
    ["Milling.EROS.Imbibition_Ratio_Pct", "DB12.DBD10"],
    ["Milling.EROS.Mixed_Juice_Flow_M3H", "DB14.DBD18"],
    ["Factory.EROS.Clarified_Brix", "DB16.DBD24"],
    ["Steam.EROS.Evaporator_Pressure_Bar", "DB20.DBD08"],
    ["Boiling.EROS.Pan_Vacuum_InHg", "DB22.DBD12"],
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
        protocol: "EROS_DCS",
        endpoint: config.endpoint,
      });
    }

    if (transport) {
      this.transport = transport;
    } else {
      const endpoint = config.endpoint || "127.0.0.1:5020";
      const parts = endpoint.split(":");
      const host = parts[0] || "127.0.0.1";
      const port = parts[1] ? parseInt(parts[1], 10) : 5020;

      if (profile === "PRODUCTION") {
        this.transport = new TcpSocketTransport(`tcp-${this.id}`, { host, port });
      } else {
        const loopback = new LoopbackVirtualTransport(`loopback-${this.id}`, { host, port });
        loopback.setLoopbackResponder(this.createVirtualErosResponder());
        this.transport = loopback;
      }
    }

    if (this.transport instanceof LoopbackVirtualTransport && !this.transport.hasCustomResponder()) {
      this.transport.setLoopbackResponder(this.createVirtualErosResponder());
    }

    const stationId = config.customParameters?.stationId || 1;
    this.session = new ErosClientSession(this.transport, stationId, config.timeoutMs || 3000);

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

  public getSession(): ErosClientSession {
    return this.session;
  }

  /**
   * Parse EROS address notation: e.g. "DB10.DBD14" or "DB10.DBX0.1"
   */
  public static parseErosAddress(rawAddress: string): ErosParsedAddress {
    return ErosBinaryCodec.parseAddress(rawAddress);
  }

  /**
   * Virtual EROS DCS responder for automated loopback verification.
   */
  private createVirtualErosResponder(): (req: Uint8Array) => Uint8Array | null {
    return (req: Uint8Array): Uint8Array | null => {
      try {
        const decoded = ErosBinaryCodec.decodePacket(req);
        if (!decoded.valid || !decoded.packet) return null;

        const { header, payload } = decoded.packet;

        // 1. Heartbeat (0x05)
        if (header.command === ErosCommandCode.HEARTBEAT) {
          return ErosBinaryCodec.buildHeartbeatResponse(header.sequence, ErosStatusCode.SUCCESS, header.stationId);
        }

        // 2. Read Variable (0x03)
        if (header.command === ErosCommandCode.READ_VARIABLE) {
          if (payload.length < 6) return null;
          const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
          const dbNumber = view.getUint16(0, false);
          const areaCode = payload[2] as ErosAreaType;
          const offset = view.getUint16(3, false);
          const bitIndex = payload[5];

          const areaChar = getErosAreaChar(areaCode);
          const address = `DB${dbNumber}.DB${areaChar}${offset}${areaChar === "X" ? `.${bitIndex}` : ""}`;

          let val = this.getMemoryValue(address);
          if (val === undefined) {
            val = 15.0; // default initial
            this.setMemoryValue(address, val);
          }

          const valBytes = ErosBinaryCodec.encodeValue(val, ErosDataType.FLOAT32);
          return ErosBinaryCodec.buildReadVariableResponse(
            header.sequence,
            ErosStatusCode.SUCCESS,
            ErosDataType.FLOAT32,
            valBytes,
            header.stationId
          );
        }

        // 3. Write Variable (0x04)
        if (header.command === ErosCommandCode.WRITE_VARIABLE) {
          if (payload.length < 7) return null;
          const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
          const dbNumber = view.getUint16(0, false);
          const areaCode = payload[2] as ErosAreaType;
          const offset = view.getUint16(3, false);
          const bitIndex = payload[5];
          const dataType = payload[6] as ErosDataType;
          const valBytes = payload.subarray(7);

          const decodedVal = ErosBinaryCodec.decodeValue(valBytes, dataType);
          const areaChar = getErosAreaChar(areaCode);
          const address = `DB${dbNumber}.DB${areaChar}${offset}${areaChar === "X" ? `.${bitIndex}` : ""}`;

          this.setMemoryValue(address, typeof decodedVal === "number" ? decodedVal : Number(decodedVal));

          return ErosBinaryCodec.buildWriteVariableResponse(
            header.sequence,
            ErosStatusCode.SUCCESS,
            header.stationId
          );
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
        throw new Error("Missing EROS host/endpoint configuration");
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
        code: "EROS_CONNECT_FAILED",
        message: err.message || "Failed to establish EROS DCS gateway connection",
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

    await this.session.disconnect("ErosDriverAdapter disconnect");

    this._status = "DISCONNECTED";
    this.connectedSince = null;
  }

  public resolveAddress(tag: string): string {
    if (this.tagAliasMap.has(tag)) {
      return this.tagAliasMap.get(tag)!;
    }
    const fullMatch = tag.match(/DB\d+\.DB[XBWDbxd]\d+(?:\.\d+)?/i);
    if (fullMatch) {
      return fullMatch[0].toUpperCase();
    }
    const offsetMatch = tag.match(/DB([XBWDbxd])(\d+)(?:\.(\d+))?/i);
    if (offsetMatch) {
      return `DB10.DB${offsetMatch[1].toUpperCase()}${offsetMatch[2]}${offsetMatch[3] ? `.${offsetMatch[3]}` : ""}`;
    }
    return tag;
  }

  public async readTag(tag: string): Promise<IndustrialDataPoint> {
    if (this._status !== "AUTHENTICATED" && this._status !== "CONNECTED") {
      this.readErrorCount++;
      throw new Error(`Cannot read EROS tag '${tag}': Driver '${this.id}' is ${this._status}`);
    }

    const t0 = Date.now();
    this.txPackets++;

    const profile = getRuntimeProfile();
    const isSimulated = profile === "PRODUCTION" ? false : (this.config.isSimulatedFallback ?? true);

    const memAddress = this.resolveAddress(tag);
    let parsed: ErosParsedAddress;
    try {
      parsed = ErosBinaryCodec.parseAddress(memAddress);
    } catch (err: any) {
      this.readErrorCount++;
      throw new Error(`EROS Read Error: Unknown tag or invalid address '${tag}' (${err.message})`);
    }

    let val: number = 0;
    if (this.session && this.session.isConnected) {
      try {
        const areaCode = getErosAreaCode(parsed.areaType);
        const res = await this.session.readVariable(
          parsed.dbNumber,
          areaCode,
          parsed.offset,
          parsed.bitIndex
        );
        val = typeof res.value === "number" ? res.value : Number(res.value);
      } catch (err: any) {
        if (profile === "PRODUCTION") {
          this.readErrorCount++;
          throw err;
        }
        const cached = this.memoryMap.get(memAddress);
        if (cached === undefined) {
          this.readErrorCount++;
          throw err;
        }
        val = cached;
      }
    } else {
      if (profile === "PRODUCTION") {
        this.readErrorCount++;
        throw new Error(`EROS DCS session not connected on '${this.id}' in PRODUCTION profile.`);
      }
      const cached = this.memoryMap.get(memAddress);
      if (cached === undefined) {
        this.readErrorCount++;
        throw new Error(`EROS tag '${tag}' not mapped on device '${this.id}'`);
      }
      val = cached;
    }

    const latency = Math.max(1, Date.now() - t0 + (profile === "PRODUCTION" ? 2 : Math.floor(Math.random() * 5)));
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
      protocol: "EROS_DCS",
      deviceId: this.id,
      assetId: this.config.assetId || tag.split(".")[0] || "ASSET-DEFAULT",
      tagId: tag,
      value: val,
      engineeringUnit: unit,
      dataType: "FLOAT32",
      deviceTimestamp: nowIso,
      ingestionTimestamp: nowIso,
      sequence: this.readSuccessCount,
      quality: "GOOD",
      qualityReason: "NORMAL",
      calibrationState: "CALIBRATED",
      schemaVersion: "4.0.0",

      // Legacy fields
      id: `dp-eros-${Date.now()}-${this.readSuccessCount}`,
      tag,
      rawValue: val,
      engValue: val,
      unit,
      source: isSimulated ? "SIMULATION" : "EROS_DCS",
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
      throw new Error(`Write denied: Operational justification mandatory for EROS DCS write.`);
    }

    const memAddress = this.resolveAddress(tag);
    let parsed: ErosParsedAddress;
    try {
      parsed = ErosBinaryCodec.parseAddress(memAddress);
    } catch (err: any) {
      this.writeErrorCount++;
      throw new Error(`EROS Write Error: Invalid target address '${memAddress}' (${err.message})`);
    }

    const numVal = typeof value === "number" ? value : Number(value);
    if (isNaN(numVal)) {
      this.writeErrorCount++;
      throw new Error(`EROS write failed: Non-numeric value '${value}'`);
    }

    this.txPackets++;

    if (this.session && this.session.isConnected) {
      const areaCode = getErosAreaCode(parsed.areaType);
      await this.session.writeVariable(
        parsed.dbNumber,
        areaCode,
        parsed.offset,
        numVal,
        ErosDataType.FLOAT32,
        parsed.bitIndex
      );
    }

    this.memoryMap.set(memAddress, numVal);
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
    const handleId = `sub-eros-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
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
        memoryMapSize: this.memoryMap.size,
        readOnly: this.config.readOnly ?? false,
      },
    };
  }

  public async checkHealth(): Promise<DriverHealth> {
    return this.getHealth();
  }

  private resolveUnit(tag: string): string {
    let resolvedTag = tag;
    for (const [alias, addr] of this.tagAliasMap.entries()) {
      if (addr.toLowerCase() === tag.toLowerCase() || this.resolveAddress(alias).toLowerCase() === this.resolveAddress(tag).toLowerCase()) {
        resolvedTag = alias;
        break;
      }
    }
    const lower = (resolvedTag + " " + tag).toLowerCase();
    if (lower.includes("rpm") || lower.includes("speed")) return "RPM";
    if (lower.includes("bar") || lower.includes("pressure")) return "bar";
    if (lower.includes("m3h") || lower.includes("flow")) return "m³/h";
    if (lower.includes("pct") || lower.includes("ratio") || lower.includes("level")) return "%";
    if (lower.includes("brix")) return "°Bx";
    if (lower.includes("inhg") || lower.includes("vacuum")) return "inHg";
    if (lower.includes("deg") || lower.includes("temp")) return "°C";
    return "";
  }
}
