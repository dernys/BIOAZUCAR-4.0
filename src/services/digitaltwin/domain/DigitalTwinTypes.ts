/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — DIGITAL TWIN DOMAIN MODEL & CANONICAL CONTRACTS
 * Reference Standards: ISA-95 Part 2, ISO 23247 (Digital Twin Manufacturing Framework),
 * IEC 62443-3-3 SL3, ASME PTC 4, ICUMSA
 * ============================================================================
 */

import {
  IndustrialDataPoint,
  IndustrialDataQuality,
  IndustrialProtocol,
  IndustrialRuntimeMode,
} from "../../../types/industrialDataPoint";
import { Isa95Level } from "../../semantic/types";
import { KpiDefinition, AlarmEvent, EquipmentItem } from "../../../types";

// ============================================================================
// 1. OPERATIONAL MODES & TWIN STATES
// ============================================================================

export type TwinOperationalMode =
  | "PRODUCTION"
  | "SIMULATION"
  | "LAB"
  | "HISTORICAL_REPLAY"
  | "HYBRID"
  | "WAITING_FOR_COMMISSIONING";

export type EquipmentOperationalState =
  | "RUNNING"
  | "STOPPED"
  | "STARTING"
  | "STOPPING"
  | "FAULT"
  | "WARNING"
  | "MAINTENANCE"
  | "OFFLINE"
  | "UNKNOWN"
  | "SIMULATED";

export type FlowType = "MATERIAL" | "ENERGY" | "SIGNAL" | "CONTROL";

export type MaterialSubtype =
  | "CANE"
  | "PREPARED_CANE"
  | "BAGASSE"
  | "MIXED_JUICE"
  | "CLARIFIED_JUICE"
  | "SYRUP_MELADURA"
  | "MASSECUITE_A"
  | "MASSECUITE_B"
  | "MASSECUITE_C"
  | "SUGAR_COMMERCIAL"
  | "MOLASSES"
  | "FILTER_CAKE_CACHAZA"
  | "WATER"
  | "CONDENSATE";

export type EnergySubtype =
  | "BIOMASS_FUEL"
  | "HP_STEAM"
  | "LP_EXHAUST_STEAM"
  | "MECHANICAL_SHAFT"
  | "ELECTRICITY_INTERNAL"
  | "ELECTRICITY_GRID_EXPORT";

// ============================================================================
// 2. CORE ASSET & HIERARCHY ENTITIES
// ============================================================================

export interface TwinAssetMetadata {
  id: string;
  code: string;
  name: string;
  areaId: string;
  processCellId?: string;
  isa95Level: Isa95Level;
  description: string;
  designCapacity: {
    nominalValue: number;
    unit: string;
    maxSafeValue: number;
    minSafeValue: number;
  };
  technicalSpecs: Record<string, string | number | boolean>;
}

export interface TwinEquipmentState {
  equipmentId: string;
  currentState: EquipmentOperationalState;
  previousState: EquipmentOperationalState;
  stateSince: string;        // ISO-8601
  stateDurationSec: number;
  stateSource: "LIVE_OT" | "SIMULATION_MODEL" | "HEURISTIC" | "OPERATOR_OVERRIDE";
  stateConfidence: number;   // 0.0 to 1.0 (100%)
  operationalReason?: string;
  criticalAlarmActive: boolean;
  activeAlarmsCount: number;
}

export interface TwinSensorDefinition {
  id: string;
  equipmentId: string;
  tagId: string;
  name: string;
  variableName: string;
  measurementType: "TEMPERATURE" | "PRESSURE" | "FLOW" | "VIBRATION" | "LEVEL" | "POWER" | "SPEED" | "BRIX" | "POL" | "MOISTURE";
  engineeringUnit: string;
  plcMemoryAddress: string;
  protocol: IndustrialProtocol;
  scanRateMs: number;
  rangeMin: number;
  rangeMax: number;
  alarmLimits?: {
    lowLow?: number;
    low?: number;
    high?: number;
    highHigh?: number;
  };
}

export interface TwinActuatorDefinition {
  id: string;
  equipmentId: string;
  tagId: string;
  name: string;
  actuatorType: "VFD_MOTOR" | "CONTROL_VALVE" | "SOLENOID" | "TURBINE_GOVERNOR" | "DAMPER";
  engineeringUnit: string;
  controlRange: { min: number; max: number };
  interlockProtected: boolean;
  failsafePosition: "OPEN" | "CLOSED" | "HOLD";
}

// ============================================================================
// 3. FLOW ENTITIES (MATERIAL & ENERGY)
// ============================================================================

