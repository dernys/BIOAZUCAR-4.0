import {
  DataQuality,
  DataSourceType,
  ProtocolType,
  OperationalPermission,
  NetworkZoneType,
  IEC62443SecurityLevel,
  IndustrialDataPoint,
} from "../../types";

export type EdgeConnectionStatus =
  | "CONNECTED"
  | "DEGRADED"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "AUTH_FAILED"
  | "TIMEOUT"
  | "PROTOCOL_ERROR"
  | "STALE";

export interface EdgeConnectorDiagnostics {
  connectorId: string;
  name: string;
  source: DataSourceType;
  protocol: ProtocolType;
  status: EdgeConnectionStatus;
  statusMessage: string;
  lastSeen: string | null;
  latencyMs: number;
  reconnectCount: number;
  errorCount: number;
  timeoutCount: number;
  messageRateSec: number;
  queueDepth: number;
  qualityGoodPercentage: number;
  qualityBadPercentage: number;
  clockSkewMs: number;
  packetsReceived: number;
  packetsSent: number;
  uptimeSeconds: number;
  connectedSince: string | null;
  lastError: string | null;
}

// ----------------------------------------------------------------------------
// MODBUS PROTOCOL CONFIGURATION
// ----------------------------------------------------------------------------
export type ModbusRegisterType =
  | "COIL"
  | "DISCRETE_INPUT"
  | "HOLDING_REGISTER"
  | "INPUT_REGISTER";

export type ModbusDataType =
  | "BOOLEAN"
  | "INT16"
  | "UINT16"
  | "INT32"
  | "UINT32"
  | "FLOAT32"
  | "FLOAT64"
  | "STRING";

export type ModbusByteOrder = "AB" | "BA" | "CDAB" | "BADC";

export interface ModbusTagConfig {
  tag: string;
  name: string;
  unitId: number; // 1-247
  functionCode: 1 | 2 | 3 | 4 | 5 | 6 | 15 | 16;
  registerAddress: number;
  registerType: ModbusRegisterType;
  dataType: ModbusDataType;
  byteOrder: ModbusByteOrder;
  scale: number;
  offset: number;
  unit: string;
  pollingIntervalMs: number;
  timeoutMs: number;
  retries: number;
  assetId: string;
  areaId: string;
  siteId?: string;
  tenantId?: string;
}

// ----------------------------------------------------------------------------
// OPC UA PROTOCOL CONFIGURATION
// ----------------------------------------------------------------------------
export type OpcUaSecurityPolicy =
  | "None"
  | "Basic256Sha256"
  | "Aes128_Sha256_RsaOaep";

export type OpcUaSecurityMode = "None" | "Sign" | "SignAndEncrypt";
export type OpcUaAuthMode = "Anonymous" | "UserName" | "Certificate";

export interface OpcUaEndpointInfo {
  endpointUrl: string;
  serverName: string;
  securityPolicy: OpcUaSecurityPolicy;
  securityMode: OpcUaSecurityMode;
  transportProfileUri: string;
  certificateThumbprint?: string;
}

export interface OpcUaSubscriptionConfig {
  samplingIntervalMs: number;
  publishingIntervalMs: number;
  queueSize: number;
  discardOldest: boolean;
}

export interface OpcUaNodeDefinition {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: "Variable" | "Object" | "Method" | "View";
  dataType: string;
  accessLevel: "CurrentRead" | "CurrentWrite" | "CurrentReadOrWrite";
  description?: string;
}

// ----------------------------------------------------------------------------
// MQTT / SPARKPLUG B CONFIGURATION
// ----------------------------------------------------------------------------
export type SparkplugMessageType =
  | "NBIRTH"
  | "NDEATH"
  | "DBIRTH"
  | "DDEATH"
  | "NDATA"
  | "DDATA"
  | "NCMD"
  | "DCMD";

export interface SparkplugBConfig {
  brokerUrl: string;
  groupId: string;
  edgeNodeId: string;
  deviceId?: string;
  clientId: string;
  qos: 0 | 1 | 2;
  useTls: boolean;
  keepAliveSec: number;
  cleanSession: boolean;
  secretRef?: string;
  certRef?: string;
}

export interface SparkplugMetric {
  name: string;
  alias?: number;
  timestamp: number;
  dataType: string;
  value: any;
  isHistorical?: boolean;
  isTransient?: boolean;
  metadata?: Record<string, any>;
}

export interface SparkplugPayload {
  timestamp: number;
  metrics: SparkplugMetric[];
  seq: number;
  uuid?: string;
  body?: Uint8Array;
}

// ----------------------------------------------------------------------------
// EROS ADAPTER INTERFACE CONFIGURATION
// ----------------------------------------------------------------------------
export type ErosInterfaceType =
  | "DIRECT_TCP"
  | "OPC_UA_BRIDGE"
  | "MODBUS_GATEWAY"
  | "REST_API"
  | "DATABASE_EXPORT";

export interface ErosInstallationProfile {
  plantId: string;
  siteName: string;
  version: string;
  supportedInterfaces: ErosInterfaceType[];
  activeInterface: ErosInterfaceType;
  host: string;
  port: number;
  secretRef?: string;
  pollingIntervalMs: number;
  timeoutMs: number;
  readOnlyMode: boolean;
}

// ----------------------------------------------------------------------------
// COMMAND SERVICE & IDEMPOTENCY
// ----------------------------------------------------------------------------
export interface CommandExecutionContract {
  commandId: string;
  idempotencyKey: string;
  userId: string;
  userName: string;
  role: string;
  operationalPermission: OperationalPermission;
  plantId: string;
  assetId: string;
  tag: string;
  oldValue: number | string | boolean;
  requestedValue: number | string | boolean;
  unit: string;
  reason: string;
  timestamp: string;
  approval: {
    required: boolean;
    status: "APPROVED" | "REJECTED" | "PENDING";
    approverUserId?: string;
    approverRole?: string;
    approvedAt?: string;
  };
  validationStatus: "PENDING" | "VALID" | "INVALID" | "REJECTED";
  validationMessage?: string;
  executionStatus:
    | "QUEUED"
    | "PENDING_CONFIRMATION"
    | "EXECUTING"
    | "EXECUTED"
    | "FAILED"
    | "CANCELLED";
  result?: {
    success: boolean;
    message: string;
    executionTimestamp: string;
    source: DataSourceType;
    protocol: ProtocolType;
  };
}

// ----------------------------------------------------------------------------
// STORE & FORWARD LOCAL BUFFER
// ----------------------------------------------------------------------------
export interface StoreAndForwardBufferState {
  isCloudConnected: boolean;
  bufferedCount: number;
  maxBufferCapacity: number;
  oldestPointTimestamp: string | null;
  newestPointTimestamp: string | null;
  isSyncing: boolean;
  totalIngested: number;
  totalForwarded: number;
  droppedPoints: number;
  lastForwardTimestamp: string | null;
}
