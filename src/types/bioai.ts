import { DataQuality, DataSourceType, ProtocolType } from "../types";
export type { ProtocolType };

// ============================================================================
// BIOAI INTELLIGENCE ENGINE — CORE DOMAIN TYPES & MODELS
// ============================================================================

export type ProductionPrediction24h = ProductionPredictions;
export type EnergyPrediction24h = EnergyPredictions;
export type EquipmentRiskAssessment = EquipmentRiskItem;

export interface IndustrialGatewayStatus {
  activeChannel: string;
  adapterName: string;
  latencyMs: number | string;
  signalQuality: string;
  packetsPerSec: number;
  totalPacketsReceived: number;
  lastPacketTimestamp: string;
  isSimulated: boolean;
  provenance: string;
  mode: "SIMULATION" | "LIVE_OT" | "HYBRID";
  statusMessage?: string;
  endpointUrl?: string;
}

/**
 * Time-series sample with statistical bounds and prediction metadata
 */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  quality: DataQuality;
  predicted?: boolean;
  lowerConfidence?: number;
  upperConfidence?: number;
  anomalyScore?: number; // 0 to 1
}

/**
 * Industrial Process Variable Time Series
 */
export interface MetricTimeSeries {
  tag: string;
  name: string;
  unit: string;
  area: string;
  currentValue: number;
  baselineMean: number;
  standardDeviation: number;
  trend: "RISING" | "FALLING" | "STABLE" | "OSCILLATING";
  changePercent24h: number;
  history: TimeSeriesPoint[];
  forecast24h: TimeSeriesPoint[];
}

/**
 * MODULE 1: Production Predictive Analytics Model
 */
export interface ProductionPredictions {
  timestamp: string;
  // Cane Milling Forecast
  currentTCH: number;
  predictedTchNext1h: number;
  predictedTchNext8h: number;
  predictedTchNext24h: number;
  caneAccumTodayForecastTons: number;
  // Sucrose Extraction Forecast
  sucroseExtractionCurrent: number; // e.g. 96.4%
  sucroseExtractionForecast: number; // e.g. 96.8%
  extractionDeltaReason: string;
  imbibitionWaterRatioOptimal: number; // % water on cane
  // Factory Sugar Yield & Recovery
  sugarYieldCurrentPercent: number; // e.g. 11.45%
  sugarYieldForecastPercent: number; // e.g. 11.62%
  sugarBagsForecast24h: number; // 50kg bags
  sugarTonsForecast24h: number;
  // Industrial Losses Breakdown (Mass & Pol Balance)
  losses: {
    bagassePolLossPercent: number; // Typical: 2.1 - 2.8%
    filterCakePolLossPercent: number; // Typical: 0.5 - 0.9%
    finalMolassesPolLossPercent: number; // Typical: 6.5 - 8.2%
    undeterminedLossPercent: number; // Typical: 0.4 - 0.8%
    totalPolLossPercent: number;
    trend: "OPTIMIZING" | "DEGRADING" | "NORMAL";
  };
  confidenceScore: number;
  riskOfThroughputDrop: "LOW" | "MODERATE" | "HIGH";
  riskExplanation?: string;
  isSimulated?: boolean;
  provenance?: string;
  origin?: "REAL" | "SIMULATED" | "PREDICTED" | "DEFAULT" | "CALCULATED" | "MIXED" | "IMPORTED" | string;
  dataQualityAudit?: {
    passed: boolean;
    score: number;
    origin: string;
    rejectionReason?: string;
  };
}

/**
 * MODULE 1: Energy & Cogeneration Predictive Analytics Model
 */
export interface EnergyPredictions {
  timestamp: string;
  // Bagasse Fuel Balance
  bagasseGeneratedRateTph: number;
  bagasseBoilerConsumptionTph: number;
  bagasseSurplusStorageTph: number;
  bagasseStockDaysRemaining: number;
  bagasseMoistureCurrent: number; // %
  bagasseMoistureForecast: number; // %
  // Steam Generation (ASME PTC 4)
  boilerPressureHpBar: number;
  steamFlowHpTph: number;
  steamDemandLpProcessTph: number;
  specificSteamConsumptionKgPerKgCane: number; // e.g. 0.42 kg steam/kg cane
  targetSteamConsumptionKgPerKgCane: number; // e.g. 0.38 kg steam/kg cane
  boilerEfficiencyCurrentPercent: number; // e.g. 78.6%
  boilerEfficiencyOptimalPercent: number; // e.g. 82.1%
  lossesBreakdown: {
    moistureInFuelLoss: number; // %
    dryFlueGasLoss: number; // %
    unburnedCarbonLoss: number; // %
    radiationAndConvectionLoss: number; // %
  };
  // Electrical Power & Grid Dispatch (PPA)
  grossPowerGeneratedMW: number;
  internalFactoryDemandMW: number;
  netExportPowerGridMW: number;
  projectedExport24hMWh: number;
  spotPriceUSDPerMWh: number;
  projectedRevenue24hUSD: number;
  energyEfficiencyIndexPercent: number; // e.g. 87.4%
  confidenceScore: number;
  isSimulated?: boolean;
  provenance?: string;
  origin?: "REAL" | "SIMULATED" | "PREDICTED" | "DEFAULT" | "CALCULATED" | "MIXED" | "IMPORTED" | string;
  dataQualityAudit?: {
    passed: boolean;
    score: number;
    origin: string;
    rejectionReason?: string;
  };
}

