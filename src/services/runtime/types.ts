import {
  SimulationScenario,
  TelemetryData,
  DataQuality,
  DataSourceType,
  ProtocolType,
  AlarmEvent,
  EquipmentItem,
} from "../../types";

export type RuntimeMode = "SIMULATION" | "LIVE_OT" | "HYBRID" | "HISTORICAL_REPLAY";

export type OTConnectionStatus =
  | "WAITING_FOR_COMMISSIONING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR"
  | "RECONNECTING";

export interface SimulationConfig {
  enabled: boolean;
  scenario: SimulationScenario;
  speedMultiplier: number;
  deterministicSeed?: number;
  autoStart: boolean;
  historianEnabled: boolean;
  alarmGenerationEnabled: boolean;
}

export interface OTConfig {
  endpointUrl: string;
  protocol: ProtocolType;
  securityPolicy: string;
  securityMode: string;
  authMode: string;
  status: OTConnectionStatus;
  reconnectIntervalMs: number;
  lastHeartbeat?: string;
  errorMessage?: string;
  isLiveConnection: boolean;
  connected?: boolean;
}

export interface TenantIdentityConfig {
  name: string;
  code: string;
  country: string;
  region: string;
  address: string;
  timezone: string;
  currency: string;
  language: string;
  contactEmail: string;
  contactPhone: string;
  themeColor: string;
  description?: string;
}

export interface CaneProcessConfig {
  nominalTch: number;
  minTch: number;
  maxTch: number;
  millsCount: number;
  nominalExtraction: number;
  fiberPercent: number;
  nominalBrix: number;
  nominalPol: number;
  nominalPurity: number;
  imbibitionWaterPercent: number;
  recoveryYieldTarget: number;
}

export interface BagasseConfig {
  fiberPercent: number;
  nominalMoisture: number;
  productionFactor: number;
  consumptionFactor: number;
  yardCapacityTons: number;
  initialStockTons: number;
  lhvKcalPerKg: number;
  densityKgM3: number;
}

export interface BoilerConfig {
  count: number;
  manufacturer: string;
  designPressureBar: number;
  designTempC: number;
  steamCapacityTph: number;
  nominalEfficiency: number;
  targetO2Percent: number;
  flueGasTempC: number;
  blowdownPercent: number;
}

export interface TurbineConfig {
  count: number;
  totalPowerMW: number;
  inletPressureBar: number;
  extractionPressureBar: number;
  exhaustPressureBar: number;
  nominalEfficiency: number;
  speedRpm: number;
}

export interface GridConfig {
  installedCapacityMW: number;
  maxExportMW: number;
  gridFrequencyHz: number;
  gridVoltageKV: number;
  targetPowerFactor: number;
  internalConsumptionMW: number;
  ppaTariffUsdPerMWh?: number;
}

export interface SugarConfig {
  productType: string;
  syrupBrixTarget: number;
  sugarYieldPercent: number;
  molassesFactor: number;
}

export interface TagConfiguration {
  tag: string;
  description: string;
  unit: string;
  dataType: "Double" | "Float" | "Integer" | "Boolean" | "String";
  minRange: number;
  maxRange: number;
  warningLow?: number;
  warningHigh?: number;
  alarmLow?: number;
  alarmHigh?: number;
  deadband?: number;
  samplingIntervalMs: number;
  protocol: ProtocolType;
  opcUaNodeId?: string;
  plcAddress?: string;
}

export interface EquipmentConfiguration {
  id: string;
  name: string;
  area: string;
  criticality: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  manufacturer: string;
  model: string;
  vibrationThresholdMmS: number;
  tempThresholdC?: number;
  maintenanceIntervalHours: number;
}

export interface TenantConfiguration {
  identity: TenantIdentityConfig;
  caneProcess: CaneProcessConfig;
  bagasse: BagasseConfig;
  boilers: BoilerConfig;
  turbines: TurbineConfig;
  grid: GridConfig;
  sugar: SugarConfig;
  tags: Record<string, TagConfiguration>;
  equipment: EquipmentConfiguration[];
}

export interface HistorianRecord {
  id?: string;
  timestamp: string;
  tenantId: string;
  tag: string;
  value: number | string | boolean;
  unit: string;
  quality: DataQuality;
  source: DataSourceType;
  provenance: "SIMULATED_PROCESS_MODEL" | "OBSERVED_OT" | "CALCULATED" | "MANUAL_INPUT";
  isSimulated: boolean;
  scenario: SimulationScenario;
  sequence: number;
}

export interface RuntimeStatus {
  tenantId: string;
  tenantName: string;
  mode: RuntimeMode;
  isSimulated: boolean;
  simulationScenario: SimulationScenario;
  simulationRunning: boolean;
  otStatus: OTConnectionStatus;
  otMessage?: string;
  activeAlarmsCount: number;
  telemetryTimestamp: string;
  uptimeSeconds: number;
  historianPointsCount: number;
}
