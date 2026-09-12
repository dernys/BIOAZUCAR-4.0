/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning (ISA-95 Level 4 / MOM)
 * Canonical Types, Dimensions and Traceability for Cane Agronomy and Field Operations.
 * 
 * Derived directly from the reverse engineering of the Cane Planning Model (PDA_SET30 / TCH / EVOLUÇÃO).
 */

/**
 * Data Governance Classification (Mandatory Governance)
 */
export type DataClassification =
  | "MASTER_DATA"       // Variedades, Maquinaria, Catálogo de Operaciones, Insumos
  | "CONFIGURATION"     // Parámetros agronómicos, factores de suelo, umbrales
  | "OPERATIONAL_DATA"   // Estado de parcelas, órdenes de trabajo, despachos
  | "OBSERVED_DATA"      // Mediciones de campo, análisis de laboratorio LIMS, pesajes báscula
  | "DERIVED_DATA";      // TCH proyectado, balance de flota, requerimiento diario

/**
 * Data Origin / Provenance
 */
export type DataOrigin =
  | "USER_ENTRY"
  | "FIELD_MEASUREMENT"
  | "ERP"
  | "SCADA"
  | "IMPORT"
  | "CALCULATED"
  | "SYSTEM_DEFAULT";

/**
 * Data Quality Governance Status
 */
export type DataQuality =
  | "COMPLETE"
  | "INCOMPLETE"
  | "UNVERIFIED"
  | "VALIDATED"
  | "APPROVED"
  | "REJECTED";

/**
 * Persistence & Explicit Offline Synchronization Status
 */
export type SyncStatus =
  | "LOCAL_DRAFT"
  | "SYNCING"
  | "SYNCED"
  | "SYNC_ERROR"
  | "OFFLINE";

/**
 * Calculation Execution Status (No invented numbers on missing data)
 */
export type CalculationStatus =
  | "COMPUTED"
  | "MISSING_INPUT"
  | "INVALID_INPUT"
  | "INSUFFICIENT_DATA";

/**
 * Standard Agronomic Engineering Units
 */
export type AgroUnit =
  | "ha"
  | "t"
  | "t/ha"
  | "kg/ha"
  | "L/ha"
  | "m3/ha"
  | "km"
  | "%"
  | "USD"
  | "USD/t"
  | "USD/L"
  | "USD/kg"
  | "horas"
  | "ha/h"
  | "L/h"
  | "días"
  | "HP"
  | "ratio"
  | "object"
  | "unit";

/**
 * Cane Growth Stage / Vegetative Cycle
 * Represents the chronological cutting cycle from initial planting to demolition.
 * Source: ODS Sheets 'EVOLUÇÃO tch por cepa', 'TCH', 'PDA_SET30'
 */
export type CaneGrowthStage =
  | "PLANTA"        // Caña Planta (1st cycle: 12-18 months)
  | "SOCA"          // Soca / 1st ratoon (cut 1)
  | "RETONO_Q2"     // Retoño 2 (cut 2)
  | "RETONO_Q3"     // Retoño 3 (cut 3)
  | "RETONO_Q4"     // Retoño 4 (cut 4)
  | "RETONO_Q5"     // Retoño 5 (cut 5)
  | "RETONO_Q6"     // Retoño 6 (cut 6)
  | "RETONO_Q7_PLUS"// Retoño 7+ (aged cane, high fiber, low yield)
  | "DEMOLICION";   // Scheduled for demolition / soil renovation

export type SoilType = "ARCILLOSO" | "FRANCO" | "ARENOSO";

export type MaturityType = "TEMPRANA" | "MEDIA" | "TARDIA";

export type FieldPlotStatus =
  | "VEGETACION"
  | "MADURACION"
  | "COSECHADO"
  | "EN_PREPARACION"
  | "PLANTADO";

export type AgroOperationCategory =
  | "PREPARO_SOLO"
  | "PLANTIO"
  | "TRATOS_CULTURAIS"
  | "COLHEITA"
  | "TRANSPORTE";

export type AgroModelType = "PDA_VALIDATED" | "BIOAZUCAR_MODEL" | "WHAT_IF_SCENARIO";

