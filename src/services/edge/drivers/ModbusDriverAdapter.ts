/**
 * BioAzúcar 4.0 — Modbus TCP / RTU Driver Adapter (Capa 1/2/3 Integrada)
 * 
 * Production-ready implementation of IIndustrialDriver for Modbus RTU / Modbus TCP communication.
 * Decoupled into Layer 3 Network Transport (ITransportLayer) and Layer 2 Protocol Codec (ModbusBinaryCodec),
 * supporting Modbus Security (Port 802 TLS), RBAC, Fail-Closed in PRODUCTION, and 17-field immutable DataPoints.
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
import { LoopbackVirtualTransport, PeerResponder } from "../transport/LoopbackVirtualTransport";
import {
  ModbusByteOrder,
  ModbusDataType,
  ModbusFunctionCode,
  parseModbusAddress,
} from "../modbus/ModbusTypes";
import { ModbusBinaryCodec } from "../modbus/ModbusBinaryCodec";
import { ModbusClientSession } from "../modbus/ModbusClientSession";

export type { ModbusByteOrder, ModbusDataType };

export type ModbusSecurityRole =
  | "Operator"
  | "Engineer"
  | "Administrator"
  | "SecurityAdmin";

export interface ModbusSecurityConfig {
  enabled: boolean;
  port?: number; // Default 802 as per Modbus Security Spec
  clientCertificateRef?: string;
  serverCertificateRef?: string;
  caCertificateRef?: string;
  tlsVersion?: "TLSv1.2" | "TLSv1.3";
  assignedRole?: ModbusSecurityRole;
  requireMutualAuth?: boolean;
}

export class ModbusDriverAdapter implements IIndustrialDriver {
  readonly id: string;
  readonly protocol: IndustrialProtocol = "MODBUS";
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
  private avgLatencyMs = 8;

  private modbusSecurity: ModbusSecurityConfig | null = null;
  private activeSecurityRole: ModbusSecurityRole = "Operator";

  private transport: ITransportLayer;
  private session: ModbusClientSession | null = null;

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

  // Virtual storage / diagnostics cache for registers and coils
  private registerMap = new Map<string, number>([
    ["40001", 1250], // Gross cane scale (t)
    ["40002", 645],  // Header pressure (0.1 bar -> 64.5 bar)
    ["40003", 520],  // Superheater temp (deg C)
    ["40004", 480],  // Generator frequency (0.1 Hz -> 48.0 Hz)
    ["0", 1250],
    ["1", 645],
    ["2", 520],
    ["3", 480],
  ]);

  private coilMap = new Map<string, boolean>([
    ["00001", true], // Emergency stop interlock coil (1 = OK, 0 = TRIPPED)
    ["0", true],
  ]);

  constructor(config: DriverConfig, customTransport?: ITransportLayer) {
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
        protocol: "MODBUS_TCP",
        endpoint: config.endpoint,
      });
    }

    // Detect and configure Modbus Security (spec 2018: Port 802 over TLS)
    const customSec = config.customParameters?.modbusSecurity as ModbusSecurityConfig | undefined;
    const isPort802 = config.endpoint?.includes(":802");
    if (customSec?.enabled || isPort802 || config.customParameters?.requireMutualAuth) {
      this.modbusSecurity = {
        enabled: true,
        port: customSec?.port || (isPort802 ? 802 : 802),
        clientCertificateRef:
          customSec?.clientCertificateRef ||
          (config.customParameters?.clientCert as string | undefined),
        serverCertificateRef:
          customSec?.serverCertificateRef ||
          (config.customParameters?.serverCert as string | undefined),
        caCertificateRef:
          customSec?.caCertificateRef ||
          (config.customParameters?.caCert as string | undefined),
        tlsVersion: customSec?.tlsVersion || "TLSv1.3",
        assignedRole:
          customSec?.assignedRole ||
          (config.customParameters?.securityRole as ModbusSecurityRole | undefined) ||
          "Operator",
        requireMutualAuth:
          customSec?.requireMutualAuth ??
          (config.customParameters?.requireMutualAuth !== false),
      };
      this.activeSecurityRole = this.modbusSecurity.assignedRole || "Operator";
    }

    // Initialize Layer 3 Transport
    if (customTransport) {
      this.transport = customTransport;
    } else if (config.endpoint) {
      let host = "localhost";
      let port = this.modbusSecurity?.enabled ? 802 : 502;

      if (config.endpoint.includes(":")) {
        const parts = config.endpoint.replace(/^(modbus\.tcp:\/\/|tcp:\/\/)/i, "").split(":");
        host = parts[0] || "localhost";
        port = parseInt(parts[1], 10) || port;
      } else {
        host = config.endpoint;
      }

      if (profile === "PRODUCTION") {
        this.transport = new TcpSocketTransport(`tcp-modbus-${this.id}`, {
          host,
          port,
          timeoutMs: config.timeoutMs || 3000,
          noDelay: true,
          keepAlive: true,
          tlsEnabled: this.modbusSecurity?.enabled ?? false,
          clientCertificatePem: this.modbusSecurity?.clientCertificateRef,
        });
      } else {
        // Virtual loopback with integrated binary slave responder
        const loopback = new LoopbackVirtualTransport(`virt-modbus-${this.id}`, {
          host,
          port,
        });
        loopback.setPeerResponder(this.createVirtualSlaveResponder());
        this.transport = loopback;
      }
    } else {
      const loopback = new LoopbackVirtualTransport(`virt-modbus-${this.id}`, {
        host: "localhost",
        port: 502,
      });
      loopback.setPeerResponder(this.createVirtualSlaveResponder());
      this.transport = loopback;
    }

    this.transport.onStateChange((oldState, newState) => {
      if (newState === "FAULTED") {
        this._status = "FAULTED";
      } else if (newState === "RECONNECTING") {
        this._status = "CONNECTING";
      }
    });
  }

  get status(): DriverStatus {
    return this._status;
  }

  public getTransport(): ITransportLayer {
    return this.transport;
  }

  public getSession(): ModbusClientSession | null {
    return this.session;
  }

  /**
   * Virtual Modbus Slave Responder for automated tests and dev harnesses.
   */
  private createVirtualSlaveResponder(): PeerResponder {
    return (req: Uint8Array): Uint8Array | null => {
      try {
        if (req.length < 8) return null;
        const view = new DataView(req.buffer, req.byteOffset, req.byteLength);
        const txId = view.getUint16(0, false);
        const unitId = req[6];
        const fc = req[7];

        if (fc === ModbusFunctionCode.READ_HOLDING_REGISTERS || fc === ModbusFunctionCode.READ_INPUT_REGISTERS) {
          const startAddr = view.getUint16(8, false);
          const qty = view.getUint16(10, false);
          const byteCount = qty * 2;
          const respPdu = new Uint8Array(2 + byteCount);
          respPdu[0] = fc;
          respPdu[1] = byteCount;
          const pduView = new DataView(respPdu.buffer, 2);

          for (let i = 0; i < qty; i++) {
            const addr = startAddr + i;
            const key5 = fc === ModbusFunctionCode.READ_HOLDING_REGISTERS ? `4000${addr + 1}` : `3000${addr + 1}`;
            const keyPure = String(addr);
            const val = this.registerMap.get(key5) ?? this.registerMap.get(keyPure) ?? 1000 + (addr % 50);
            pduView.setUint16(i * 2, val & 0xffff, false);
          }
          return ModbusBinaryCodec.buildTcpFrame(txId, unitId, respPdu);
        }

        if (fc === ModbusFunctionCode.WRITE_SINGLE_REGISTER) {
          const addr = view.getUint16(8, false);
          const val = view.getUint16(10, false);
          this.registerMap.set(`4000${addr + 1}`, val);
          this.registerMap.set(String(addr), val);
          return ModbusBinaryCodec.buildTcpFrame(txId, unitId, req.subarray(7));
        }

        if (fc === ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS) {
          const addr = view.getUint16(8, false);
          const qty = view.getUint16(10, false);
          const dataView = new DataView(req.buffer, req.byteOffset + 13);
          for (let i = 0; i < qty; i++) {
            const val = dataView.getUint16(i * 2, false);
            this.registerMap.set(`4000${addr + 1 + i}`, val);
            this.registerMap.set(String(addr + i), val);
          }
          const respPdu = new Uint8Array(5);
          respPdu[0] = fc;
          const rView = new DataView(respPdu.buffer);
          rView.setUint16(1, addr, false);
          rView.setUint16(3, qty, false);
          return ModbusBinaryCodec.buildTcpFrame(txId, unitId, respPdu);
        }

        if (fc === ModbusFunctionCode.WRITE_SINGLE_COIL) {
          const addr = view.getUint16(8, false);
          const val = view.getUint16(10, false);
          this.coilMap.set(`0000${addr + 1}`, val === 0xff00);
          this.coilMap.set(String(addr), val === 0xff00);
          return ModbusBinaryCodec.buildTcpFrame(txId, unitId, req.subarray(7));
        }

        if (fc === ModbusFunctionCode.READ_COILS || fc === ModbusFunctionCode.READ_DISCRETE_INPUTS) {
          const startAddr = view.getUint16(8, false);
          const qty = view.getUint16(10, false);
          const byteCount = Math.ceil(qty / 8);
          const respPdu = new Uint8Array(2 + byteCount);
          respPdu[0] = fc;
          respPdu[1] = byteCount;
          for (let i = 0; i < qty; i++) {
            const addr = startAddr + i;
            const key5 = fc === ModbusFunctionCode.READ_COILS ? `0000${addr + 1}` : `1000${addr + 1}`;
            const bit = this.coilMap.get(key5) ?? this.coilMap.get(String(addr)) ?? true;
            if (bit) {
              const byteIdx = Math.floor(i / 8);
              const bitIdx = i % 8;
              respPdu[2 + byteIdx] |= (1 << bitIdx);
            }
          }
          return ModbusBinaryCodec.buildTcpFrame(txId, unitId, respPdu);
        }

        return null;
      } catch {
        return null;
      }
    };
  }

  public isModbusSecurityActive(): boolean {
    return !!this.modbusSecurity?.enabled && (this._status === "AUTHENTICATED" || this._status === "CONNECTED");
  }

  public isSecurityEnabled(): boolean {
    return !!this.modbusSecurity?.enabled;
  }

  public getModbusSecurityConfig(): ModbusSecurityConfig | null {
    return this.modbusSecurity ? { ...this.modbusSecurity } : null;
  }

  public getSecurityConfig(): { tlsPort?: number; enabled?: boolean; requireMutualAuth?: boolean } | null {
    return this.modbusSecurity
      ? {
          tlsPort: this.modbusSecurity.port,
          enabled: this.modbusSecurity.enabled,
          requireMutualAuth: this.modbusSecurity.requireMutualAuth,
        }
      : null;
  }

  public getActiveSecurityRole(): ModbusSecurityRole {
    return this.activeSecurityRole;
  }

  public setSecurityRole(role: ModbusSecurityRole): void {
    this.activeSecurityRole = role;
    if (this.modbusSecurity) {
      this.modbusSecurity.assignedRole = role;
    }
  }

  /**
   * Computes standard Modbus RTU CRC-16 checksum (polynomial 0xA001).
   */
  public static calculateCRC16(buffer: Uint8Array): number {
    return ModbusBinaryCodec.calculateCRC16(buffer);
  }

  /**
   * Decodes raw 16-bit registers into a 32-bit float or integer respecting byte order.
   */
  public static decode32BitRegisters(
    reg0: number,
    reg1: number,
    dataType: "FLOAT32" | "INT32" | "UINT32",
    byteOrder: ModbusByteOrder = "ABCD"
  ): number {
    return ModbusBinaryCodec.decodeRegisters([reg0, reg1], dataType, byteOrder);
  }

  public async connect(): Promise<boolean> {
    try {
      this._status = "CONNECTING";

      if (this.modbusSecurity?.enabled) {
        if (this.modbusSecurity.requireMutualAuth && !this.modbusSecurity.clientCertificateRef) {
          throw new Error(`Modbus Security mTLS handshake failed: Missing client certificate reference for driver '${this.id}'`);
        }
      }

      // Connect physical/virtual transport
      const ok = await this.transport.connect();
      if (!ok) {
        throw new Error(`Underlying transport failed to connect`);
      }

      this.session = new ModbusClientSession(this.transport, {
        timeoutMs: this.config.timeoutMs || 3000,
      });

      this._status = "AUTHENTICATED";
      this.connectedSince = new Date().toISOString();
      this.lastHeartbeat = this.connectedSince;
      this.rxPackets++;
      this.lastError = null;
      return true;
    } catch (err: any) {
      this._status = "FAULTED";
      const isMtlsError = err.message?.includes("mTLS") || err.message?.includes("client certificate");
      this.lastError = {
        code: isMtlsError ? "MODBUS_SECURITY_MTLS_FAILED" : "HOST_UNREACHABLE",
        message: err.message || "Failed to establish Modbus connection",
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

    if (this.transport) {
      await this.transport.disconnect("ModbusDriverAdapter disconnect");
    }

    this.session = null;
    this._status = "DISCONNECTED";
    this.connectedSince = null;
  }

  public async readTag(tag: string): Promise<IndustrialDataPoint> {
    if (this._status !== "AUTHENTICATED" && this._status !== "CONNECTED") {
      this.readErrorCount++;
      throw new Error(`Cannot read Modbus register '${tag}': Driver '${this.id}' is ${this._status}`);
    }

    const t0 = Date.now();
    this.txPackets++;

    const profile = getRuntimeProfile();
    const isSimulated = profile === "PRODUCTION" ? false : (this.config.isSimulatedFallback ?? true);

    const parsed = parseModbusAddress(tag);
    let engValue = 0;
    let rawValue: any = null;

    if (parsed.isSymbolicTag) {
      const val = this.registerMap.get(tag);
      if (val !== undefined) {
        engValue = val;
        rawValue = val;
      } else {
        if (profile === "PRODUCTION") {
          this.readErrorCount++;
          throw new Error(`Modbus symbolic tag '${tag}' not mapped on device '${this.id}' in PRODUCTION.`);
        }
        const simVal = 1000 + Math.floor(Math.random() * 50);
        this.registerMap.set(tag, simVal);
        engValue = simVal;
        rawValue = simVal;
      }
    } else if (this.session && this.session.isConnected) {
      try {
        if (parsed.table === "HOLDING_REGISTER") {
          const regs = await this.session.readHoldingRegisters(parsed.unitId, parsed.address, parsed.wordCount);
          rawValue = regs;
          engValue = ModbusBinaryCodec.decodeRegisters(regs, parsed.dataType, parsed.byteOrder);
        } else if (parsed.table === "INPUT_REGISTER") {
          const regs = await this.session.readInputRegisters(parsed.unitId, parsed.address, parsed.wordCount);
          rawValue = regs;
          engValue = ModbusBinaryCodec.decodeRegisters(regs, parsed.dataType, parsed.byteOrder);
        } else if (parsed.table === "COIL") {
          const bits = await this.session.readCoils(parsed.unitId, parsed.address, 1);
          rawValue = bits;
          engValue = bits[0] ? 1 : 0;
        } else if (parsed.table === "DISCRETE_INPUT") {
          const bits = await this.session.readDiscreteInputs(parsed.unitId, parsed.address, 1);
          rawValue = bits;
          engValue = bits[0] ? 1 : 0;
        }
      } catch (err: any) {
        if (profile === "PRODUCTION") {
          this.readErrorCount++;
          throw err;
        }
        // Fallback to cache in non-production
        let regVal = this.registerMap.get(tag) ?? this.registerMap.get(String(parsed.address));
        if (regVal === undefined) {
          regVal = 1000 + Math.floor(Math.random() * 50);
          this.registerMap.set(tag, regVal);
        }
        engValue = regVal;
        rawValue = regVal;
      }
    } else {
      let regVal = this.registerMap.get(tag) ?? this.registerMap.get(String(parsed.address));
      if (regVal === undefined) {
        if (profile === "PRODUCTION") {
          this.readErrorCount++;
          throw new Error(`Modbus tag '${tag}' not mapped on device '${this.id}'. Random fallback prohibited in PRODUCTION.`);
        }
        regVal = 1000 + Math.floor(Math.random() * 50);
        this.registerMap.set(tag, regVal);
      }
      engValue = regVal;
      rawValue = regVal;
    }

    // Apply scale if defined in config
    const scale = this.config.customParameters?.scale ?? 1;
    engValue = Number((engValue * scale).toFixed(2));

    const latency = Math.max(1, Date.now() - t0 + (profile === "PRODUCTION" ? 2 : 1));
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
      protocol: "MODBUS_TCP",
      deviceId: this.id,
      assetId: this.config.assetId || tag.split(".")[0] || "ASSET-DEFAULT",
      tagId: tag,
      value: engValue,
      engineeringUnit: this.config.customParameters?.unit || "",
      dataType: parsed.dataType === "BOOL" ? "BOOLEAN" : parsed.dataType,
      deviceTimestamp: nowIso,
      ingestionTimestamp: nowIso,
      sequence: this.readSuccessCount,
      quality: "GOOD",
      qualityReason: "NORMAL",
      calibrationState: "CALIBRATED",
      schemaVersion: "4.0.0",

      // Compatibility fields
      id: `dp-modbus-${Date.now()}-${this.readSuccessCount}`,
      tag,
      rawValue: rawValue ?? engValue,
      engValue,
      unit: this.config.customParameters?.unit || "",
      scale,
      source: isSimulated ? "SIMULATION" : "MODBUS",
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
      throw new Error(`Write denied: Operational justification mandatory for register write.`);
    }

    // Enforce Modbus Security RBAC according to Modbus Security Spec 2018
    if (this.modbusSecurity?.enabled) {
      const isSecurityTag =
        tag.toUpperCase().includes("SECURITY") ||
        tag.toUpperCase().includes("CONFIG") ||
        tag.toUpperCase().includes("CERT") ||
        tag.toUpperCase().includes("POLICY");

      if (
        isSecurityTag &&
        this.activeSecurityRole !== "SecurityAdmin" &&
        this.activeSecurityRole !== "Administrator"
      ) {
        this.writeErrorCount++;
        throw new Error(
          `Modbus Security RBAC Violation: Role '${this.activeSecurityRole}' is not permitted to write security tag '${tag}'. Required: Administrator or SecurityAdmin.`
        );
      }

      // Check register level authorization for Operator role
      const regNum = parseInt(tag.replace(/\D/g, ""), 10);
      if (!isNaN(regNum) && regNum >= 49000 && this.activeSecurityRole === "Operator") {
        this.writeErrorCount++;
        throw new Error(
          `Modbus Security RBAC Violation: Role 'Operator' cannot write protected system register '${tag}'. Required: Engineer or Administrator.`
        );
      }
    }

    const numVal = typeof value === "number" ? value : Number(value);
    if (typeof value !== "boolean" && isNaN(numVal)) {
      this.writeErrorCount++;
      throw new Error(`Modbus write failed: Non-numeric value '${value}'`);
    }

    const parsed = parseModbusAddress(tag);
    this.txPackets++;

    if (parsed.isSymbolicTag) {
      this.registerMap.set(tag, numVal);
    } else if (this.session && this.session.isConnected) {
      if (parsed.table === "COIL") {
        await this.session.writeSingleCoil(parsed.unitId, parsed.address, Boolean(value));
        this.coilMap.set(tag, Boolean(value));
      } else {
        if (parsed.wordCount === 1) {
          await this.session.writeSingleRegister(parsed.unitId, parsed.address, numVal);
        } else {
          const regs = ModbusBinaryCodec.encodeToRegisters(numVal, parsed.dataType, parsed.byteOrder);
          await this.session.writeMultipleRegisters(parsed.unitId, parsed.address, regs);
        }
        this.registerMap.set(tag, numVal);
      }
    } else {
      this.registerMap.set(tag, numVal);
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
    const handleId = `sub-modbus-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const intervalMs = Math.max(100, options.samplingIntervalMs || 1000);

    const timer = setInterval(async () => {
      if (this._status === "AUTHENTICATED" || this._status === "CONNECTED") {
        try {
          const point = await this.readTag(tag);
          callback(point);
        } catch {
          // Handled silently
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
        const sub = this.subscriptions.get(handleId);
        if (sub && sub.intervalTimer) clearInterval(sub.intervalTimer);
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
      bufferOccupancyPercent: Math.min(100, (this.subscriptions.size * 5)),
      lastError: this.lastError,
      details: {
        registersCached: this.registerMap.size,
        readOnly: this.config.readOnly ?? false,
        transportState: this.transport?.state || "UNKNOWN",
        transportType: this.transport?.type || "UNKNOWN",
      },
    };
  }
}
