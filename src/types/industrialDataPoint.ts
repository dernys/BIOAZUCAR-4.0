/**
 * BioAzúcar 4.0 — Canonical IndustrialDataPoint Contract (IEC 62541 / ISA-95)
 * 
 * Spec Reference: developer_roadmap.md Section 4.1 & Iteration I22
 * Enforces first-class provenance across the entire OT/IT processing chain:
 *   SOURCE -> PROVENANCE -> NORMALIZATION -> DATA QUALITY -> TRUST -> HISTORIAN -> ANALYTICS -> BIOAI
 */

export type IndustrialRuntimeMode = 'SIMULATION' | 'LAB' | 'PRODUCTION';

export type IndustrialSourceType =
  | 'PLC'
  | 'DCS'
  | 'SENSOR'
  | 'LAB_INSTRUMENT'
  | 'SIMULATOR'
  | 'MOCK';

export type CanonicalIndustrialProtocol =
  | 'OPC_UA'
  | 'MODBUS_TCP'
  | 'MODBUS_RTU'
  | 'SPARKPLUG_B'
  | 'SIEMENS_S7'
  | 'ROCKWELL_CIP'
  | 'EROS'
  | 'CANONICAL_TEST';

export type IndustrialProtocol =
  | CanonicalIndustrialProtocol
  | 'OPC-UA'
  | 'OPC_DA'
  | 'MODBUS-TCP'
  | 'MODBUS-RTU'
  | 'MQTT-SPARKPLUG'
  | 'SIMULATOR'
  | 'SIMULATED'
  | 'SIEMENS-S7'
  | 'ETHERNET_IP'
  | 'ALLEN_BRADLEY'
  | 'REST-API'
  | 'REST_API'
  | 'REST'
  | 'MQTT'
  | 'SPARKPLUG'
  | 'MODBUS'
  | 'EROS_DCS'
  | 'EROS-NATIVE'
  | 'MANUAL_IMPORT';

export type IndustrialDataType =
  | 'FLOAT'
  | 'FLOAT32'
  | 'FLOAT64'
  | 'INT16'
  | 'INT32'
  | 'INT64'
  | 'UINT16'
  | 'UINT32'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'STRING';

export type IndustrialDataQuality =
  | 'GOOD'
  | 'BAD'
  | 'UNCERTAIN'
  | 'STALE'
  | 'SIMULATED'
  | 'COMMUNICATION_LOST'
  | 'OUT_OF_RANGE';

export type IndustrialQualityReason =
  | 'NORMAL'
  | 'TIMEOUT'
  | 'COMM_FAILURE'
  | 'COMMUNICATION_LOST'
  | 'CRC_ERROR'
  | 'OUT_OF_RANGE'
  | 'RATE_OF_CHANGE_EXCEEDED'
  | 'CONFIG_ERROR'
  | 'UNVERIFIED_SOURCE'
  | 'PROVENANCE_MISMATCH'
  | (string & {});

export type IndustrialCalibrationState =
  | 'CALIBRATED'
  | 'EXPIRED'
  | 'UNCALIBRATED'
  | 'NOT_APPLICABLE';

/**
 * Strict 17-field canonical contract for wire-level, edge, and ingestion points.
 */
export interface CanonicalIndustrialDataPoint {
  readonly runtimeMode: IndustrialRuntimeMode;
  readonly sourceType: IndustrialSourceType;
  readonly sourceId: string;
  readonly driverId: string;
  readonly protocol: IndustrialProtocol;
  readonly deviceId: string;
  readonly assetId: string;
  readonly tagId: string;
  readonly value: number | boolean | string;
  readonly engineeringUnit: string;
  readonly dataType: IndustrialDataType;
  readonly deviceTimestamp: string;
  readonly ingestionTimestamp: string;
  readonly sequence: number;
  readonly quality: IndustrialDataQuality;
  readonly qualityReason: IndustrialQualityReason;
  readonly calibrationState: IndustrialCalibrationState;
  readonly schemaVersion: string;
}

/**
 * Universal Canonical Industrial Data Point Interface.
 * Every data point processed in BioAzúcar 4.0 complies with this contract.
 */
export interface IndustrialDataPoint {
  // --- Metadatos de Runtime y Origen (Proveniencia Inmutable) ---
  readonly runtimeMode?: IndustrialRuntimeMode;
  readonly sourceType?: IndustrialSourceType;
  readonly sourceId?: string;          // e.g. "PLC-MOLINO-01", "SIM-TURBINA-02"
  readonly driverId?: string;          // e.g. "driver-modbus-tcp-01", "driver-opcua-client-01"
  readonly protocol?: IndustrialProtocol;
  readonly deviceId?: string;          // e.g. "DEV-TANDEM-M1"
  readonly assetId?: string;           // e.g. "MOLINO-01-MASA-SUPERIOR"
  readonly tagId?: string;             // e.g. "M1_HYDR_PRESS_DS"