export type ParameterValidationStatus =
  | "PDA_VALIDATED"
  | "CONFIGURABLE"
  | "DERIVED"
  | "BIOAZUCAR_MODEL"
  | "REQUIRES_VALIDATION"
  | "CONFIRMADO"
  | "PDA_VERIFIED"
  | "CURRENT_ASSUMPTION"
  | "REQUIERE_VALIDACION"
  | "INVALID_SOURCE"
  | "ACTIVE"
  | "ARCHIVED";

export type ValidationStatus = "CONFIRMADO" | "REQUIERE_VALIDACION" | "CONFIGURABLE";

export type ParameterCategory =
  | "VARIETY_DECAY"
  | "SOIL_FACTORS"
  | "AGRO_OPERATIONS"
  | "HARVEST_CCT"
  | "ECONOMIC_PRICES"
  | "INPUTS_BYPRODUCTS"
  | "THRESHOLDS";

export type AgroParameterCategory =
  | "VARIEDAD"
  | "SUELO"
  | "PREPARACION_SUELO"
  | "PLANTIO"
  | "TRATOS_CULTURALES"
  | "MAQUINARIA"
  | "CCT_LOGISTICA"
  | "ECONOMIA"
  | ParameterCategory;

export type ParameterValueType = "numeric" | "factor" | "rate" | "currency" | "text" | "object" | "boolean";

export interface AgriculturalParameter {
  id: string;
  tenantId: string;
  category: AgroParameterCategory;
  name: string;
  key: string;
  value: number | string | boolean | Record<string, any>;
  unit: AgroUnit | string;
  type?: ParameterValueType;
  description?: string;
  version: string;             // e.g. "1.0.0"
  status?: ParameterValidationStatus;
  validity?: string;           // e.g. "Vigente 2026/2027", "Permanente"
  effectiveFrom: string;
  effectiveTo?: string;
  provenanceDoc?: string;      // Documentary history metadata, e.g. "Estudio Agronómico PDA 2014"
  historicReference?: string;  // Non-operative historical note
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
  changeReason?: string;
  notes?: string;
  // Governance & Quality
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
  // Backward compatibility fields (non-operative metadata)
  source?: string;
  sourceSheet?: string;
  sourceCell?: string;
  sourceCells?: string;
  validationStatus?: ValidationStatus | ParameterValidationStatus;
}

/**
 * Sovereign Internal Calculation Lineage (ISA-95 Level 4 / MOM)
 * Trace chain: Entrada → Parámetros → Fórmula → Versión del modelo → Resultado → Unidad → Campaña → Escenario → Usuario → Fecha.
 * Completely autonomous and independent from external files.
 */
export interface CalculationTrace {
  formulaId: string;
  formulaName?: string;
  formulaExpression?: string;
  modelType?: AgroModelType;
  modelVersion?: string;
  campaignId?: string;
  scenario?: string;
  user?: string;
  calculatedAt: string;
  status?: CalculationStatus;
  missingInputs?: string[];
  inputs: Record<string, { value: number | string | boolean; unit: AgroUnit | string; description?: string; parameterKey?: string; source?: string; validationStatus?: ParameterValidationStatus }>;
  parameters?: Array<{
    key: string;
    value: any;
    unit: AgroUnit | string;
    version?: string;
    status?: ParameterValidationStatus;
    category?: AgroParameterCategory;
    provenanceDoc?: string;
    validationStatus?: ParameterValidationStatus;
    sourceSheet?: string;
  }>;
  result?: { value: number | string; unit: AgroUnit | string };
  provenance?: {
    documentSource?: string;
    historicReference?: string;
  };
  // Backward compatibility fields
  formula?: string;
  sourceSheet?: string;
  sourceCells?: string;
  modelRevision?: string;
}

/**
 * Cane Variety Master Data with decay retention curve
 * Source: ODS 'TCH' & 'EVOLUÇÃO tch por cepa'
 */
export interface CaneVarietyYieldMaster {
  varietyCode: string;             // e.g. "RB86-7515", "SP80-3280", "CTC-4"
  name: string;
  cycleLengthMonths: number;        // e.g. 12 to 18
  baseYieldTch: number;             // Base yield in Planta (t/ha)
  polPercent: number;               // Apparent sucrose % (Pol % caña)
  fiberPercent: number;             // Fiber % (fibra % caña)
  purityPercent: number;            // Juice purity %
  maturity: MaturityType;
  // Decay factors relative to Planta (1.00)
  ratoonDecayFactors: Record<CaneGrowthStage, number>;
  // Governance
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
}