export interface ProcessFlowConnection {
  id: string;
  sourceEquipmentId: string;
  targetEquipmentId: string;
  flowType: FlowType;
  materialSubtype?: MaterialSubtype;
  energySubtype?: EnergySubtype;
  nominalRate: number;
  currentRate: number;
  rateUnit: string;
  temperatureC?: number;
  pressureBar?: number;
  qualityMetric?: {
    name: string; // e.g. "Brix", "PCI", "Purity", "Moisture"
    value: number;
    unit: string;
  };
  pipelineOrConveyorTag?: string;
  isActive: boolean;
}

// ============================================================================
// 4. GRAPH & TOPOLOGY CONTRACTS
// ============================================================================

export interface AssetGraphNode {
  id: string;
  label: string;
  category: "AREA" | "PROCESS_CELL" | "EQUIPMENT" | "SENSOR" | "ACTUATOR" | "KPI" | "ALARM";
  status: EquipmentOperationalState | "NORMAL" | "WARNING" | "CRITICAL";
  parentId?: string;
  metadata: Record<string, unknown>;
}

export interface AssetGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType:
    | "CONTAINS"
    | "MEASURES"
    | "CONTROLS"
    | "FEEDS_MATERIAL"
    | "FEEDS_ENERGY"
    | "ASSOCIATED_ALARM"
    | "ASSOCIATED_KPI";
  attributes?: Record<string, unknown>;
}

export interface AssetGraphSnapshot {
  nodes: AssetGraphNode[];
  edges: AssetGraphEdge[];
  updatedAt: string;
}

// ============================================================================
// 5. DATA LINEAGE TRACEABILITY
// ============================================================================

export interface TwinVariableLineage {
  variableName: string;
  currentValue: number | string | boolean;
  unit: string;
  quality: IndustrialDataQuality;
  timestamp: string;
  chain: {
    equipmentName: string;
    equipmentCode: string;
    sensorName: string;
    tagPath: string;
    plcMemoryAddress: string;
    protocol: string;
    driverId: string;
    sourceDevice: string;
    provenance: "LIVE_OT" | "SIMULATED" | "HISTORICAL" | "ESTIMATED";
    deviceClockSyncDeltaMs?: number;
  };
}

// ============================================================================
// 6. WHAT-IF SCENARIOS & SIMULATION MODELS
// ============================================================================

export interface ScenarioParameterOverride {
  parameterKey: "TCH" | "BAGASSE_MOISTURE" | "BOILER_PRESSURE" | "IMBIBITION_RATIO" | "GRID_EXPORT_MW" | "CANE_POL";
  baselineValue: number;
  targetValue: number;
  unit: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  presetCategory?: "STANDARD" | "HIGH_THROUGHPUT" | "MAX_COGEN" | "DEGRADED_FEED" | "ENERGY_EFFICIENCY";
  overrides: ScenarioParameterOverride[];
  createdAt: string;
  createdBy: string;
}

export interface ScenarioComparisonMetric {
  kpiId: string;
  name: string;
  unit: string;
  baseline: number;
  scenario: number;
  deltaAbsolute: number;
  deltaPercent: number;
  impactCategory: "FAVORABLE" | "NEUTRAL" | "UNFAVORABLE" | "SAFETY_ALERT";
  operationalNotes: string;
}

export interface ScenarioRunResult {
  scenarioId: string;
  scenarioName: string;
  executedAt: string;
  comparisonMetrics: ScenarioComparisonMetric[];
  simulatedEquipmentStates: Record<string, EquipmentOperationalState>;
  simulatedFlows: ProcessFlowConnection[];
  potentialAlarms: Array<{
    equipmentId: string;
    tag: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    cause: string;
  }>;
  operationalSummary: string;
}

// ============================================================================
// 7. HISTORICAL REPLAY CONTROLS
// ============================================================================

export interface HistoricalReplayConfig {
  startTimeIso: string;
  endTimeIso: string;
  currentPlaybackTimeIso: string;
  playbackSpeed: 1 | 5 | 10 | 50 | 100;
  status: "STOPPED" | "PLAYING" | "PAUSED";
  bufferPointsLoaded: number;
}

// ============================================================================
// 8. GLOBAL TWIN STATE STORE SNAPSHOT
// ============================================================================

export interface DigitalTwinGlobalState {
  twinId: string;
  plantId: string;
  plantName: string;
  mode: TwinOperationalMode;
  timestamp: string;
  clockDriftMs: number;
  dataQualitySummary: {
    totalTags: number;
    goodCount: number;
    uncertainCount: number;
    badCount: number;
    simulatedCount: number;
    communicationLostCount: number;
    overallQualityPercentage: number;
  };
  equipmentStates: Record<string, TwinEquipmentState>;
  datapoints: Map<string, IndustrialDataPoint>;
  activeAlarms: AlarmEvent[];
  kpis: Map<string, number>;
  flows: ProcessFlowConnection[];
  activeScenario?: ScenarioDefinition;
  replayState?: HistoricalReplayConfig;
  activeEquipmentId?: string;
}
