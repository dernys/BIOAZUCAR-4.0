/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — DIGITAL TWIN ASSET CATALOG & FLOW CONNECTIONS
 * Unified Asset Topology for Integrated Sugar Mill & Biomass Cogeneration
 * ============================================================================
 */

import {
  TwinAssetMetadata,
  TwinSensorDefinition,
  TwinActuatorDefinition,
  ProcessFlowConnection,
} from "./DigitalTwinTypes";

// ============================================================================
// 1. ASSET DEFINITIONS (SUGAR MILL & COGENERATION ASSET TREE)
// ============================================================================

export const CANONICAL_TWIN_ASSETS: TwinAssetMetadata[] = [
  // --- ÁREA BATEY & RECEPCIÓN ---
  {
    id: "eq-patio-cana",
    code: "REC-PAT-001",
    name: "Básculas de Batey & Mesa Alimentadora",
    areaId: "AREA_RECEPCION_BATEY",
    processCellId: "CELL_BATEY_RECEPCION",
    isa95Level: "EQUIPMENT",
    description: "Básculas electrónicas de plataforma de 80 t, volcadores laterales de camiones y mesa de alimentación de 45° con rastrillo dosificador.",
    designCapacity: {
      nominalValue: 450,
      unit: "TCH",
      maxSafeValue: 550,
      minSafeValue: 150,
    },
    technicalSpecs: {
      tableWidthMeters: 6.5,
      motorPowerKw: 75,
      tiltAngleDeg: 45,
      truckDumpingCycleMin: 4.5,
    },
  },

  // --- ÁREA PREPARACIÓN DE CAÑA ---
  {
    id: "eq-preparacion",
    code: "PREP-SHR-002",
    name: "Picadoras & Desfibrador Heavy-Duty",
    areaId: "AREA_MOLIENDA",
    processCellId: "CELL_TANDEM_MOLINOS",
    isa95Level: "EQUIPMENT",
    description: "Estación de preparación mecánica de caña con cuchilla niveladora, picadora oscilante de 600 rpm y desfibrador de martillos de 1200 rpm impulsado por turbina de vapor.",
    designCapacity: {
      nominalValue: 450,
      unit: "TCH",
      maxSafeValue: 520,
      minSafeValue: 200,
    },
    technicalSpecs: {
      openCellIndexTargetPercent: 88.5,
      shredderDriveType: "TURBINE_STEAM_2500HP",
      hammersCount: 84,
      rotorSpeedRpm: 1180,
    },
  },

  // --- ÁREA MOLIENDA (TÁNDEM) ---
  {
    id: "eq-molino-1",
    code: "MOL-T1-01",
    name: "Molino 1 (Extractor Primario)",
    areaId: "AREA_MOLIENDA",
    processCellId: "CELL_TANDEM_MOLINOS",
    isa95Level: "EQUIPMENT",
    description: "Molino de 4 masas de 42x84 pulgadas con desmenuzadora integrada, cilindro hidráulico Edwards de presión constante.",
    designCapacity: {
      nominalValue: 450,
      unit: "TCH",
      maxSafeValue: 500,
      minSafeValue: 250,
    },
    technicalSpecs: {
      rollerDimensions: "42x84 in",
      hydraulicPressureBar: 240,
      millDriveKw: 900,
      nominalSpeedRpm: 4.5,
    },
  },
  {
    id: "eq-molino-3",
    code: "MOL-T1-03",
    name: "Molino 3 (Despresurización Intermedia)",
    areaId: "AREA_MOLIENDA",
    processCellId: "CELL_TANDEM_MOLINOS",
    isa95Level: "EQUIPMENT",
    description: "Molino de 4 masas intermedio con sistema de monitoreo continuo de vibración triaxial en chumaceras y retorno de jugo clarificado.",
    designCapacity: {
      nominalValue: 450,
      unit: "TCH",
      maxSafeValue: 500,
      minSafeValue: 250,
    },
    technicalSpecs: {
      rollerDimensions: "42x84 in",
      hydraulicPressureBar: 250,
      vibrationThresholdMmS: 4.5,
      millDriveKw: 900,
    },
  },
  {
    id: "eq-molino-6",
    code: "MOL-T1-06",
    name: "Molino 6 (Extractor Final & Secado de Bagazo)",
    areaId: "AREA_MOLIENDA",
    processCellId: "CELL_TANDEM_MOLINOS",
    isa95Level: "EQUIPMENT",
    description: "Último molino del tándem con inyección de agua de imbibición compuesta a 65°C para máxima extracción de sacarosa.",
    designCapacity: {
      nominalValue: 450,
      unit: "TCH",
      maxSafeValue: 500,
      minSafeValue: 250,
    },
    technicalSpecs: {
      extractionTargetPercent: 96.5,
      targetBagasseMoisturePercent: 48.5,
      imbibitionWaterRatioPercent: 250,
      hydraulicPressureBar: 260,
    },
  },

  // --- ÁREA CALDERAS DE VAPOR ---
  {
    id: "eq-caldera-1",
    code: "CALD-BIO-001",
    name: "Caldera de Biomasa 1 (65 bar, 485°C)",
    areaId: "AREA_CALDERAS",
    processCellId: "CELL_BATERIA_CALDERAS",
    isa95Level: "EQUIPMENT",
    description: "Generador de vapor acuotubular de bagazo con hogar suspendido (pinhole grate), economizador, sobrecalentador de dos etapas y calentador de aire tubular según ASME PTC 4.",
    designCapacity: {
      nominalValue: 220,
      unit: "t/h",
      maxSafeValue: 245,
      minSafeValue: 90,
    },
    technicalSpecs: {
      designPressureBar: 68.0,
      operatingPressureBar: 65.0,
      superheaterTempC: 485.0,
      boilerEfficiencyNominalPercent: 85.5,
      feedwaterTempC: 115.0,
    },
  },

  // --- ÁREA TURBOGENERACIÓN ---
  {
    id: "eq-turbina-1",
    code: "TURB-TG-001",
    name: "Turbogenerador TG1 (35 MVA / 30 MW)",
    areaId: "AREA_TURBOGENERACION",
    processCellId: "CELL_CASA_FUERZA",
    isa95Level: "EQUIPMENT",
    description: "Turbina de vapor multi-etapa de extracción-contrapresión acoplada a generador síncrono trifásico de 13.8 kV, 60 Hz con regulador digital Woodward 505.",
    designCapacity: {
      nominalValue: 32.5,
      unit: "MW",
      maxSafeValue: 35.0,
      minSafeValue: 5.0,
    },
    technicalSpecs: {
      turbineInletPressureBar: 64.0,
      turbineInletTempC: 480.0,
      extractionPressureBar: 2.2,
      generatorVoltageKV: 13.8,
      ratedPowerFactor: 0.85,
    },
  },

  // --- ÁREA SUBESTACIÓN ELÉCTRICA ---
  {
    id: "eq-subestacion",
    code: "ELEC-SUB-138",
    name: "Subestación Elevadora 138 kV & Despacho SEN",
    areaId: "AREA_TURBOGENERACION",
    processCellId: "CELL_CASA_FUERZA",
    isa95Level: "EQUIPMENT",
    description: "Transformador de potencia de 40 MVA 13.8/138 kV con bahía de salida, interruptores SF6 y analizador de calidad de energía Clase 0.2S para despacho PPA.",
    designCapacity: {
      nominalValue: 25.0,
      unit: "MW",
      maxSafeValue: 35.0,
      minSafeValue: 0.0,
    },
    technicalSpecs: {
      gridVoltageKV: 138.0,
      syncFrequencyHz: 60.0,
      powerExportMaxMW: 28.5,
      telemetryProtocol: "IEC-61850",
    },
  },

  // --- ÁREA CLARIFICACIÓN & TRATAMIENTO DE JUGO ---
  {
    id: "eq-clarificador",
    code: "CLAR-SRI-001",
    name: "Clarificador Rápido de Jugo (SRI Fast-Tray)",
    areaId: "AREA_CLARIFICACION",
    processCellId: "CELL_CLARIFICACION",
    isa95Level: "EQUIPMENT",
    description: "Clarificador rápido multitray con tiempo de residencia menor a 45 minutos para minimizar inversión de sacarosa y degradación de color.",
    designCapacity: {
      nominalValue: 420,
      unit: "m3/h",
      maxSafeValue: 480,
      minSafeValue: 180,
    },
    technicalSpecs: {
      retentionTimeMinutes: 38,
      juiceInletTempC: 103,
      clarityTargetNTU: 18,
      sludgeRemovalType: "CONTINUOUS_ROTARY_SCRAPER",
    },
  },

  // --- ÁREA EVAPORACIÓN ---
  {
    id: "eq-evaporadores",
    code: "EVAP-TREN-001",
    name: "Tren de Evaporación Cuádruple Efecto",
    areaId: "AREA_EVAPORACION",
    processCellId: "CELL_TREN_EVAPORACION",
    isa95Level: "EQUIPMENT",
    description: "Batería de evaporación con pre-evaporador Robert de 3500 m2 y cuádruple efecto para concentrar jugo clarificado (14°Bx) a meladura (66.5°Bx).",
    designCapacity: {
      nominalValue: 220,
      unit: "t_agua_evap/h",
      maxSafeValue: 260,
      minSafeValue: 90,
    },
    technicalSpecs: {
      inletBrix: 14.8,
      outletSyrupBrix: 66.8,
      exhaustSteamPressureBar: 2.2,
      vacuumLastEffectInHg: 26.5,
    },
  },

  // --- ÁREA TACHOS & CRISTALIZACIÓN ---
  {
    id: "eq-tachos-cristalizacion",
    code: "PAN-VAC-001",
    name: "Batería de Tachos al Vacío (Masas A y B)",
    areaId: "AREA_TACHOS",
    processCellId: "CELL_SALA_TACHOS",
    isa95Level: "EQUIPMENT",
    description: "Tachos al vacío de calandria flotante con agitador mecánico para cocimiento controlado de templas de masa A (pureza ~84%) y masa B.",
    designCapacity: {
      nominalValue: 65,
      unit: "m3/strike",
      maxSafeValue: 75,
      minSafeValue: 25,
    },
    technicalSpecs: {
      massecuiteType: "MASA_A",
      vacuumInHg: 26.2,
      strikeCycleHours: 2.8,
      crystalSizeMm: 0.65,
    },
  },

  // --- ÁREA CENTRÍFUGAS & ENSACADO ---
  {
    id: "eq-secador-ensacado",
    code: "SUG-DRY-001",
    name: "Secador-Enfriador Rotatorio & Silos de Azúcar",
    areaId: "AREA_CENTRIFUGAS_SECADO",
    processCellId: "CELL_SECADO_ENSACADO",
    isa95Level: "EQUIPMENT",
    description: "Secador de tambor rotatorio en contracorriente de aire filtrado, tamiz vibratorio clasificador y ensacado automático de 50 kg.",
    designCapacity: {
      nominalValue: 45,
      unit: "t_azucar/h",
      maxSafeValue: 55,
      minSafeValue: 10,
    },
    technicalSpecs: {
      finalSugarMoisturePercent: 0.035,
      icumsaColorMax: 150,
      baggingRateBagsHour: 900,
      sugarTemperatureLeavingC: 38,
    },
  },
];