/**
 * Field Plot Entity (Lote de Caña)
 * Represents an individual physical agricultural unit.
 * Source: ODS 'PDA_SET30', 'Áreas PS e PL'
 */
export interface FieldPlot {
  id: string;
  tenantId: string;
  code: string;                     // e.g. "LOTE-N04", "CAMPO-012"
  uebName: string;                  // Agricultural unit / division name
  areaHectares: number;             // Surface area in ha
  areaUnit?: "ha";
  varietyCode: string;              // Foreign key to CaneVarietyYieldMaster
  currentStage: CaneGrowthStage;
  ratoonAgeYears: number;           // Chronological age
  soilType: SoilType;
  distanceToMillKm: number;         // Distance to sugar mill weighbridge (km)
  distanceUnit?: "km";
  historicalAverageTch: number;     // Historical multi-campaign average (t/ha)
  projectedTch: number;             // Calculated expected TCH (t/ha)
  tchUnit?: "t/ha";
  projectedTotalCaneTons: number;   // areaHectares * projectedTch (t)
  tonsUnit?: "t";
  scheduledHarvestMonth: number;    // Harvest calendar slot (1-12)
  status: FieldPlotStatus;
  agronomicModel?: AgroModelType;
  trace?: CalculationTrace;
  createdAt?: string;
  updatedAt?: string;
  // Governance & Sync
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
}

/**
 * Agricultural Campaign / Zafra Parameters
 * Canonical campaign operational baseline
 */
export interface AgriculturalCampaign {
  id: string;
  tenantId: string;
  name: string;                     // e.g. "Zafra 2026/2027"
  calendarDays: number;             // Total calendar window (days)
  effectiveHarvestDays: number;     // Effective cutting days (days - rain/stops)
  totalAreaHectares: number;        // Total registered arable surface (ha)
  renewalTargetPercent: number;     // Target annual renewal (e.g. 15-18%)
  projectedTotalCaneTons: number;   // Sum of plot production (t)
  dailyHarvestRequirementTons: number; // projectedTotalCaneTons / effectiveHarvestDays (t/day)
  averageTchCampaign: number;       // Weighted average TCH (t/ha)
  sugarTargetTons: number;          // Target sugar production (t)
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  // Units contract
  areaUnit?: "ha";
  millingUnit?: "t";
  sugarUnit?: "t";
  // UI aliases & canonical compatibility
  targetMillingTons?: number;
  targetSugarTons?: number;
  plannedRenovationRatePercent?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  // Governance & Sync
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
}

/**
 * Yield Scenario Simulation Parameters (What-If)
 */
export interface YieldScenarioParams {
  name: string;
  modelType?: AgroModelType;
  tchVariationPercent?: number;     // e.g. -10 for -10% TCH drought
  areaVariationPercent?: number;    // e.g. +5 for expanded area
  climateFactor?: number;           // Multiplier: 0.85 (drought) to 1.10 (favorable)
  minEconomicTchThreshold?: number; // TCH below which demolition is recommended (default ~55 t/ha)
}

/**
 * Aggregated Yield Calculation Result with Stage Breakdown
 */
export interface YieldCalculationResult {
  plots: FieldPlot[];
  totalAreaHa: number;
  totalProductionTons: number;
  averageTch: number;
  areaByStage: Record<CaneGrowthStage, number>;
  productionByStageTons: Record<CaneGrowthStage, number>;
  demolitionAreaHa: number;
  trace: CalculationTrace;
}

/**
 * Agricultural Operation Specification
 * Source: ODS Sheets 'Áreas PS_operações', 'TRATOSequipos', 'PLANTIO'
 */
export interface AgroOperationMaster {
  id: string;
  tenantId?: string;
  category: AgroOperationCategory;
  name: string;                         // e.g. "Subsolado Profundo 50cm", "Plantío Mecanizado"
  standardTractorPowerHp: number;        // Required tractor power (HP)
  standardImplement: string;             // e.g. "Subsolador 5 Astes", "Plantadora 2 Líneas"
  effectiveCapacityHaPerHour: number;    // Field effective capacity (ha/h)
  fuelConsumptionLitersPerHour: number; // Diesel consumption (L/h)
  targetCycle: "PRE_PLANTIO" | "PLANTA" | "SOCA_RETONO" | "ALL";
  operatorCount: number;                 // Personnel required per machine
  status?: "ACTIVO" | "INACTIVO" | "ARCHIVADO";
  description?: string;
  // Governance & Sync
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
}

