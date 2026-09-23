/**
 * BioAzúcar 4.0 — P0-09 BioAI Real Datasets & Provenance Types
 * 
 * Defines the schemas for real industrial sugar mill datasets (Zafra),
 * process drift tracking, thermodynamic calibration results, and
 * immutable provenance metadata.
 */

export interface ZafraHourlyTelemetry {
  timestamp: string;
  dayNumber: number; // Day 1..12+
  shiftId: 'SHIFT_1' | 'SHIFT_2' | 'SHIFT_3';
  hourOfZafra: number; // 1..288

  // Cane Feedstock Quality
  tch: number; // Tons Cane / Hour (e.g., 280.0)
  caneFiberPercent: number; // % (e.g., 13.4)
  canePolPercent: number; // % sucrose (e.g., 14.1)
  caneBrixPercent: number; // % soluble solids (e.g., 19.8)
  canePurityPercent: number; // Pol / Brix * 100

  // Milling Tandem & Extraction
  imbibitionWaterTph: number; // Tons/h (e.g., 85.0)
  imbibitionWaterPercentCane: number; // % (e.g., 30.3)
  hydraulicPressureFrontBar: number; // bar (e.g., 220)
  millSpeedRpm: number; // rpm (e.g., 4.5)
  bagasseMoisturePercent: number; // % (e.g., 49.8)
  bagassePolPercent: number; // % residual sucrose (e.g., 2.15)
  observedExtractionPercent: number; // Sucrose extraction % (e.g., 96.15)

  // Cogeneration Boilers (ASME PTC 4)
  bagasseFeedTph: number; // Tons/h (e.g., 78.5)
  steamFlowTph: number; // Tons/h (e.g., 185.0)
  steamPressureBar: number; // bar (e.g., 44.5)
  steamTemperatureC: number; // °C (e.g., 445.0)
  flueGasTemperatureC: number; // °C (e.g., 172.0)
  flueGasO2Percent: number; // % (e.g., 4.6)
  ambientTemperatureC: number; // °C (e.g., 28.5)
  observedBoilerEfficiencyPercent: number; // % (e.g., 81.6)

  // Turbogeneration
  activePowerMw: number; // MW (e.g., 24.5)
  gridExportMw: number; // MW (e.g., 16.2)
  specificSteamConsumptionKgPerKwh: number; // kg/kWh (e.g., 5.42)
}

export interface ZafraDatasetMetadata {
  datasetId: string;
  datasetName: string;
  millOrigin: string; // Anonymized Latin American mill (e.g., "INGENIO_PILOTO_VALLE_01")
  zafraPeriod: string; // e.g. "Zafra 2025/2026"
  totalDays: number; // >= 10 days
  totalRecords: number; // Hourly samples (e.g., 288)
  sha256ProvenanceHash: string;
  anonymizationProtocol: 'HIPAA_FERPA_EQUIVALENT_INDUSTRIAL_OT_ANON';
  version: string;
  collectedAt: string;
  verifiedBy: string;
}

export interface CalibrationPerformanceMetrics {
  meanAbsolutePercentageError: number; // MAPE in % (Target: < 3.5%)
  meanAbsoluteError: number; // MAE
  rootMeanSquaredError: number; // RMSE
  rSquared: number; // Coefficient of determination (0..1)
  sampleCount: number;
}

export interface CalibratedPhysicsModels {
  datasetId: string;
  calibratedAt: string;
  provenanceHash: string;
  trainTestSplitRatio: number; // e.g. 0.80

  // 1. Hugot Extraction Model
  hugotExtraction: {
    calibratedKw: number; // Optimal compound imbibition factor
    dryExtractionE0: number; // Base extraction without water
    trainMetrics: CalibrationPerformanceMetrics;
    testMetrics: CalibrationPerformanceMetrics;
  };

  // 2. ASME PTC 4 Boiler Loss Model
  asmeBoiler: {
    calibratedRadiationLossPercent: number;
    calibratedUnburnedCarbonLossPercent: number;
    calibratedDryGasLossCoeff: number;
    trainMetrics: CalibrationPerformanceMetrics;
    testMetrics: CalibrationPerformanceMetrics;
  };

  // 3. Turbogeneration Specific Consumption Model
  turbogeneration: {
    isentropicEfficiencyPercent: number;
    baselineSpecificConsumption: number;
    trainMetrics: CalibrationPerformanceMetrics;
    testMetrics: CalibrationPerformanceMetrics;
  };

  // Process Drift Diagnosis
  processDrift: {
    extractionDriftPercentPerDay: number;
    boilerEfficiencyDriftPercentPerDay: number;
    rollerWearIndicatorPercent: number;
    boilerFoulingIndicatorPercent: number;
    hasSignificantDrift: boolean;
    driftDiagnosisSummary: string;
  };

  complianceStatus: {
    meetsMapeTarget: boolean; // Must be true (< 3.5%)
    meetsTenDaysRequirement: boolean; // Must be true (days >= 10)
    auditCertification: string;
  };
}