// ============================================================================
// 2. SENSOR SPECIFICATIONS LINKED TO ASSETS & INDUSTRIAL TAGS
// ============================================================================

export const CANONICAL_TWIN_SENSORS: TwinSensorDefinition[] = [
  // Batey
  {
    id: "sns-tch-gross",
    equipmentId: "eq-patio-cana",
    tagId: "Milling.TCH_Actual",
    name: "Flujo Másico Caña Mesa Alimentadora",
    variableName: "TCH_Gross",
    measurementType: "FLOW",
    engineeringUnit: "TCH",
    plcMemoryAddress: "DB10.DBD0",
    protocol: "OPC_UA",
    scanRateMs: 500,
    rangeMin: 0,
    rangeMax: 600,
    alarmLimits: { low: 200, high: 520, highHigh: 560 },
  },
  // Preparación
  {
    id: "sns-prep-current",
    equipmentId: "eq-preparacion",
    tagId: "Prep.Shredder.MotorCurrent",
    name: "Corriente Motor Desfibrador",
    variableName: "Shredder_Current",
    measurementType: "POWER",
    engineeringUnit: "A",
    plcMemoryAddress: "DB12.DBD4",
    protocol: "MODBUS_TCP",
    scanRateMs: 250,
    rangeMin: 0,
    rangeMax: 1200,
    alarmLimits: { high: 1050, highHigh: 1150 },
  },
  // Molino 1
  {
    id: "sns-m1-hydr",
    equipmentId: "eq-molino-1",
    tagId: "Milling.Mill1.Hydraulic_Pressure",
    name: "Presión Hidráulica Molino 1",
    variableName: "M1_Hydr_Pressure",
    measurementType: "PRESSURE",
    engineeringUnit: "bar",
    plcMemoryAddress: "DB14.DBD10",
    protocol: "OPC_UA",
    scanRateMs: 500,
    rangeMin: 0,
    rangeMax: 320,
    alarmLimits: { low: 180, high: 275, highHigh: 295 },
  },
  // Molino 3
  {
    id: "sns-m3-vib",
    equipmentId: "eq-molino-3",
    tagId: "Milling.Mill3.Vibration_RMS",
    name: "Vibración Triaxial Chumacera Molino 3",
    variableName: "M3_Vibration_RMS",
    measurementType: "VIBRATION",
    engineeringUnit: "mm/s",
    plcMemoryAddress: "DB16.DBD20",
    protocol: "SPARKPLUG_B",
    scanRateMs: 250,
    rangeMin: 0,
    rangeMax: 15,
    alarmLimits: { high: 3.5, highHigh: 5.5 },
  },
  // Molino 6 / Imbibición
  {
    id: "sns-m6-extraction",
    equipmentId: "eq-molino-6",
    tagId: "Milling.Tandem.Extraction_Actual",
    name: "Extracción Sacarosa Tándem",
    variableName: "Sucrose_Extraction",
    measurementType: "POL",
    engineeringUnit: "%",
    plcMemoryAddress: "DB18.DBD4",
    protocol: "OPC_UA",
    scanRateMs: 1000,
    rangeMin: 80,
    rangeMax: 100,
    alarmLimits: { lowLow: 93.0, low: 95.0 },
  },
  {
    id: "sns-m6-bagasse-moist",
    equipmentId: "eq-molino-6",
    tagId: "Milling.Bagasse.Moisture_Percent",
    name: "Humedad en Bagazo Final",
    variableName: "Bagasse_Moisture",
    measurementType: "MOISTURE",
    engineeringUnit: "%",
    plcMemoryAddress: "DB18.DBD12",
    protocol: "MODBUS_TCP",
    scanRateMs: 1000,
    rangeMin: 40,
    rangeMax: 60,
    alarmLimits: { high: 51.5, highHigh: 53.5 },
  },
  // Caldera 1
  {
    id: "sns-b1-press",
    equipmentId: "eq-caldera-1",
    tagId: "Boiler1.Steam_Pressure_HP",
    name: "Presión Vapor Alta Caldera 1",
    variableName: "B1_Steam_Pressure",
    measurementType: "PRESSURE",
    engineeringUnit: "bar",
    plcMemoryAddress: "DB20.DBD0",
    protocol: "OPC_UA",
    scanRateMs: 250,
    rangeMin: 0,
    rangeMax: 80,
    alarmLimits: { low: 58.0, high: 66.5, highHigh: 68.0 },
  },
  {
    id: "sns-b1-temp",
    equipmentId: "eq-caldera-1",
    tagId: "Boiler1.Steam_Temp_HP",
    name: "Temperatura Vapor Sobrecalentado Caldera 1",
    variableName: "B1_Steam_Temp",
    measurementType: "TEMPERATURE",
    engineeringUnit: "°C",
    plcMemoryAddress: "DB20.DBD4",
    protocol: "OPC_UA",
    scanRateMs: 500,
    rangeMin: 300,
    rangeMax: 550,
    alarmLimits: { low: 450, high: 495, highHigh: 510 },
  },
  {
    id: "sns-b1-flow",
    equipmentId: "eq-caldera-1",
    tagId: "Boiler1.Steam_Flow_HP",
    name: "Flujo Másico Vapor Caldera 1",
    variableName: "B1_Steam_Flow",
    measurementType: "FLOW",
    engineeringUnit: "t/h",
    plcMemoryAddress: "DB20.DBD8",
    protocol: "OPC_UA",
    scanRateMs: 500,
    rangeMin: 0,
    rangeMax: 260,
    alarmLimits: { high: 235, highHigh: 248 },
  },
  // Turbina 1
  {
    id: "sns-tg1-power",
    equipmentId: "eq-turbina-1",
    tagId: "TG1.ActivePower_MW",
    name: "Potencia Activa Bruta TG1",
    variableName: "TG1_Gross_MW",
    measurementType: "POWER",
    engineeringUnit: "MW",
    plcMemoryAddress: "DB30.DBD0",
    protocol: "OPC_UA",
    scanRateMs: 250,
    rangeMin: 0,
    rangeMax: 40,
    alarmLimits: { low: 8.0, high: 34.0, highHigh: 35.5 },
  },
  // Subestación
  {
    id: "sns-sub-export",
    equipmentId: "eq-subestacion",
    tagId: "Grid.ExportPower_MW",
    name: "Potencia Exportada Fiscal al SEN",
    variableName: "Grid_Export_MW",
    measurementType: "POWER",
    engineeringUnit: "MW",
    plcMemoryAddress: "DB32.DBD0",
    protocol: "OPC_UA",
    scanRateMs: 250,
    rangeMin: 0,
    rangeMax: 35,
    alarmLimits: { low: 10.0, high: 27.5 },
  },
  // Evaporador
  {
    id: "sns-evap-brix",
    equipmentId: "eq-evaporadores",
    tagId: "Evaporator.Syrup_Brix",
    name: "Brix Meladura Salida Evaporador",
    variableName: "Syrup_Brix",
    measurementType: "BRIX",
    engineeringUnit: "°Bx",
    plcMemoryAddress: "DB40.DBD4",
    protocol: "MODBUS_TCP",
    scanRateMs: 1000,
    rangeMin: 50,
    rangeMax: 75,
    alarmLimits: { low: 62.0, high: 68.5 },
  },
  // Azúcar
  {
    id: "sns-sug-prod",
    equipmentId: "eq-secador-ensacado",
    tagId: "Production.Sugar_Tons_Today",
    name: "Producción Azúcar Acumulada Hoy",
    variableName: "Sugar_Production_Tons",
    measurementType: "FLOW",
    engineeringUnit: "t",
    plcMemoryAddress: "DB50.DBD0",
    protocol: "OPC_UA",
    scanRateMs: 2000,
    rangeMin: 0,
    rangeMax: 2000,
  },
];