/**
 * Soil Preparation Schedule & Operations Workload
 * Source: ODS Sheets 'Áreas PS e PL', 'Áreas PS_operações'
 */
export interface SoilPreparationWorkloadItem {
  operation: AgroOperationMaster;
  targetAreaHectares: number;
  requiredMachineHours: number;         // targetAreaHectares / effectiveCapacityHaPerHour
  requiredDieselLiters: number;         // requiredMachineHours * fuelConsumptionLitersPerHour
  requiredWorkDays: number;             // requiredMachineHours / (dailyHours * mechanicalAvailability)
  requiredMachines: number;
  trace: CalculationTrace;
}

export interface SoilPreparationPlan {
  tenantId: string;
  campaignId: string;
  totalPreparationAreaHa: number;
  workloadItems: SoilPreparationWorkloadItem[];
  totalMachineHours: number;
  totalDieselLiters: number;
  estimatedLaborDays: number;
  trace: CalculationTrace;
}

/**
 * Planting Operation Plan (Siembra Mecanizada)
 * Source: ODS Sheet 'PLANTIO'
 */
export interface PlantingPlan {
  tenantId: string;
  campaignId: string;
  targetPlantingAreaHa: number;
  seedCaneRateTonsPerHa: number;        // Typically 12-15 t/ha
  totalSeedCaneRequiredTons: number;    // targetPlantingAreaHa * seedCaneRateTonsPerHa
  dedicatedSeedCaneAreaHa: number;      // Area of nursery cane harvested for seed
  effectivePlantingCapacityHaPerHour: number; // ~0.75 ha/h
  requiredMachineHours: number;
  requiredDieselLiters: number;
  fertilizerAtFurrowKgPerHa: number;    // Furrow basal fertilizer (e.g. 400 kg/ha NPK)
  totalBasalFertilizerTons: number;
  trace: CalculationTrace;
}

/**
 * Cultural Treatment Plan (Caña Planta vs Socas/Retoños)
 * Source: ODS Sheets 'TRATOS PLANTA', 'TRATOS SOCAeRETONOS'
 */
export interface CulturalTreatmentWorkloadItem {
  targetStage: "PLANTA" | "SOCA_RETONO";
  operationName: string;
  targetAreaHa: number;
  effectiveCapacityHaPerHour: number;
  requiredMachineHours: number;
  fuelConsumptionLitersPerHour: number;
  requiredDieselLiters: number;
  inputProduct?: string;
  inputDosagePerHa?: number;
  inputUnit?: string;
  totalInputQuantity?: number;
  usesIndustrialSubproduct?: boolean;   // e.g. Factory Vinasse or Filter Cake (Cachaza)
}

export interface CulturalTreatmentPlan {
  tenantId: string;
  campaignId: string;
  plantCaneAreaHa: number;
  ratoonCaneAreaHa: number;
  treatmentItems: CulturalTreatmentWorkloadItem[];
  totalMachineHours: number;
  totalDieselLiters: number;
  vinasseAppliedM3: number;             // Industrial vinasse recycled from distillation/milling
  filterCakeAppliedTons: number;        // Filter cake (cachaza) recycled from clarification
  trace: CalculationTrace;
}

/**
 * Equipment Classification for Agricultural Fleet
 * Source: ODS Sheets 'Equipamentos_base/DIN', 'EQUIPAos_RESUMO'
 */
export type EquipmentCategory =
  | "TRACTOR_PESADO"          // > 200 HP (Subsolado, roturación)
  | "TRACTOR_MEDIO"           // 140-199 HP (Gradas, plantío, transporte interno)
  | "TRACTOR_LIGERO"          // 90-139 HP (Pulverización, cultivo, fertilización)
  | "COSECHADORA_COMBINADA"   // 330-380 HP (Cosechadora de caña picada)
  | "TRACTOR_TRANSBORDO"      // 180-210 HP + Vagón de transbordo 10-14 t
  | "CAMION_CANERO_RODOVIARIO"// Camión articulado / Tri-tren cañero (45-60 t)
  | "IMPLEMENTO_AGRICOLA";

