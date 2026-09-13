import {
  OTConnectionConfig,
  UserRole,
  ConnectionDiagnostics,
  TenantEnterprise,
  OperationalMode,
  OperationalStatus,
  TenantPhysicalEvidence,
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

// ============================================================================
// TENANT OPERATIONAL DOMAIN LOGIC (FASE 1: TENANT COMO RAÍZ OPERACIONAL)
// ============================================================================

/**
 * Resuelve el modo operacional del tenant, garantizando retrocompatibilidad
 * con el campo legacy `runtimeMode`.
 */
export function resolveTenantOperationalMode(tenant: TenantEnterprise): OperationalMode {
  if (tenant.operationalMode) {
    return tenant.operationalMode;
  }
  if (tenant.runtimeMode) {
    switch (tenant.runtimeMode) {
      case "LIVE_OT":
        return "LIVE";
      case "HYBRID":
        return "HYBRID";
      case "SIMULATION":
      case "HISTORICAL_REPLAY":
      default:
        return "SIMULATED";
    }
  }
  return "SIMULATED";
}

/**
 * Resuelve el estado operacional del tenant, garantizando retrocompatibilidad
 * con el campo legacy `otStatus`.
 */
export function resolveTenantOperationalStatus(tenant: TenantEnterprise): OperationalStatus {
  if (tenant.operationalStatus) {
    return tenant.operationalStatus;
  }
  if (tenant.otStatus) {
    switch (tenant.otStatus) {
      case "CONNECTED":
        return "CONNECTED";
      case "WAITING_FOR_COMMISSIONING":
        return "CONFIGURED";
      case "DISCONNECTED":
        return "OFFLINE";
      case "ERROR":
        return "DEGRADED";
      case "RECONNECTING":
        return "COMMISSIONING";
      default:
        return "DRAFT";
    }
  }
  return "DRAFT";
}

/**
 * Determina si un tenant reúne las condiciones verificables para alcanzar el estado OPERATIONAL.
 * Regla de Oro: Configurado ≠ Conectado ≠ Recibiendo ≠ Validado ≠ Operacional.
 */
export function canTransitionToOperational(
  tenant: TenantEnterprise,
  evidence?: TenantPhysicalEvidence
): { allowed: boolean; reason?: string } {
  const mode = resolveTenantOperationalMode(tenant);

  // 1. Reglas para modo LIVE
  if (mode === "LIVE") {
    if (!evidence) {
      return {
        allowed: false,
        reason:
          "Bloqueo operacional: Un tenant en modo LIVE requiere evidencia física verificable (Edge Gateway, tags activos y telemetría validada) para declararse OPERATIONAL.",
      };
    }
    if (!evidence.hasActiveGateway) {
      return {
        allowed: false,
        reason:
          "Bloqueo operacional: No se detecta ningún Edge Gateway activo o autenticado para este tenant LIVE.",
      };
    }
    if (!evidence.activeTagsReceivingCount || evidence.activeTagsReceivingCount <= 0) {
      return {
        allowed: false,
        reason:
          "Bloqueo operacional: El tenant LIVE no tiene ningún tag industrial recibiendo telemetría física en tiempo real.",
      };
    }
    if (evidence.isSimulatedDataOnly) {
      return {
        allowed: false,
        reason:
          "Violación de procedencia: Un tenant en modo LIVE no puede declararse OPERATIONAL utilizando datos exclusivamente simulados.",
      };
    }
    if (!evidence.lastValidatedDataTimestamp) {
      return {
        allowed: false,
        reason:
          "Bloqueo operacional: No existe registro de telemetría física validada por el Quality Gate para este tenant LIVE.",
      };
    }
    if (evidence.dataQualityPassRate < 90) {
      return {
        allowed: false,
        reason: `Bloqueo operacional: La tasa de calidad de datos física (${evidence.dataQualityPassRate}%) no alcanza el umbral mínimo de operación (90%).`,
      };
    }
    return { allowed: true };
  }

  // 2. Reglas para modo SIMULATED
  if (mode === "SIMULATED") {
    // Un tenant puramente simulado no puede alegar telemetría OT real para entrar en OPERATIONAL
    if (evidence && !evidence.isSimulatedDataOnly && evidence.hasActiveGateway) {
      return {
        allowed: false,
        reason:
          "Violación de procedencia: Un tenant en modo SIMULATED no puede declararse OPERATIONAL alegando evidencia física OT inexistente o ajena.",
      };
    }
    // Si opera como gemelo digital simulado validado:
    return { allowed: true };
  }

  // 3. Reglas para modo HYBRID
  if (mode === "HYBRID") {
    if (!tenant.subsystemsMode || Object.keys(tenant.subsystemsMode).length === 0) {
      return {
        allowed: false,
        reason:
          "Bloqueo operacional: Un tenant en modo HYBRID debe definir explícitamente la matriz de submodos (subsystemsMode).",
      };
    }

    const hasRealSubsystems = Object.values(tenant.subsystemsMode).some((m) => m === "REAL");
    if (hasRealSubsystems) {
      if (!evidence || !evidence.hasActiveGateway || evidence.activeTagsReceivingCount <= 0) {
        return {
          allowed: false,
          reason:
            "Bloqueo operacional: El tenant HYBRID posee subsistemas declarados como REAL pero no presenta evidencia de enlace ni recepción de telemetría física.",
        };
      }
      if (evidence.isSimulatedDataOnly) {
        return {
          allowed: false,
          reason:
            "Violación de procedencia: El tenant HYBRID posee subsistemas declarados como REAL pero la telemetría reportada es exclusivamente simulada.",
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Valida de forma determinística la máquina de estados de transición operacional del Tenant.
 */
export function validateTenantOperationalTransition(
  currentStatus: OperationalStatus,
  targetStatus: OperationalStatus,
  tenant: TenantEnterprise,
  evidence?: TenantPhysicalEvidence
): { allowed: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  const validTransitions: Record<OperationalStatus, OperationalStatus[]> = {
    DRAFT: ["CONFIGURED", "SUSPENDED"],
    CONFIGURED: ["COMMISSIONING", "DRAFT", "SUSPENDED"],
    COMMISSIONING: ["CONNECTED", "CONFIGURED", "DEGRADED", "OFFLINE", "SUSPENDED"],
    CONNECTED: ["VALIDATED", "COMMISSIONING", "DEGRADED", "OFFLINE", "SUSPENDED"],
    VALIDATED: ["OPERATIONAL", "CONNECTED", "DEGRADED", "OFFLINE", "SUSPENDED"],
    OPERATIONAL: ["DEGRADED", "OFFLINE", "SUSPENDED", "COMMISSIONING"],
    DEGRADED: ["OPERATIONAL", "OFFLINE", "VALIDATED", "COMMISSIONING", "SUSPENDED"],
    OFFLINE: ["CONNECTED", "COMMISSIONING", "DEGRADED", "SUSPENDED"],
    SUSPENDED: ["DRAFT", "CONFIGURED", "COMMISSIONING", "OFFLINE"],
  };

  const allowedTargets = validTransitions[currentStatus] || [];
  if (!allowedTargets.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Transición de estado operacional inválida: No es posible pasar de '${currentStatus}' a '${targetStatus}'. Estados válidos: [${allowedTargets.join(", ")}].`,
    };
  }

  // Verificación estricta de precondiciones al aspirar a OPERATIONAL
  if (targetStatus === "OPERATIONAL") {
    return canTransitionToOperational(tenant, evidence);
  }

  return { allowed: true };
}