// ============================================================================
// 3. ACTUATOR SPECIFICATIONS (CONTROL ELEMENTS)
// ============================================================================

export const CANONICAL_TWIN_ACTUATORS: TwinActuatorDefinition[] = [
  {
    id: "act-feed-table-vfd",
    equipmentId: "eq-patio-cana",
    tagId: "Actuator.FeedTable.VfdSpeed",
    name: "VFD Velocidad Mesa Alimentadora",
    actuatorType: "VFD_MOTOR",
    engineeringUnit: "%",
    controlRange: { min: 0, max: 100 },
    interlockProtected: true,
    failsafePosition: "CLOSED",
  },
  {
    id: "act-b1-feedwater-valve",
    equipmentId: "eq-caldera-1",
    tagId: "Actuator.Boiler1.FeedwaterControlValve",
    name: "Válvula Control Agua de Alimentación Caldera 1",
    actuatorType: "CONTROL_VALVE",
    engineeringUnit: "%",
    controlRange: { min: 0, max: 100 },
    interlockProtected: true,
    failsafePosition: "OPEN",
  },
  {
    id: "act-tg1-governor",
    equipmentId: "eq-turbina-1",
    tagId: "Actuator.TG1.GovernorSpeedDemand",
    name: "Gobernador Válvulas Control Vapor TG1",
    actuatorType: "TURBINE_GOVERNOR",
    engineeringUnit: "rpm",
    controlRange: { min: 1800, max: 5400 },
    interlockProtected: true,
    failsafePosition: "CLOSED",
  },
  {
    id: "act-m6-imbibition-valve",
    equipmentId: "eq-molino-6",
    tagId: "Actuator.Milling.ImbibitionControlValve",
    name: "Válvula Control Caudal Agua Imbibición",
    actuatorType: "CONTROL_VALVE",
    engineeringUnit: "%",
    controlRange: { min: 0, max: 100 },
    interlockProtected: false,
    failsafePosition: "HOLD",
  },
];