  // --- Carga Útil y Tipado de Ingeniería ---
  readonly value: number | boolean | string;
  readonly engineeringUnit?: string;   // e.g. "bar", "t/h", "°C", "%", "rpm"
  readonly dataType?: IndustrialDataType;

  // --- Estampas Temporales y Secuencia ---
  readonly deviceTimestamp?: string;   // ISO-8601 UTC estampa del reloj del dispositivo emisor
  readonly ingestionTimestamp?: string;// ISO-8601 UTC estampa monótona del Edge Daemon al recibir la trama
  readonly sequence?: number;          // Contador monótono uint64 para detección de huecos/pérdida
  readonly timestamp?: string;

  // --- Calidad y Diagnóstico ---
  readonly quality: IndustrialDataQuality;
  readonly qualityReason?: IndustrialQualityReason;
  readonly calibrationState?: IndustrialCalibrationState;
  readonly schemaVersion?: string;     // SemVer del contrato canónico, e.g. "4.0.0"

  // --- Retrocompatibilidad de Transición (Non-breaking legacy aliases) ---
  readonly id?: string;
  readonly tag?: string;
  readonly unit?: string;
  readonly rawValue?: number | string | boolean;
  readonly engValue?: number;
  readonly isSimulated?: boolean;
  readonly provenance?: string;
  readonly equipmentId?: string;
  readonly siteId?: string;
  readonly areaId?: string;
  readonly tenantId?: string;
  readonly sequenceNumber?: number;
  readonly isHistorical?: boolean;
  readonly engMin?: number;
  readonly engMax?: number;
  readonly description?: string;
  readonly correlationId?: string;
  readonly source?: string;
  readonly scale?: number;
  readonly offset?: number;
  readonly deadband?: number;
  readonly samplingInterval?: number;
  readonly securityClearanceLevel?: number;
  readonly sourceTimestamp?: string;
}

export const CANONICAL_SCHEMA_VERSION = "4.0.0";

export const VALID_RUNTIME_MODES: readonly IndustrialRuntimeMode[] = [
  'SIMULATION',
  'LAB',
  'PRODUCTION',
] as const;

export const VALID_SOURCE_TYPES: readonly IndustrialSourceType[] = [
  'PLC',
  'DCS',
  'SENSOR',
  'LAB_INSTRUMENT',
  'SIMULATOR',
  'MOCK',
] as const;

export function normalizeProtocol(protocol: unknown): CanonicalIndustrialProtocol {
  if (typeof protocol !== 'string') return 'CANONICAL_TEST';
  const upper = protocol.toUpperCase().replace(/-/g, '_');
  if (upper.includes('OPC')) return 'OPC_UA';
  if (upper.includes('MODBUS') && upper.includes('RTU')) return 'MODBUS_RTU';
  if (upper.includes('MODBUS')) return 'MODBUS_TCP';
  if (upper.includes('SPARKPLUG') || upper.includes('MQTT')) return 'SPARKPLUG_B';
  if (upper.includes('SIEMENS') || upper.includes('S7')) return 'SIEMENS_S7';
  if (upper.includes('CIP') || upper.includes('ETHERNET_IP') || upper.includes('ALLEN')) return 'ROCKWELL_CIP';
  if (upper.includes('EROS')) return 'EROS';
  if (upper.includes('TEST') || upper.includes('SIMULAT')) return 'CANONICAL_TEST';
  return 'CANONICAL_TEST';
}

export const VALID_PROTOCOLS: readonly CanonicalIndustrialProtocol[] = [
  'OPC_UA',
  'MODBUS_TCP',
  'MODBUS_RTU',
  'SPARKPLUG_B',
  'SIEMENS_S7',
  'ROCKWELL_CIP',
  'EROS',
  'CANONICAL_TEST',
] as const;

export const VALID_DATA_TYPES: readonly IndustrialDataType[] = [
  'FLOAT32',
  'FLOAT64',
  'INT16',
  'INT32',
  'UINT16',
  'UINT32',
  'BOOLEAN',
  'STRING',
] as const;

export const VALID_QUALITIES: readonly IndustrialDataQuality[] = [
  'GOOD',
  'BAD',
  'UNCERTAIN',
  'STALE',
  'SIMULATED',
] as const;

export const VALID_QUALITY_REASONS: readonly IndustrialQualityReason[] = [
  'NORMAL',
  'TIMEOUT',
  'COMM_FAILURE',
  'CRC_ERROR',
  'OUT_OF_RANGE',
  'RATE_OF_CHANGE_EXCEEDED',
  'CONFIG_ERROR',
  'UNVERIFIED_SOURCE',
  'PROVENANCE_MISMATCH',
] as const;