export interface AgriculturalEquipmentAsset {
  id: string;
  tenantId: string;
  code: string;                       // e.g. "TR-210-04", "CH-350-01"
  name: string;
  category: EquipmentCategory;
  model?: string;
  modelYear?: number;
  engineHp?: number;
  powerHp?: number;
  acquisitionYear?: number;
  estimatedUsefulLifeYears?: number;
  nominalCapacity?: number;
  capacityUnit?: string;
  payloadCapacityTons?: number;
  mechanicalAvailability?: number;
  mechanicalAvailabilityPercent?: number; // e.g. 85.0
  hourlyFuelConsumptionLiters?: number;
  fuelConsumptionLitersPerHour?: number;
  accumulatedHours?: number;
  accumulatedEngineHours?: number;
  hourlyOperatingCostUSD?: number;
  status: "OPERATIONAL" | "MAINTENANCE" | "STANDBY" | "DECOMMISSIONED" | "ARCHIVED" | "OPERATIVO" | "MANTENIMIENTO";
  notes?: string;
  description?: string;
  updatedAt?: string;
  // Governance & Sync
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
}

/**
 * Fleet Dimensioning Balance Item
 * Compares required hours with available calendar hours to detect deficits.
 * Source: ODS Sheets 'Equipamentos PS_CALCULOS', 'Equipamentos PS_COMPRAS'
 */
export interface MachineryFleetBalanceItem {
  category: EquipmentCategory;
  description: string;
  totalWorkloadHours: number;
  workingWindowDays: number;
  dailyOperatingHours: number;        // Typically 16 to 20 h/day in harvest/prep
  mechanicalAvailabilityRatio: number;// e.g. 0.85
  fleetRequiredUnits: number;         // Ceil(Hours / (Days * DailyHours * Avail))
  fleetAvailableUnits: number;
  fleetDeficitUnits: number;          // Max(0, Required - Available)
  unitAcquisitionPriceUSD: number;
  totalAcquisitionCapexUSD: number;   // Deficit * UnitPrice
  trace: CalculationTrace;
}

export interface MachineryFleetPlan {
  tenantId: string;
  campaignId: string;
  balanceItems: MachineryFleetBalanceItem[];
  totalFleetRequired: number;
  totalFleetAvailable: number;
  totalFleetDeficit: number;
  totalAcquisitionCapexUSD: number;
  trace: CalculationTrace;
}

/**
 * Harvest Front & CCT Transport Cycle Logistics
 * Source: ODS Sheets 'COLHEITA', 'CCT_pessoas'
 */
export interface HarvestFrontConfig {
  id: string;
  code: string;                       // e.g. "FRENTE-01"
  name: string;
  assignedPlots: string[];            // Plot IDs
  dailyTonsTarget: number;            // e.g. 2,500 t/day
  harvesterCount: number;             // Number of combine harvesters assigned
  transloaderCount: number;           // Number of infield transloaders
  averageDistanceToMillKm: number;
  roadTypeQuality: "PAVIMENTADO" | "TERRAPLEN_BUENO" | "TIERRA_DIFICIL";
}

export interface CctTransportCycleCalculation {
  roundTripDistanceKm: number;
  averageSpeedEmptyKmH: number;       // e.g. 45 km/h
  averageSpeedLoadedKmH: number;      // e.g. 30 km/h
  transitTimeHours: number;           // (Distance / SpeedEmpty) + (Distance / SpeedLoaded)
  loadingInFieldTimeHours: number;    // e.g. 0.45 h (27 min)
  unloadingAtMillTimeHours: number;   // e.g. 0.35 h (21 min)
  fieldQueueTimeHours: number;        // e.g. 0.20 h
  millWeighbridgeQueueTimeHours: number; // e.g. 0.25 h
  totalCycleTimeHours: number;
  effectiveTripsPerTruckDay: number;  // (24h * UtilizationFactor) / totalCycleTimeHours
  payloadTonsPerTruck: number;        // e.g. 45.0 t (Bi-tren / Tri-tren)
  dailyCapacityPerTruckTons: number;  // effectiveTrips * payload
  trucksRequiredForDailyDemand: number;// Ceil(DailyHarvestTons / DailyCapacityPerTruck)
  trace: CalculationTrace;
}

/**
 * Agro-Economics & OPEX / CAPEX Consolidation
 * Source: ODS Sheets 'OPEX', 'CAPEX', 'resumo CAPEX', 'DIESEL e LUBR', 'FERTILIZANTES', 'INSUMOS', 'RESUMO PESSOAS'
 */