// ============================================================================
// 4. PROCESS FLOW CONNECTIONS (MATERIAL & ENERGY FLOW GRAPH)
// ============================================================================

export const CANONICAL_TWIN_FLOWS: ProcessFlowConnection[] = [
  // 1. Caña en Batey -> Preparación
  {
    id: "flow-mat-cane-prep",
    sourceEquipmentId: "eq-patio-cana",
    targetEquipmentId: "eq-preparacion",
    flowType: "MATERIAL",
    materialSubtype: "CANE",
    nominalRate: 450,
    currentRate: 452.4,
    rateUnit: "TCH",
    qualityMetric: { name: "Pol_Cane", value: 15.4, unit: "%" },
    pipelineOrConveyorTag: "Conveyor.MainCaneCarrier1",
    isActive: true,
  },

  // 2. Preparación -> Molino 1
  {
    id: "flow-mat-prep-m1",
    sourceEquipmentId: "eq-preparacion",
    targetEquipmentId: "eq-molino-1",
    flowType: "MATERIAL",
    materialSubtype: "PREPARED_CANE",
    nominalRate: 450,
    currentRate: 452.4,
    rateUnit: "TCH",
    qualityMetric: { name: "OpenCellIndex", value: 88.5, unit: "%" },
    pipelineOrConveyorTag: "Conveyor.DonnellyChute1",
    isActive: true,
  },

  // 3. Molino 1 -> Molino 3 (Bagazo Intermedio)
  {
    id: "flow-mat-m1-m3",
    sourceEquipmentId: "eq-molino-1",
    targetEquipmentId: "eq-molino-3",
    flowType: "MATERIAL",
    materialSubtype: "BAGASSE",
    nominalRate: 310,
    currentRate: 312.0,
    rateUnit: "t/h",
    pipelineOrConveyorTag: "Conveyor.IntermediateRake1_3",
    isActive: true,
  },

  // 4. Molino 3 -> Molino 6 (Bagazo Final en Tándem)
  {
    id: "flow-mat-m3-m6",
    sourceEquipmentId: "eq-molino-3",
    targetEquipmentId: "eq-molino-6",
    flowType: "MATERIAL",
    materialSubtype: "BAGASSE",
    nominalRate: 200,
    currentRate: 201.5,
    rateUnit: "t/h",
    pipelineOrConveyorTag: "Conveyor.IntermediateRake3_6",
    isActive: true,
  },

  // 5. Molino 6 -> Caldera 1 (Bagazo Combustible)
  {
    id: "flow-mat-m6-boiler",
    sourceEquipmentId: "eq-molino-6",
    targetEquipmentId: "eq-caldera-1",
    flowType: "MATERIAL",
    materialSubtype: "BAGASSE",
    nominalRate: 98.0,
    currentRate: 97.5,
    rateUnit: "t/h",
    qualityMetric: { name: "Moisture", value: 48.8, unit: "%" },
    pipelineOrConveyorTag: "Conveyor.MainBagasseDistributionToBoilers",
    isActive: true,
  },

  // 6. Molino 1 a 6 -> Clarificador (Jugo Mixto Total)
  {
    id: "flow-mat-milling-clarifier",
    sourceEquipmentId: "eq-molino-1",
    targetEquipmentId: "eq-clarificador",
    flowType: "MATERIAL",
    materialSubtype: "MIXED_JUICE",
    nominalRate: 410,
    currentRate: 412.0,
    rateUnit: "t/h",
    temperatureC: 38,
    qualityMetric: { name: "Brix", value: 14.8, unit: "°Bx" },
    pipelineOrConveyorTag: "Pipe.MixedJuiceDeliveryHeader",
    isActive: true,
  },

  // 7. Clarificador -> Evaporadores (Jugo Clarificado)
  {
    id: "flow-mat-clar-evap",
    sourceEquipmentId: "eq-clarificador",
    targetEquipmentId: "eq-evaporadores",
    flowType: "MATERIAL",
    materialSubtype: "CLARIFIED_JUICE",
    nominalRate: 380,
    currentRate: 382.0,
    rateUnit: "t/h",
    temperatureC: 98,
    qualityMetric: { name: "Clarity", value: 18.0, unit: "NTU" },
    pipelineOrConveyorTag: "Pipe.ClarifiedJuiceToEvaporators",
    isActive: true,
  },

  // 8. Evaporadores -> Tachos (Meladura Concentrada)
  {
    id: "flow-mat-evap-tachos",
    sourceEquipmentId: "eq-evaporadores",
    targetEquipmentId: "eq-tachos-cristalizacion",
    flowType: "MATERIAL",
    materialSubtype: "SYRUP_MELADURA",
    nominalRate: 85,
    currentRate: 84.8,
    rateUnit: "t/h",
    temperatureC: 62,
    qualityMetric: { name: "SyrupBrix", value: 66.8, unit: "°Bx" },
    pipelineOrConveyorTag: "Pipe.SyrupStorageHeader",
    isActive: true,
  },

  // 9. Tachos -> Ensacado (Masa Cocida A y Azúcar Comercial)
  {
    id: "flow-mat-tachos-dryer",
    sourceEquipmentId: "eq-tachos-cristalizacion",
    targetEquipmentId: "eq-secador-ensacado",
    flowType: "MATERIAL",
    materialSubtype: "SUGAR_COMMERCIAL",
    nominalRate: 36,
    currentRate: 36.5,
    rateUnit: "t/h",
    qualityMetric: { name: "Pol", value: 99.7, unit: "%" },
    pipelineOrConveyorTag: "Conveyor.DrySugarBucketElevator",
    isActive: true,
  },

  // --- FLUJOS ENERGÉTICOS (ENERGY FLOWS) ---

  // 10. Caldera 1 -> Turbina 1 (Vapor Alta Presión HP)
  {
    id: "flow-energy-boiler-turbine",
    sourceEquipmentId: "eq-caldera-1",
    targetEquipmentId: "eq-turbina-1",
    flowType: "ENERGY",
    energySubtype: "HP_STEAM",
    nominalRate: 210,
    currentRate: 211.5,
    rateUnit: "t_steam/h",
    pressureBar: 64.6,
    temperatureC: 485.2,
    pipelineOrConveyorTag: "Steam.HighPressureHeader_65Bar",
    isActive: true,
  },

  // 11. Turbina 1 -> Evaporadores (Vapor de Escape LP a Fábrica)
  {
    id: "flow-energy-turbine-evap",
    sourceEquipmentId: "eq-turbina-1",
    targetEquipmentId: "eq-evaporadores",
    flowType: "ENERGY",
    energySubtype: "LP_EXHAUST_STEAM",
    nominalRate: 195,
    currentRate: 196.2,
    rateUnit: "t_steam/h",
    pressureBar: 2.2,
    temperatureC: 134.8,
    pipelineOrConveyorTag: "Steam.FactoryExhaustHeader_2_2Bar",
    isActive: true,
  },

  // 12. Turbina 1 -> Subestación 138 kV (Electricidad Bruta / Despacho)
  {
    id: "flow-energy-turbine-substation",
    sourceEquipmentId: "eq-turbina-1",
    targetEquipmentId: "eq-subestacion",
    flowType: "ENERGY",
    energySubtype: "ELECTRICITY_GRID_EXPORT",
    nominalRate: 21.5,
    currentRate: 21.2,
    rateUnit: "MW",
    pipelineOrConveyorTag: "Electrical.Busbar_13_8kV_TG1",
    isActive: true,
  },
];
