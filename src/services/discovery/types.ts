/**
 * BioAzúcar 4.0 — Industrial Source Discovery Engine Types
 * 
 * Spec Reference: P0-01 (INDUSTRIAL SOURCE DISCOVERY)
 * Supports dynamic scanning and structured browsing across:
 * - OPC UA (IEC 62541): Servers, Namespaces, AddressSpace Object/Variable Nodes, EURange
 * - MQTT / Sparkplug B: Group, Edge Node, Device, NBIRTH/DBIRTH metric payloads
 * - Modbus TCP/RTU: Unit ID scan, Register probe, Data typing
 * - EROS DCS: Process units, PID loop telemetry, Tag catalogs
 * - REST APIs: JSON endpoint metadata introspection
 * - Manual Import & Mapping Workflow: CSV, AML, XML/L5X for air-gapped / legacy equipment
 */

import { IndustrialDataType, IndustrialDataQuality } from "../../types/industrialDataPoint";

export type DiscoveryProtocol =
  | "OPC_UA"
  | "MODBUS_TCP"
  | "MODBUS_RTU"
  | "SPARKPLUG_B"
  | "EROS"
  | "REST"
  | "MANUAL_IMPORT";

export type DiscoveryJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type DiscoveredDeviceType =
  | "PLC"
  | "DCS"
  | "VFD"
  | "SMART_TRANSMITTER"
  | "WEIGHBRIDGE_CONTROLLER"
  | "GATEWAY"
  | "RTU"
  | "LAB_ANALYZER"
  | "UNKNOWN";

export type DiscoveredTagApprovalStatus =
  | "DISCOVERED"
  | "MAPPED"
  | "VALIDATED"
  | "APPROVED"
  | "REJECTED";

export interface DiscoveryTarget {
  targetId: string;
  name: string;
  protocol: DiscoveryProtocol;
  endpoint: string; // e.g. "opc.tcp://192.168.10.50:4840", "192.168.20.15:502", "mqtt://192.168.1.60:1883"
  port?: number;
  tenantId: string;
  siteId: string;
  areaId?: string;
  securityPolicy?: string; // e.g. "Basic256Sha256", "None"
  securityMode?: string;   // e.g. "SignAndEncrypt", "None"
  credentialsRef?: string;
  timeoutMs?: number;
  options?: {
    opcUaNamespaceFilter?: number[];
    opcUaRootNodeId?: string;
    modbusUnitIds?: number[];
    modbusStartRegister?: number;
    modbusRegisterCount?: number;
    sparkplugGroupFilter?: string;
    sparkplugEdgeNodeFilter?: string;
    maxScanDepth?: number;
    pollIntervalMs?: number;
    [key: string]: unknown;
  };
}

export interface DiscoveredSource {
  sourceId: string;
  name: string;
  endpoint: string;
  protocol: DiscoveryProtocol;
  status: "ONLINE" | "OFFLINE" | "UNREACHABLE";
  serverInfo: {
    vendorName?: string;
    productName?: string;
    softwareVersion?: string;
    buildNumber?: string;
    supportedProfiles?: string[];
  };
  discoveredAt: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoveredDevice {
  deviceId: string;
  sourceId: string;
  name: string;
  deviceType: DiscoveredDeviceType;
  ipAddress?: string;
  unitId?: number; // Modbus Unit ID
  rack?: number;
  slot?: number;
  vendor?: string;
  model?: string;
  firmwareVersion?: string;
  status: "ONLINE" | "UNRESPONSIVE" | "SIMULATED";
  discoveredAt: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoveredNode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: "OBJECT" | "VARIABLE" | "METHOD" | "VIEW" | "DATA_TYPE";
  namespaceIndex: number;
  identifier: string | number;
  parentNodeId?: string;
  hasChildren: boolean;
  dataType?: IndustrialDataType;
  engineeringUnit?: string;
  currentValue?: number | boolean | string;
}

export interface DiscoveredTag {
  id: string; // Unique temporary ID for discovery staging
  sourceId: string;
  deviceId: string;
  canonicalName: string;
  originalAddress: string; // e.g. "ns=2;s=Milling.Tandem.TCH", "%MW100", "spBv1.0/Mill/DDATA/PLC1/Speed"
  protocol: DiscoveryProtocol;
  variable: string;
  dataType: IndustrialDataType;
  engineeringUnit: string;
  scale?: number;
  offset?: number;
  min?: number;
  max?: number;
  deadband?: number;
  scanRateMs?: number;
  currentValue?: number | boolean | string;
  quality?: IndustrialDataQuality;
  alarmInfo?: {
    alarmEnabled: boolean;
    highLimit?: number;
    lowLimit?: number;
    highHighLimit?: number;
    lowLowLimit?: number;
  };
  metadata?: Record<string, unknown>;
  approvalStatus: DiscoveredTagApprovalStatus;
  discoveredAt: string;
  rejectionReason?: string;
}

export interface DiscoveryJob {
  jobId: string;
  target: DiscoveryTarget;
  status: DiscoveryJobStatus;
  progressPercentage: number;
  currentStage: string;
  startedAt: string;
  completedAt?: string;
  discoveredSources: DiscoveredSource[];
  discoveredDevices: DiscoveredDevice[];
  discoveredNodes: DiscoveredNode[];
  discoveredTags: DiscoveredTag[];
  warnings: string[];
  error?: string;
}

export interface ManualImportPayload {
  format: "CSV" | "JSON" | "AML" | "PLC_L5X";
  content: string;
  tenantId: string;
  siteId: string;
  defaultProtocol?: DiscoveryProtocol;
  defaultSourceId?: string;
  defaultDeviceId?: string;
  columnMapping?: {
    tagId?: string;
    name?: string;
    address?: string;
    variable?: string;
    dataType?: string;
    unit?: string;
    min?: string;
    max?: string;
    area?: string;
    equipment?: string;
  };
}

export interface DiscoveryJobSummary {
  jobId: string;
  protocol: DiscoveryProtocol;
  status: DiscoveryJobStatus;
  sourcesFound: number;
  devicesFound: number;
  tagsFound: number;
  durationMs: number;
}
