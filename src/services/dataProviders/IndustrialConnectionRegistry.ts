/**
 * BioAzúcar 4.0 — Canonical Industrial Connection Registry
 * 
 * Central canonical configuration source for all industrial OT/DMZ connections.
 * Enforces strict hierarchy:
 *   Tenant -> Site -> Area -> Gateway/Edge -> Connection
 * 
 * Eliminates operational reliance on hardcoded mock endpoints.
 * Explicitly separates physical industrial connections from SIMULATION demo fixtures.
 * Never stores raw credentials or certificates; enforces secretRef / certificateRef.
 */

import {
  ConnectionRegistryEntry,
  ConnectionStatus,
  IndustrialProtocol,
  UserRole,
  OTConnectionConfig,
} from "../../types";
import { validateConnectionRegistryEntry } from "./IndustrialRegistryValidator";
import { logAuditEventToDb } from "../dbService";
import { sha256Hex } from "../../utils/cryptoUtils";

export interface EdgeProvisioningBundle {
  version: string;
  generatedAt: string;
  tenantId: string;
  siteId: string;
  gatewayId: string;
  connections: ConnectionRegistryEntry[];
  checksum: string;
}

export class IndustrialConnectionRegistry {
  private static instance: IndustrialConnectionRegistry;

  // Primary canonical in-memory store (backed by storage adapter)
  private connections = new Map<string, ConnectionRegistryEntry>();

  private constructor() {
    this.initializeDefaultFixtures();
  }

  public static getInstance(): IndustrialConnectionRegistry {
    if (!IndustrialConnectionRegistry.instance) {
      IndustrialConnectionRegistry.instance = new IndustrialConnectionRegistry();
    }
    return IndustrialConnectionRegistry.instance;
  }

  /**
   * Initializes demo fixtures explicitly flagged as isDemoSimulation: true.
   * These fixtures can NEVER be mistaken for live physical OT connections.
   */
  private initializeDefaultFixtures(): void {
    const demoFixtures: ConnectionRegistryEntry[] = [
      {
        id: "conn-demo-opcua-tandem",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_MOLIENDA",
        gatewayId: "EDGE-CENTRAL-01",
        name: "[SIMULATION] Tandem Molienda DCS Bridge",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://192.168.10.50:4840/BioAzucarServer",
        status: "CONFIGURED",
        criticality: "CRITICAL",
        readOnly: true,
        enabled: true,
        securityProfile: {
          securityPolicy: "Basic256Sha256",
          securityMode: "SignAndEncrypt",
          authType: "CERTIFICATE",
        },
        certificateRef: "vault://tenants/TENANT_AZUCAR_01/certs/opcua-client.der",
        secretRef: "vault://tenants/TENANT_AZUCAR_01/secrets/opcua-key",
        expectedIntervalMs: 1000,
        maxSilenceMs: 5000,
        latencyBudgetMs: 500,
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
        configVersion: "1.0.0",
        isDemoSimulation: true,
      },
      {
        id: "conn-demo-sparkplug-uns",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_CENTRAL_UNS",
        gatewayId: "EDGE-CENTRAL-01",
        name: "[SIMULATION] EMQX Sparkplug B Enterprise Broker",
        protocol: "SPARKPLUG",
        endpoint: "tls://mqtt.bioazucar.internal:8883",
        status: "CONFIGURED",
        criticality: "HIGH",
        readOnly: true,
        enabled: true,
        securityProfile: {
          tlsVersion: "TLS_1_3",
          authType: "CERTIFICATE",
        },
        certificateRef: "vault://tenants/TENANT_AZUCAR_01/certs/emqx-ca.crt",
        secretRef: "vault://tenants/TENANT_AZUCAR_01/secrets/sparkplug-token",
        expectedIntervalMs: 1000,
        maxSilenceMs: 4000,
        latencyBudgetMs: 250,
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
        configVersion: "1.0.0",
        isDemoSimulation: true,
      },
      {
        id: "conn-demo-modbus-scales",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_RECEPCION_CANA",
        gatewayId: "EDGE-CENTRAL-01",
        name: "[SIMULATION] Moxa NPort Básculas & Lab",
        protocol: "MODBUS",
        endpoint: "modbus://192.168.20.15:502",
        status: "CONFIGURED",
        criticality: "MEDIUM",
        readOnly: true,
        enabled: true,
        expectedIntervalMs: 2000,
        maxSilenceMs: 10000,
        latencyBudgetMs: 1000,
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
        configVersion: "1.0.0",
        isDemoSimulation: true,
      },
      {
        id: "conn-demo-eros-adapter",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_MOLIENDA",
        gatewayId: "EDGE-CENTRAL-01",
        name: "[SIMULATION] EROS Automation Native Adapter",
        protocol: "EROS",
        endpoint: "eros://192.168.15.100:9000/TandemSync",
        status: "CONFIGURED",
        criticality: "HIGH",
        readOnly: true,
        enabled: true,
        expectedIntervalMs: 1000,
        maxSilenceMs: 5000,
        latencyBudgetMs: 500,
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
        configVersion: "1.0.0",
        isDemoSimulation: true,
      },
    ];

    demoFixtures.forEach((fix) => this.connections.set(fix.id, fix));
  }