/**
 * MODULE 1: Equipment Health & Predictive Maintenance Model
 */
export interface EquipmentRiskItem {
  id: string;
  equipmentId?: string;
  name: string;
  code: string;
  area: string;
  criticality: "CRITICO_A" | "ESENCIAL_B" | "ESTANDAR_C";
  healthScore: number; // 0 - 100%
  failureProbability48h: number; // 0 - 100%
  remainingUsefulLifeHours: number;
  primaryStressFactor: string; // e.g. "Desgaste de rodamiento por vibración 2X"
  currentMetrics: {
    vibrationRMS: number;
    vibrationThreshold: number;
    temperatureC: number;
    temperatureThreshold: number;
    loadPercentage: number;
    hoursSinceLastService: number;
  };
  anomalyFlag: boolean;
  recommendedAction: string;
  timeToUrgentMaintenanceHours: number;
  isSimulated?: boolean;
  provenance?: string;
}

/**
 * MODULE 2: AI Root Cause Analysis (RCA) Model
 */
export type RcaCategory =
  | "PRODUCTION_DROP"
  | "ENERGY_CONSUMPTION_SURGE"
  | "CRITICAL_ALARM"
  | "EXTRACTION_LOSS"
  | "UNSCHEDULED_DOWNTIME";

export interface ContributingFactor {
  factor: string;
  category: "MATERIA_PRIMA" | "OPERACION" | "MECANICA" | "TERMODINAMICA" | "CONTROL_INSTRUMENTACION";
  contributionWeightPercent: number; // e.g. 45%
  evidenceTag: string;
  observedValue: string | number;
  expectedBaseline: string | number;
  deviationNote: string;
}

export interface RootCauseAnalysisResult {
  id: string;
  timestamp: string;
  category: RcaCategory;
  title: string;
  query: string;
  executiveSummary: string;
  primaryRootCause: string;
  rootCauseDetailed: string;
  sugarEngineeringMechanism: string; // Thermodynamic / Chemical / Mechanical explanation
  expertRulesFired: string[]; // e.g. ["Ley de Inversión de Sacarosa Spencer-Meade", "Criterio de Imbibición Hugot", "ASME PTC 4 Sección 5"]
  contributingFactors: ContributingFactor[];
  timelineEvents: Array<{
    time: string;
    description: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    tag?: string;
  }>;
  confidenceScore: number;
  correctiveActions: string[];
  preventiveActions: string[];
  financialImpactEstimatedUSD: string;
  isAiGenerated: boolean;
  severity?: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  fiveWhys?: string[];
  immediateAction?: string;
  maintenanceRecommendation?: string;
  estimatedFinancialLoss?: string;
  isSimulated?: boolean;
  provenance?: string;
}

/**
 * MODULE 3: AI Industrial Recommendations Model
 */
export interface IndustrialRecommendation {
  id: string;
  title: string;
  area: "MOLIENDA" | "CALDERA" | "COGENERACION" | "EVAPORACION" | "CRISTALIZACION" | "TRATAMIENTO_AGUA" | "PATIO_CANA";
  priority: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  problemDetected: string;
  recommendedAction: string;
  detailedProcedure: string;
  estimatedImpact: {
    financialUSDPerHour?: number;
    energySavingsMW?: number;
    sugarTonsPerDay?: number;
    downtimeAvoidedHours?: number;
    text: string;
  };
  aiConfidence: number; // e.g. 94%
  status: "PENDING" | "ACCEPTED" | "EXECUTED" | "DISMISSED";
  targetTag?: string;
  proposedSetpoint?: number;
  currentSetpoint?: number;
  unit?: string;
  workOrderDraft?: {
    equipmentId: string;
    equipmentName: string;
    title: string;
    type: "PREDICTIVO" | "PREVENTIVO" | "CORRECTIVO";
    priority: "URGENTE" | "ALTA" | "MEDIA";
    description: string;
  };
  createdAt: string;
  isSimulated?: boolean;
  provenance?: string;
}

/**
 * MODULE 6: Industrial Data Gateway Models
 */
export interface GatewayChannelStatus {
  protocol: ProtocolType;
  channelName: string;
  status: "ONLINE" | "CONNECTING" | "STANDBY" | "ERROR";
  latencyMs: number;
  activeTags: number;
  throughputMsgsPerSec: number;
  errorRatePercent: number;
  bufferQueueCount: number;
  lastPacketTimestamp: string;
  endpointUrl: string;
}

export interface IndustrialDataGatewayState {
  gatewayId: string;
  mode: "HYBRID_EDGE_CLOUD" | "LIVE_OT" | "SIMULATION_REPLAY";
  isHealthy: boolean;
  totalThroughputTagsPerSec: number;
  channels: GatewayChannelStatus[];
  storeAndForwardPendingEvents: number;
  storeAndForwardStorageUsageMB: number;
  lastSyncTimestamp: string;
  activeSecurityStandard: "IEC-62443-SL3" | "TLS-1.3-MTLS" | "SIMULATION-ISOLATED";
}
