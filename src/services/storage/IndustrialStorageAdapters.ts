/**
 * BioAzúcar 4.0 — Industrial Storage & Transport Abstraction Layer
 * 
 * Defines technology-agnostic interfaces preparing the platform for:
 * - PostgreSQL: relational domain (tenants, registry, assets, tags, commissioning, audit, configuration)
 * - TimescaleDB: high-frequency industrial time-series and compression
 * - Kafka: distributed industrial telemetry streams and event bus
 * - MQTT / Sparkplug B: OT / Edge transport and Universal NameSpace (UNS)
 * - Prometheus: operational health and connector performance metrics
 * 
 * Domain logic depends exclusively on these interfaces, preventing direct coupling
 * to vendor-specific database engines or messaging drivers.
 */

import {
  TenantEnterprise,
  ConnectionRegistryEntry,
  IndustrialTagDefinition,
  IndustrialTagSample,
  IndustrialDataPoint,
  TenantPhysicalEvidence,
  UserRole,
} from "../../types";

// ============================================================================
// 1. POSTGRESQL RELATIONAL ADAPTER INTERFACE
// ============================================================================

export interface CommissioningAuditRecord {
  id: string;
  tenantId: string;
  siteId: string;
  gatewayId: string;
  connectionId: string;
  status: "SUCCESS" | "FAILED" | "REJECTED";
  executedBy: string;
  executedAt: string;
  evidence: TenantPhysicalEvidence;
  validationDetails: {
    connectionVerified: boolean;
    authVerified: boolean;
    tagReceptionVerified: boolean;
    freshnessVerified: boolean;
    qualityRateVerified: boolean;
    latencyVerified: boolean;
    continuityVerified: boolean;
    storeAndForwardVerified: boolean;
    reconnectVerified: boolean;
    heartbeatVerified: boolean;
  };
  hash: string;
}

export interface IPostgresStorageAdapter {
  // Tenant Domain
  getTenant(id: string): Promise<TenantEnterprise | null>;
  saveTenant(tenant: TenantEnterprise): Promise<void>;
  listTenants(): Promise<TenantEnterprise[]>;

  // Connection Registry
  getConnection(id: string): Promise<ConnectionRegistryEntry | null>;
  saveConnection(connection: ConnectionRegistryEntry): Promise<void>;
  listConnections(filter?: { tenantId?: string; siteId?: string; areaId?: string }): Promise<ConnectionRegistryEntry[]>;
  deleteConnection(id: string): Promise<boolean>;

  // Industrial Tag Registry
  getTag(id: string): Promise<IndustrialTagDefinition | null>;
  saveTag(tag: IndustrialTagDefinition): Promise<void>;
  listTags(filter?: { tenantId?: string; connectionId?: string; areaId?: string; assetId?: string }): Promise<IndustrialTagDefinition[]>;
  deleteTag(id: string): Promise<boolean>;

  // Commissioning Evidence & Records
  saveCommissioningRecord(record: CommissioningAuditRecord): Promise<void>;
  getCommissioningRecord(id: string): Promise<CommissioningAuditRecord | null>;
  listCommissioningRecords(tenantId: string): Promise<CommissioningAuditRecord[]>;

  // Security & Audit Trail
  saveAuditEntry(entry: {
    timestamp: string;
    userRole: UserRole;
    userName: string;
    action: string;
    module: string;
    targetId: string;
    previousValue?: string;
    newValue?: string;
    status: string;
    ipAddress?: string;
    tenantId?: string;
  }): Promise<void>;
}

// ============================================================================
// 2. TIMESCALEDB TIME-SERIES ADAPTER INTERFACE
// ============================================================================

export interface TimeSeriesQueryOptions {
  tagId: string;
  tenantId: string;
  fromTimestamp: string;
  toTimestamp: string;
  resolutionIntervalMs?: number;
  aggregateFunction?: "AVG" | "MAX" | "MIN" | "FIRST" | "LAST";
}

export interface ITimescaleDbAdapter {
  insertDataPoint(sample: IndustrialTagSample | IndustrialDataPoint): Promise<void>;
  insertBatch(samples: (IndustrialTagSample | IndustrialDataPoint)[]): Promise<{
    inserted: number;
    failed: number;
    errors?: string[];
  }>;
  queryRange(options: TimeSeriesQueryOptions): Promise<Array<{
    timestamp: string;
    value: number | boolean | string;
    quality: string;
    availability: string;
  }>>;
  getLatestPoint(tagId: string, tenantId: string): Promise<IndustrialTagSample | null>;
}

// ============================================================================
// 3. KAFKA DISTRIBUTED STREAMING ADAPTER INTERFACE
// ============================================================================

export interface IKafkaEventStreamAdapter {
  publishTelemetry(topic: string, sample: IndustrialTagSample | IndustrialDataPoint): Promise<boolean>;
  publishBatch(
    topic: string,
    samples: (IndustrialTagSample | IndustrialDataPoint)[]
  ): Promise<{ publishedCount: number; partition: number }>;
  publishOperationalEvent(
    topic: string,
    event: {
      eventType: string;
      tenantId: string;
      timestamp: string;
      payload: any;
    }
  ): Promise<boolean>;
  subscribe(
    topic: string,
    consumerGroup: string,
    handler: (event: any) => Promise<void>
  ): Promise<() => void>;
}

// ============================================================================
// 4. MQTT / SPARKPLUG B UNS TRANSPORT ADAPTER INTERFACE
// ============================================================================

export interface IMqttSparkplugTransportAdapter {
  publishBirthCertificate(edgeNodeId: string, payload: {
    timestamp: number;
    metrics: Array<{ name: string; type: string; value: any }>;
  }): Promise<boolean>;
  publishDeathCertificate(edgeNodeId: string): Promise<boolean>;
  publishDataPayload(edgeNodeId: string, deviceId: string, metrics: Array<{
    name: string;
    type: string;
    value: any;
    timestamp: number;
    quality: string;
  }>): Promise<boolean>;
  publishCommand(edgeNodeId: string, deviceId: string, command: any): Promise<boolean>;
}

// ============================================================================
// 5. PROMETHEUS OPERATIONAL METRICS ADAPTER INTERFACE
// ============================================================================

export interface IPrometheusMetricsAdapter {
  recordConnectorLatency(connectorId: string, protocol: string, latencyMs: number): void;
  recordThroughput(connectorId: string, bytes: number, samplesCount: number): void;
  recordConnectorStatus(connectorId: string, status: string): void;
  recordQualityPassRate(tenantId: string, ratePercentage: number): void;
  recordDroppedMessage(connectorId: string, reason: string): void;
  recordReconnectEvent(connectorId: string): void;
  recordStoreAndForwardDepth(gatewayId: string, pendingItems: number): void;
  recordProcessingError(connectorId: string, errorType: string): void;
  recordEdgeHeartbeat(edgeNodeId: string): void;
}