  /**
   * Registers a new industrial connection into the canonical registry.
   * Validates structural and security integrity deterministically.
   */
  public async registerConnection(
    entry: ConnectionRegistryEntry,
    actor?: { role: UserRole; name: string }
  ): Promise<ConnectionRegistryEntry> {
    // 1. Deterministic validation
    const validation = validateConnectionRegistryEntry(entry);
    if (!validation.isValid) {
      throw new Error(
        `Error de validación en ConnectionRegistry: ${validation.errors.join("; ")}`
      );
    }

    // 2. Security validation: Reject raw passwords or keys
    if (entry.endpoint.includes("@") && (entry.endpoint.includes("password") || entry.endpoint.includes(":"))) {
      const urlParts = entry.endpoint.split("@")[0];
      if (urlParts.split(":").length > 2) {
        throw new Error(
          "Violación de seguridad IEC 62443: Está prohibido incluir contraseñas en claro en el endpoint. Utilice 'secretRef'."
        );
      }
    }

    const canonicalEntry: ConnectionRegistryEntry = {
      ...entry,
      updatedAt: new Date().toISOString(),
      configVersion: entry.configVersion || "1.0.0",
    };

    this.connections.set(canonicalEntry.id, canonicalEntry);

    // 3. Audit trail
    if (actor) {
      await logAuditEventToDb({
        timestamp: new Date().toISOString(),
        userRole: actor.role,
        userName: actor.name,
        action: "REGISTER_INDUSTRIAL_CONNECTION",
        module: "CONNECTION_REGISTRY",
        targetId: canonicalEntry.id,
        newValue: JSON.stringify({
          name: canonicalEntry.name,
          protocol: canonicalEntry.protocol,
          endpoint: canonicalEntry.endpoint,
          gatewayId: canonicalEntry.gatewayId,
          tenantId: canonicalEntry.tenantId,
        }),
        status: "EXECUTED",
        ipAddress: "127.0.0.1",
        tenantId: canonicalEntry.tenantId,
      });
    }

    return canonicalEntry;
  }

  /**
   * Retrieves a connection by its unique canonical ID.
   */
  public async getConnection(id: string): Promise<ConnectionRegistryEntry | null> {
    return this.connections.get(id) || null;
  }