export const VALID_CALIBRATION_STATES: readonly IndustrialCalibrationState[] = [
  'CALIBRATED',
  'EXPIRED',
  'UNCALIBRATED',
  'NOT_APPLICABLE',
] as const;

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Validates whether an unknown object fully satisfies the 17 attributes of IndustrialDataPoint.
 */
export function validateIndustrialDataPoint(pt: unknown): ValidationResult {
  const errors: string[] = [];
  if (!pt || typeof pt !== 'object') {
    return { valid: false, errors: ['Point must be a non-null object'] };
  }

  const p = pt as Record<string, any>;

  // 1. runtimeMode
  if (!VALID_RUNTIME_MODES.includes(p.runtimeMode)) {
    errors.push(`Invalid runtimeMode '${p.runtimeMode}'. Must be one of: ${VALID_RUNTIME_MODES.join(', ')}`);
  }

  // 2. sourceType
  if (!VALID_SOURCE_TYPES.includes(p.sourceType)) {
    errors.push(`Invalid sourceType '${p.sourceType}'. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
  }

  // 3. sourceId
  if (typeof p.sourceId !== 'string' || p.sourceId.trim().length === 0) {
    errors.push('sourceId must be a non-empty string');
  }

  // 4. driverId
  if (typeof p.driverId !== 'string' || p.driverId.trim().length === 0) {
    errors.push('driverId must be a non-empty string');
  }

  // 5. protocol
  const effectiveProtocol = typeof p.protocol === 'string' ? normalizeProtocol(p.protocol) : p.protocol;
  if (!VALID_PROTOCOLS.includes(effectiveProtocol)) {
    errors.push(`Invalid protocol '${p.protocol}'. Must resolve to one of: ${VALID_PROTOCOLS.join(', ')}`);
  }

  // 6. deviceId
  if (typeof p.deviceId !== 'string' || p.deviceId.trim().length === 0) {
    errors.push('deviceId must be a non-empty string');
  }

  // 7. assetId
  if (typeof p.assetId !== 'string' || p.assetId.trim().length === 0) {
    errors.push('assetId must be a non-empty string');
  }

  // 8. tagId
  const effectiveTag = p.tagId || p.tag;
  if (typeof effectiveTag !== 'string' || effectiveTag.trim().length === 0) {
    errors.push('tagId must be a non-empty string');
  }

  // 9. value
  if (p.value === undefined || p.value === null) {
    errors.push('value must not be undefined or null');
  } else if (
    typeof p.value !== 'number' &&
    typeof p.value !== 'boolean' &&
    typeof p.value !== 'string'
  ) {
    errors.push(`value has invalid type '${typeof p.value}'`);
  }

  // 10. engineeringUnit
  const effectiveUnit = p.engineeringUnit ?? p.unit;
  if (typeof effectiveUnit !== 'string') {
    errors.push('engineeringUnit must be a string');
  }

  // 11. dataType
  if (p.dataType && !VALID_DATA_TYPES.includes(p.dataType)) {
    errors.push(`Invalid dataType '${p.dataType}'. Must be one of: ${VALID_DATA_TYPES.join(', ')}`);
  }

  // 12. deviceTimestamp
  if (typeof p.deviceTimestamp !== 'string' || isNaN(Date.parse(p.deviceTimestamp))) {
    errors.push(`deviceTimestamp '${p.deviceTimestamp}' is not a valid ISO-8601 UTC date string`);
  }

  // 13. ingestionTimestamp
  if (typeof p.ingestionTimestamp !== 'string' || isNaN(Date.parse(p.ingestionTimestamp))) {
    errors.push(`ingestionTimestamp '${p.ingestionTimestamp}' is not a valid ISO-8601 UTC date string`);
  }

  // 14. sequence
  const effectiveSeq = p.sequence ?? p.sequenceNumber;
  if (typeof effectiveSeq !== 'number' || effectiveSeq < 0 || !Number.isInteger(effectiveSeq)) {
    errors.push('sequence must be a non-negative integer');
  }

  // 15. quality
  if (!VALID_QUALITIES.includes(p.quality)) {
    errors.push(`Invalid quality '${p.quality}'. Must be one of: ${VALID_QUALITIES.join(', ')}`);
  }

  // 16. qualityReason
  if (!VALID_QUALITY_REASONS.includes(p.qualityReason)) {
    errors.push(`Invalid qualityReason '${p.qualityReason}'. Must be one of: ${VALID_QUALITY_REASONS.join(', ')}`);
  }

  // 17. calibrationState
  if (!VALID_CALIBRATION_STATES.includes(p.calibrationState)) {
    errors.push(`Invalid calibrationState '${p.calibrationState}'. Must be one of: ${VALID_CALIBRATION_STATES.join(', ')}`);
  }

  // schemaVersion
  if (typeof p.schemaVersion !== 'string' || p.schemaVersion.trim().length === 0) {
    errors.push('schemaVersion must be a valid version string');
  }

  // --- Strict Provenance Consistency Checks ---
  if (p.runtimeMode === 'PRODUCTION') {
    if (p.sourceType === 'SIMULATOR' || p.sourceType === 'MOCK') {
      errors.push("CRITICAL_PROVENANCE_VIOLATION: Production data cannot have sourceType 'SIMULATOR' or 'MOCK'");
    }
    if (p.quality === 'SIMULATED') {
      errors.push("CRITICAL_PROVENANCE_VIOLATION: Production data cannot carry 'SIMULATED' quality");
    }
    if (p.isSimulated === true) {
      errors.push("CRITICAL_PROVENANCE_VIOLATION: Production data cannot have isSimulated=true");
    }
  }

  if (p.runtimeMode === 'SIMULATION') {
    if (p.source === 'LIVE_OT' || p.provenance === 'PHYSICAL_OT' || p.provenance === 'OBSERVED_OT') {
      errors.push("DATA_TRUTH_VIOLATION: Simulation data cannot be branded as LIVE_OT or PHYSICAL_OT");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Type-assertion function for IndustrialDataPoint.
 */
export function assertCanonicalDataPoint(pt: unknown): asserts pt is IndustrialDataPoint {
  const result = validateIndustrialDataPoint(pt);
  if (!result.valid) {
    throw new Error(`IndustrialDataPoint canonical validation failed:\n - ${result.errors.join('\n - ')}`);
  }
}

/**
 * Deterministic builder for canonical IndustrialDataPoint with defaults and strict provenance.
 */
export function createCanonicalDataPoint(params: {
  runtimeMode: IndustrialRuntimeMode;
  sourceType: IndustrialSourceType;
  sourceId: string;
  driverId: string;
  protocol: IndustrialProtocol;
  deviceId: string;
  assetId: string;
  tagId: string;
  value: number | boolean | string;
  engineeringUnit: string;
  dataType?: IndustrialDataType;
  deviceTimestamp?: string;
  ingestionTimestamp?: string;
  sequence: number;
  quality?: IndustrialDataQuality;
  qualityReason?: IndustrialQualityReason;
  calibrationState?: IndustrialCalibrationState;
  schemaVersion?: string;
  // Optional extra metadata
  rawValue?: number | string | boolean;
  engValue?: number;
  engMin?: number;
  engMax?: number;
  description?: string;
  tenantId?: string;
  siteId?: string;
  areaId?: string;
}): IndustrialDataPoint {
  const nowIso = new Date().toISOString();

  // Infer data type if omitted
  const dataType: IndustrialDataType = params.dataType ?? (
    typeof params.value === 'boolean'
      ? 'BOOLEAN'
      : typeof params.value === 'string'
      ? 'STRING'
      : Number.isInteger(params.value)
      ? 'INT32'
      : 'FLOAT32'
  );

  const quality: IndustrialDataQuality = params.quality ?? (
    params.runtimeMode === 'SIMULATION' ? 'SIMULATED' : 'GOOD'
  );

  const qualityReason: IndustrialQualityReason = params.qualityReason ?? 'NORMAL';
  const calibrationState: IndustrialCalibrationState = params.calibrationState ?? 'CALIBRATED';
  const deviceTimestamp = params.deviceTimestamp ?? nowIso;
  const ingestionTimestamp = params.ingestionTimestamp ?? nowIso;

  const point: IndustrialDataPoint = {
    runtimeMode: params.runtimeMode,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    driverId: params.driverId,
    protocol: params.protocol,
    deviceId: params.deviceId,
    assetId: params.assetId,
    tagId: params.tagId,
    value: params.value,
    engineeringUnit: params.engineeringUnit,
    dataType,
    deviceTimestamp,
    ingestionTimestamp,
    sequence: params.sequence,
    quality,
    qualityReason,
    calibrationState,
    schemaVersion: params.schemaVersion ?? CANONICAL_SCHEMA_VERSION,

    // Backward-compatibility mirror fields
    tag: params.tagId,
    unit: params.engineeringUnit,
    rawValue: params.rawValue ?? params.value,
    engValue: params.engValue ?? (typeof params.value === 'number' ? params.value : undefined),
    isSimulated: params.runtimeMode === 'SIMULATION',
    provenance: params.runtimeMode === 'SIMULATION' ? 'SIMULATED_PROCESS_MODEL' : 'PHYSICAL_OT',
    equipmentId: params.assetId,
    tenantId: params.tenantId,
    siteId: params.siteId,
    areaId: params.areaId,
    sequenceNumber: params.sequence,
    engMin: params.engMin,
    engMax: params.engMax,
    description: params.description,
  };

  assertCanonicalDataPoint(point);
  return Object.freeze(point);
}