export interface AgroOpexCostBreakdown {
  fuelDieselCostUSD: number;           // Liters * DieselPriceUSD
  fertilizersAndAmendmentsCostUSD: number; // Tons * FertilizerPriceUSD
  agrochemicalsAndDefensivesCostUSD: number;
  machineryMaintenanceCostUSD: number; // Spare parts, wear parts, filters, oils
  workforceLaborCostUSD: number;       // Direct machine operators, drivers & field staff
  otherOperationalCostsUSD: number;   // Field road maintenance, transport permits
  totalOpexUSD: number;
  costPerHectareUSD: number;           // totalOpexUSD / totalArableAreaHa
  costPerTonCaneUSD: number;           // totalOpexUSD / totalCaneTonsDelivered
}

export interface AgroCapexCostBreakdown {
  machineryAcquisitionUSD: number;     // Fleet balance deficit investments
  agriculturalInfrastructureUSD: number;// Workshops, vinasse tanks, mobile service units
  soilImprovementAndRenovationUSD: number;// Heavy drainage, stone removal, lime base
  totalCapexUSD: number;
}

export interface AgroEconomicsSummary {
  tenantId: string;
  campaignId: string;
  currency: string;
  dieselPricePerLiterUSD: number;      // Benchmark ~$0.95 USD/L
  totalDieselConsumedLiters: number;
  totalCaneTonsDelivered: number;
  totalArableAreaHa: number;
  opex: AgroOpexCostBreakdown;
  capex: AgroCapexCostBreakdown;
  trace: CalculationTrace;
}

/**
 * Internal Sovereign Mathematical Formula & Model Governance
 * Clean separation between canonical validated model, BioAzúcar 4.0 predictive model,
 * and what-if simulation models.
 */
export type PdaFormulaStatus =
  | "PDA_VALIDATED"
  | "PDA_VERIFIED"
  | "CONFIGURABLE"
  | "DERIVED"
  | "BIOAZUCAR_MODEL"
  | "REQUIRES_VALIDATION"
  | "INVALID_SOURCE";

export type PdaModelOrigin =
  | "PDA_2014"             // Modelo agronómico canónico histórico
  | "BIOAZUCAR_4_0";       // Modelo predictivo / mejora analítica multivariante BioAzúcar 4.0

export interface PdaFormulaVariable {
  name: string;
  symbol: string;
  unit: string;
  description: string;
  moduleCategory?: string;
  sourceSheet?: string;    // Deprecated historical reference
  defaultValue?: number | string;
}

export interface PdaFormulaAuditEntry {
  version: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  previousExpression?: string;
}

export interface PdaFormulaMaster {
  formulaId: string;           // Canonical internal ID (e.g. "TCH_PROYECTADO_V1", "AREA_FINAL_V1")
  name: string;
  version: string;
  status: PdaFormulaStatus | ParameterValidationStatus;
  modelOrigin: PdaModelOrigin;
  expression: string;
  variables: PdaFormulaVariable[];
  units: string;
  description?: string;
  moduleCategory?: string;
  rules?: string[];
  provenanceDoc?: string;      // Documentary history metadata
  historicReference?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isEditable: boolean;
  notes?: string;
  auditHistory?: PdaFormulaAuditEntry[];
  // Deprecated backward compatibility fields
  sourceDoc?: string;
  sourceSheet?: string;
  sourceRange?: string;
  provenance?: string;
}

export type InternalAgroFormula = PdaFormulaMaster;

/**
 * Reusable Agricultural Reporting Types
 */
export type PdaReportType =
  | "MASTER_PDA"
  | "AREA_BALANCE"
  | "RENOVATION_PLANTING"
  | "SOIL_PREP"
  | "TREATMENTS_INPUTS"
  | "PRODUCTION_TCH"
  | "HARVEST"
  | "MACHINERY"
  | "CCT_LOGISTICS"
  | "FUEL_DIESEL"
  | "COSTS_OPEX_CAPEX"
  | "CAMPAIGN_SCENARIO_COMPARISON"
  | "FORMULAS_PARAMETERS_TRACE"
  | "CAMPAIGN_SUMMARY"
  | "AGRICULTURAL_KPIS"
  | "EXECUTION_VS_PLAN";

export interface PdaReportFilterOptions {
  campaignId?: string;
  period?: string;
  uebName?: string;
  plotCode?: string;
  varietyCode?: string;
  operationCategory?: string;
  scenarioId?: string;
}

export interface PdaReportKpi {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
}

export interface PdaReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