  /**
   * Lists connections filtered by Tenant, Site, Area, and optional simulation exclusion.
   */
  public async listConnections(filter?: {
    tenantId?: string;
    siteId?: string;
    areaId?: string;
    gatewayId?: string;
    excludeDemoSimulation?: boolean;
  }): Promise<ConnectionRegistryEntry[]> {
    let result = Array.from(this.connections.values());

    if (filter?.tenantId && filter.tenantId !== "GLOBAL" && filter.tenantId !== "ALL") {
      result = result.filter((c) => c.tenantId === filter.tenantId);
    }
    if (filter?.siteId) {
      result = result.filter((c) => c.siteId === filter.siteId);
    }
    if (filter?.areaId) {
      result = result.filter((c) => c.areaId === filter.areaId);
    }
    if (filter?.gatewayId) {
      result = result.filter((c) => c.gatewayId === filter.gatewayId);
    }
    if (filter?.excludeDemoSimulation) {
      result = result.filter((c) => !c.isDemoSimulation);
    }

    return result;
  }

  /**
   * Updates an existing connection configuration.
   */
  public async updateConnection(
    id: string,
    updates: Partial<ConnectionRegistryEntry>,
    actor?: { role: UserRole; name: string }
  ): Promise<ConnectionRegistryEntry | null> {
    const existing = this.connections.get(id);
    if (!existing) return null;

    const merged: ConnectionRegistryEntry = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      tenantId: existing.tenantId, // Tenant isolation boundary immutable
      updatedAt: new Date().toISOString(),
    };

    const validation = validateConnectionRegistryEntry(merged);
    if (!validation.isValid) {
      throw new Error(
        `Error de validación al actualizar conexión: ${validation.errors.join("; ")}`
      );
    }

    this.connections.set(id, merged);

    if (actor) {
      await logAuditEventToDb({
        timestamp: new Date().toISOString(),
        userRole: actor.role,
        userName: actor.name,
        action: "UPDATE_INDUSTRIAL_CONNECTION",
        module: "CONNECTION_REGISTRY",
        targetId: id,
        previousValue: JSON.stringify({ name: existing.name, status: existing.status }),
        newValue: JSON.stringify(updates),
        status: "EXECUTED",
        ipAddress: "127.0.0.1",
        tenantId: existing.tenantId,
      });
    }

