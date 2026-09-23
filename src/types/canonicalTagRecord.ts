/**
 * BioAzúcar 4.0 — Canonical Industrial Tag Record Specification
 * 
 * Spec Reference: P0-02 (INDUSTRIAL TAG REGISTRY HARDENING)
 * Strict schema governing all industrial instrumentation and control points.
 * Ensures unambiguous metadata, provenance, semantic categorization, and safety alignment.
 */

import {
  IndustrialDataType,
  IndustrialDataQuality,
  IndustrialCalibrationState,
  IndustrialProtocol,
  CanonicalIndustrialDataPoint,
} from "./industrialDataPoint";

export type TagCriticality =
  | "NON_CRITICAL"
  | "OPERATIONAL"
  | "SAFETY_CRITICAL"
  | "ENVIRONMENTAL"
  | "FINANCIAL";

export type TagSemanticClass =
  | "PROCESS_VARIABLE"      // PV: Temperatura, Presión, Flujo, Nivel
  | "SETPOINT"              // SP: Consigna de control
  | "MANIPULATED_VARIABLE"  // MV / CV: Apertura de válvula, RPM bomba
  | "STATUS_DISCRETE"       // Estado de marcha, falla, interbloqueo
  | "COMMAND"               // Comando de arranque/parada o seteo
  | "CALCULATED_KPI"        // Hugot Extraction, Eficiencia Caldera ASME
  | "ACCUMULATOR";          // Toneladas caña molidas, kWh producidos

export type SafetyClassification =
  | "NONE"
  | "BPCS"                  // Basic Process Control System (IEC 61511)
  | "SIS"                   // Safety Instrumented System
  | "SIL1"
  | "SIL2"
  | "SIL3";

export type TagApprovalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "DEPRECATED";

export type TagTimestampSource =
  | "DEVICE"               // PLC / RTU hardware RTC
  | "GATEWAY"              // Edge IPC or Field Gateway arrival time
  | "INGESTION"            // Server / Cloud ingestion time
  | "CALCULATED";          // Virtual or analytics engine time

export interface TagQualityMapping {
  defaultQuality: IndustrialDataQuality;
  badOnOutOfRange: boolean;
  badOnStaleTimeoutMs?: number;
  rawErrorCodes?: Record<string, IndustrialDataQuality>;
}

export interface TagAlarmMapping {
  enabled: boolean;
  high?: number;
  low?: number;
  highHigh?: number;
  lowLow?: number;
  deadband?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  tripInterlockId?: string;
}

/**
 * P0-02 Mandatory Specification: Canonical Industrial Tag Record
 * Every field required by the specification is present and strictly typed.
 */
export interface CanonicalIndustrialTagRecord {
  readonly tagId: string;
  readonly canonicalName: string;
  readonly sourceId: string;
  readonly originalAddress: string;
  readonly protocol: IndustrialProtocol;
  readonly driver: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly areaId: string;
  readonly processId: string;
  readonly assetId: string;
  readonly deviceId: string;
  readonly variable: string;
  readonly dataType: IndustrialDataType;
  readonly engineeringUnit: string;
  readonly scale: number;
  readonly offset: number;
  readonly min: number;
  readonly max: number;
  readonly deadband: number;
  readonly scanRate: number; // in milliseconds
  readonly timestampSource: TagTimestampSource;
  readonly qualityMapping: TagQualityMapping;
  readonly alarmMapping: TagAlarmMapping;
  readonly criticality: TagCriticality;
  readonly semanticClass: TagSemanticClass;
  readonly safetyClassification: SafetyClassification;
  readonly calibrationState: IndustrialCalibrationState;
  readonly owner: string; // Responsible engineer / role
  readonly approvalStatus: TagApprovalStatus;
  readonly version: number;
  readonly effectiveFrom: string; // ISO 8601
  readonly effectiveTo?: string;  // ISO 8601 (undefined if currently active)
  readonly tagIntegrityHash?: string; // SHA-256 tamper-evident hash
  readonly metadata?: Record<string, unknown>;
}

export interface TagQueryFilter {
  tenantId?: string;
  siteId?: string;
  areaId?: string;
  processId?: string;
  assetId?: string;
  deviceId?: string;
  protocol?: string;
  criticality?: TagCriticality;
  semanticClass?: TagSemanticClass;
  approvalStatus?: TagApprovalStatus;
  searchQuery?: string;
}

export interface TagCreationInput {
  tagId: string;
  canonicalName: string;
  sourceId: string;
  originalAddress: string;
  protocol: IndustrialProtocol;
  driver: string;
  tenantId: string;
  siteId: string;
  areaId: string;
  processId: string;
  assetId: string;
  deviceId: string;
  variable: string;
  dataType: IndustrialDataType;
  engineeringUnit: string;
  scale?: number;
  offset?: number;
  min?: number;
  max?: number;
  deadband?: number;
  scanRate?: number;
  timestampSource?: TagTimestampSource;
  qualityMapping?: Partial<TagQualityMapping>;
  alarmMapping?: Partial<TagAlarmMapping>;
  criticality?: TagCriticality;
  semanticClass?: TagSemanticClass;
  safetyClassification?: SafetyClassification;
  calibrationState?: IndustrialCalibrationState;
  owner: string;
  approvalStatus?: TagApprovalStatus;
  metadata?: Record<string, unknown>;
}