export interface PdaReportMetadata {
  reportId: string;
  reportType: PdaReportType;
  title: string;
  subtitle?: string;
  campaignId: string;
  campaignName: string;
  tenantId: string;
  generatedAt: string;
  generatedBy: string;
  modelRevision: string;
}

export interface PdaReportResult {
  metadata: PdaReportMetadata;
  summaryKpis: PdaReportKpi[];
  columns: PdaReportColumn[];
  rows: Record<string, any>[];
  traceNotes?: string[];
}

/**
 * Historical Audit Change Log (ISA-95 Level 4)
 * qué cambió → valor anterior → valor nuevo → usuario → fecha → motivo → versión → campaña afectada
 */
export interface AgriculturalAuditChangeRecord {
  id: string;
  auditId?: string;
  tenantId: string;
  campaignId?: string;
  entityType:
    | "CAMPAIGN"
    | "PLOT"
    | "VARIETY"
    | "OPERATION"
    | "PARAMETER"
    | "FORMULA"
    | "EQUIPMENT"
    | "INPUT"
    | "PRICE"
    | "SCENARIO";
  entityId: string;
  entityName?: string;
  fieldChanged: string;
  previousValue: any;
  newValue: any;
  user: string;
  actorUid?: string;
  actorRole?: string;
  operation?: "CREATE" | "UPDATE" | "DELETE" | "ARCHIVE" | "SYNC" | "VALIDATE";
  timestamp: string;
  reason: string;
  source?: string;
  correlationId?: string;
  version: string;
}

/**
 * Agricultural Input & Dosing Master Data (Insumos y Dosis)
 */
export interface AgriculturalInputMaster {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: "FERTILIZANTE" | "ENMIENDA" | "HERBICIDA" | "SUBPRODUCTO" | "COMBUSTIBLE" | "SEMILLA";
  standardDosePerHa: number;
  unit: AgroUnit | string;
  unitCostUSD: number;
  targetCycle: "PREPARACION" | "PLANTACION" | "TRATOS_PLANTA" | "TRATOS_SOCA" | "GENERAL";
  status: "ACTIVO" | "INACTIVO" | "ARCHIVADO";
  description?: string;
  supplier?: string;
  activeIngredient?: string;
  updatedAt?: string;
  // Governance & Sync
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
}

/**
 * Agricultural Scenario Master (Escenarios Agrícolas What-If)
 */
export interface AgriculturalScenario {
  id: string;
  tenantId: string;
  campaignId: string;
  name: string;
  description: string;
  climateFactor: number;
  dieselPriceUSD: number;
  sugarPriceUSDPerTon?: number;
  avgTransportDistanceKm?: number;
  millingCapacityTcd?: number;
  isBaseline?: boolean;
  estimatedOpexTotalUSD?: number;
  cctDistanceKm?: number;
  renewalTargetPercent?: number;
  tchVariationPercent?: number;
  areaVariationPercent?: number;
  status?: "ACTIVO" | "ARCHIVADO";
  createdAt?: string;
  updatedAt?: string;
  projectedTch?: number;
  projectedProductionTons?: number;
  projectedCostPerTonUSD?: number;
  projectedTrucksRequired?: number;
  trace?: CalculationTrace;
  // Governance & Sync
  dataClassification?: DataClassification;
  dataOrigin?: DataOrigin;
  dataQuality?: DataQuality;
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: string;
}

/**
 * Agronomic Intelligent Alert & Recommendation
 */
export interface AgronomicAlert {
  id: string;
  type: "WARNING" | "CRITICAL" | "INFO" | "SUCCESS";
  category: "RENDIMIENTO" | "SUELO" | "MAQUINARIA" | "LOGISTICA" | "COSTES" | "GOBERNANZA";
  title: string;
  description: string;
  affectedEntityId?: string;
  affectedEntityType?: string;
  metricValue?: string | number;
  threshold?: string | number;
  recommendation: string;
  timestamp: string;
}

/**
 * Operational Execution Metric (Plan vs Real)
 */
export interface AgroPlanExecutionMetric {
  category: "AREAS" | "PREPARACION" | "SIEMBRA" | "TRATAMIENTOS" | "COSECHA" | "COMBUSTIBLE" | "COSTES";
  concept: string;
  plannedValue: number;
  executedValue: number;
  unit: string;
  deviationPercent: number;
  status: "OPTIMO" | "ATENCION" | "CRITICO";
}