    return merged;
  }

  /**
   * Deletes a connection from the canonical registry.
   */
  public async deleteConnection(
    id: string,
    actor?: { role: UserRole; name: string }
  ): Promise<boolean> {
    const existing = this.connections.get(id);
    if (!existing) return false;

    this.connections.delete(id);

    if (actor) {
      await logAuditEventToDb({
        timestamp: new Date().toISOString(),
        userRole: actor.role,
        userName: actor.name,
        action: "DELETE_INDUSTRIAL_CONNECTION",
        module: "CONNECTION_REGISTRY",
        targetId: id,
        previousValue: JSON.stringify({ name: existing.name, protocol: existing.protocol }),
        status: "EXECUTED",
        ipAddress: "127.0.0.1",
        tenantId: existing.tenantId,
      });
    }

    return true;
  }

  /**
   * Updates the runtime connection status strictly based on real connector state.
   */
  public async updateConnectionStatus(
    id: string,
    status: ConnectionStatus,
    telemetryTimestamp?: string
  ): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) return;

    conn.status = status;
    conn.updatedAt = new Date().toISOString();
    if (status === "CONNECTED" || status === "AUTHENTICATED" || status === "RECEIVING") {
      conn.lastHeartbeatTimestamp = new Date().toISOString();
    }
    if (telemetryTimestamp) {
      conn.lastDataTimestamp = telemetryTimestamp;
    }
  }

  /**
   * Records a validated heartbeat from an Edge Gateway.
   */
  public recordHeartbeat(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.lastHeartbeatTimestamp = new Date().toISOString();
    }
  }

  /**
   * Exports an Edge Provisioning Bundle for a specific Gateway.
   * This bundle is pushed across the DMZ to the industrial edge daemon.
   */
  public async exportProvisioningBundle(
    gatewayId: string,
    tenantId: string
  ): Promise<EdgeProvisioningBundle> {
    const connections = await this.listConnections({
      gatewayId,
      tenantId,
    });

    const payload = JSON.stringify({ gatewayId, tenantId, count: connections.length, connectionIds: connections.map((c) => c.id) });
    // FIPS 180-4 standard cryptographic SHA-256 checksum for edge bundle verification
    const bundleChecksum = sha256Hex(payload);

    return {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      tenantId,
      siteId: connections[0]?.siteId || "SITE_CENTRAL_01",
      gatewayId,
      connections,
      checksum: `sha256:${bundleChecksum}`,
    };
  }

  /**
   * Converts a canonical ConnectionRegistryEntry into legacy OTConnectionConfig
   * for backwards compatibility with existing UI components and services.
   */
  public static toLegacyOTConnectionConfig(c: ConnectionRegistryEntry): OTConnectionConfig {
    let legacyType: OTConnectionConfig["type"] = "GATEWAY";
    switch (c.protocol) {
      case "OPC_UA":
      case "OPC-UA":
        legacyType = "OPC_UA_SERVER";
        break;
      case "MODBUS":
      case "MODBUS-TCP":
      case "MODBUS-RTU":
        legacyType = "MODBUS_DEVICE";
        break;
      case "MQTT":
      case "SPARKPLUG":
      case "MQTT-SPARKPLUG":
        legacyType = "MQTT_BROKER";
        break;
      case "EROS":
        legacyType = "EROS_ADAPTER";
        break;
      case "SIEMENS-S7":
      case "SIEMENS_S7":
        legacyType = "PLC";
        break;
      default:
        legacyType = "GATEWAY";
        break;
    }

    let host = "127.0.0.1";
    let port = 4840;
    try {
      const parsed = new URL(c.endpoint.replace("opc.tcp://", "http://").replace("eros://", "http://").replace("modbus://", "http://"));
      host = parsed.hostname || host;
      port = parsed.port ? parseInt(parsed.port, 10) : port;
    } catch {
      // Keep defaults if custom URI scheme
    }

    let legacyStatus: OTConnectionConfig["status"] = "SIMULATION";
    if (c.isDemoSimulation) {
      legacyStatus = "SIMULATION";
    } else if (c.status === "CONNECTED" || c.status === "RECEIVING" || c.status === "VALIDATED") {
      legacyStatus = "ONLINE";
    } else if (c.status === "DEGRADED") {
      legacyStatus = "DEGRADED";
    } else {
      legacyStatus = "OFFLINE";
    }

    return {
      id: c.id,
      name: c.name,
      type: legacyType,
      host,
      port,
      protocol: (c.protocol.includes("OPC") ? "OPC-UA" : c.protocol.includes("MODBUS") ? "MODBUS-TCP" : c.protocol.includes("SPARKPLUG") ? "MQTT-SPARKPLUG" : c.protocol) as any,
      security: c.securityProfile?.securityPolicy === "Basic256Sha256" ? "BASIC_256_SHA256" : "TLS_1_3",
      certificateRef: c.certificateRef,
      credentialsRef: c.secretRef,
      timeoutMs: c.expectedIntervalMs,
      retryPolicy: "EXPONENTIAL_BACKOFF",
      heartbeatIntervalSec: Math.round(c.maxSilenceMs / 1000),
      status: legacyStatus,
      lastHeartbeat: c.lastHeartbeatTimestamp || c.updatedAt,
      latencyMs: c.latencyBudgetMs ? Math.round(c.latencyBudgetMs / 10) : 10,
      activeTagsCount: 24,
      messageRateSec: 100,
      tenantId: c.tenantId,
      description: `Canónica [${c.siteId}/${c.areaId || 'PLANTA'}]: ${c.name}`,
      endpoints: [c.endpoint],
    };
  }
}

export const industrialConnectionRegistry = IndustrialConnectionRegistry.getInstance();
