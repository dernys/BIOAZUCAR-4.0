import {
  OTConnectionConfig,
  UserRole,
  ConnectionDiagnostics,
} from "../types";
import { logAuditEventToDb } from "./dbService";

export const INITIAL_OT_CONNECTIONS: OTConnectionConfig[] = [
  {
    id: "ot-opcua-kepserver",
    name: "KEPServerEX / DCS Bridge Central",
    type: "OPC_UA_SERVER",
    host: "192.168.10.50",
    port: 4840,
    protocol: "OPC-UA",
    security: "SIGN_ENCRYPT",
    timeoutMs: 3000,
    retryPolicy: "EXPONENTIAL_BACKOFF (3 retries)",
    heartbeatIntervalSec: 5,
    status: "SIMULATION",
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 12,
    activeTagsCount: 184,
    messageRateSec: 320,
    tenantId: "TENANT_AZUCAR_01",
    description: "Servidor OPC-UA centralizado para control de molinos tándem y calderas de vapor.",
    endpoints: ["opc.tcp://192.168.10.50:4840/BioAzucarServer"],
  },
  {
    id: "ot-mqtt-sparkplug",
    name: "EMQX Sparkplug B Enterprise Broker",
    type: "MQTT_BROKER",
    host: "mqtt.bioazucar.internal",
    port: 8883,
    protocol: "MQTT-SPARKPLUG",
    security: "TLS_1_3",
    timeoutMs: 2000,
    retryPolicy: "IMMEDIATE (keepalive 30s)",
    heartbeatIntervalSec: 2,
    status: "SIMULATION",
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 7,
    activeTagsCount: 298,
    messageRateSec: 850,
    tenantId: "TENANT_AZUCAR_01",
    description: "Broker MQTT principal para distribución UNS Sparkplug B (ISA-95 compliant).",
    endpoints: ["tls://mqtt.bioazucar.internal:8883"],
  },
  {
    id: "ot-modbus-moxa",
    name: "Moxa Gateway Básculas & Lab",
    type: "MODBUS_DEVICE",
    host: "192.168.20.15",
    port: 502,
    protocol: "MODBUS-TCP",
    security: "NONE",
    timeoutMs: 4000,
    retryPolicy: "LINEAR (5 retries)",
    heartbeatIntervalSec: 10,
    status: "SIMULATION",
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 24,
    activeTagsCount: 42,
    messageRateSec: 85,
    tenantId: "TENANT_AZUCAR_01",
    description: "Concentrador Modbus TCP para básculas de camiones de caña y analizadores de laboratorio.",
    endpoints: ["modbus://192.168.20.15:502"],
  },
  {
    id: "ot-eros-adapter",
    name: "Adaptador EROS Automation System",
    type: "EROS_ADAPTER",
    host: "192.168.15.100",
    port: 9000,
    protocol: "EROS-NATIVE",
    security: "BASIC_256_SHA256",
    timeoutMs: 5000,
    retryPolicy: "CUSTOM (EROS heartbeat sync)",
    heartbeatIntervalSec: 5,
    status: "SIMULATION",
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 18,
    activeTagsCount: 65,
    messageRateSec: 140,
    tenantId: "TENANT_AZUCAR_01",
    description: "Adaptador industrial de enlace con sistema de automatización de molienda EROS.",
    endpoints: ["eros://192.168.15.100:9000/TandemSync"],
  },
  {
    id: "ot-plc-siemens-s7",
    name: "Siemens S7-1500 PLC Calderas",
    type: "PLC",
    host: "192.168.10.12",
    port: 102,
    protocol: "OPC-UA",
    security: "SIGN_ENCRYPT",
    timeoutMs: 1500,
    retryPolicy: "FAST_FAILOVER",
    heartbeatIntervalSec: 1,
    status: "SIMULATION",
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 4,
    activeTagsCount: 120,
    messageRateSec: 500,
    tenantId: "TENANT_AZUCAR_01",
    description: "Controlador lógico programable de seguridad y combustión caldera bagazo 1.",
    endpoints: ["opc.tcp://192.168.10.12:4840"],
  },
];

export class OTInfrastructureService {
  private static instance: OTInfrastructureService;
  private connections: Map<string, OTConnectionConfig> = new Map();

  private constructor() {
    INITIAL_OT_CONNECTIONS.forEach((c) => this.connections.set(c.id, c));
  }

  public static getInstance(): OTInfrastructureService {
    if (!OTInfrastructureService.instance) {
      OTInfrastructureService.instance = new OTInfrastructureService();
    }
    return OTInfrastructureService.instance;
  }

  public async getConnections(tenantId?: string): Promise<OTConnectionConfig[]> {
    const all = Array.from(this.connections.values());
    if (!tenantId || tenantId === "GLOBAL" || tenantId === "ALL") {
      return all;
    }
    return all.filter((c) => !c.tenantId || c.tenantId === tenantId);
  }

  public async getConnectionById(id: string): Promise<OTConnectionConfig | null> {
    return this.connections.get(id) || null;
  }

  public async createConnection(
    conn: Omit<OTConnectionConfig, "id" | "lastHeartbeat" | "status">,
    user: { role: UserRole; name: string }
  ): Promise<OTConnectionConfig> {
    const id = `ot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newConn: OTConnectionConfig = {
      ...conn,
      id,
      status: "SIMULATION",
      lastHeartbeat: new Date().toISOString(),
    };

    this.connections.set(id, newConn);

    await logAuditEventToDb({
      timestamp: new Date().toISOString(),
      userRole: user.role,
      userName: user.name,
      action: "CREATE_OT_DEVICE",
      module: "OT_INFRASTRUCTURE",
      targetId: id,
      newValue: JSON.stringify({ name: newConn.name, host: newConn.host, type: newConn.type }),
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      tenantId: newConn.tenantId,
    });

    return newConn;
  }

  public async updateConnection(
    id: string,
    updates: Partial<OTConnectionConfig>,
    user: { role: UserRole; name: string }
  ): Promise<OTConnectionConfig | null> {
    const existing = this.connections.get(id);
    if (!existing) return null;

    const updated: OTConnectionConfig = {
      ...existing,
      ...updates,
      lastHeartbeat: new Date().toISOString(),
    };

    this.connections.set(id, updated);

    await logAuditEventToDb({
      timestamp: new Date().toISOString(),
      userRole: user.role,
      userName: user.name,
      action: "UPDATE_OT_DEVICE",
      module: "OT_INFRASTRUCTURE",
      targetId: id,
      previousValue: JSON.stringify({ name: existing.name, host: existing.host }),
      newValue: JSON.stringify(updates),
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      tenantId: updated.tenantId,
    });

    return updated;
  }

  public async testConnection(id: string): Promise<ConnectionDiagnostics> {
    const conn = this.connections.get(id);
    if (!conn) {
      return {
        connected: false,
        status: "OFFLINE",
        protocol: "SIMULATOR",
        source: "SIMULATION",
        lastPingMs: 0,
        packetsReceived: 0,
        packetsSent: 0,
        errorRatePercent: 100,
        uptimeSeconds: 0,
        serverTime: new Date().toISOString(),
      };
    }

    // In local sandbox environment
    return {
      connected: true,
      status: "SIMULATION",
      protocol: conn.protocol,
      source: "SIMULATION",
      lastPingMs: conn.latencyMs || 5,
      packetsReceived: conn.activeTagsCount * 12,
      packetsSent: conn.activeTagsCount * 12,
      errorRatePercent: 0,
      uptimeSeconds: 86400,
      serverTime: new Date().toISOString(),
    };
  }

  public async deleteConnection(
    id: string,
    user: { role: UserRole; name: string }
  ): Promise<boolean> {
    const existing = this.connections.get(id);
    if (!existing) return false;

    this.connections.delete(id);

    await logAuditEventToDb({
      timestamp: new Date().toISOString(),
      userRole: user.role,
      userName: user.name,
      action: "DELETE_OT_DEVICE",
      module: "OT_INFRASTRUCTURE",
      targetId: id,
      previousValue: JSON.stringify({ name: existing.name, host: existing.host }),
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      tenantId: existing.tenantId,
    });

    return true;
  }
}

export const otInfrastructureService = OTInfrastructureService.getInstance();
