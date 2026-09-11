/**
 * BioAzúcar 4.0 — Agricultural Parameter Registry & Governance Master
 * Central audit authority for all agronomic, operational, mechanical and economic constants.
 * 
 * Classification standards:
 * - PDA_VERIFIED: Explicitly demonstrated from ODS PDA Model formulas with cell/sheet reference.
 * - DERIVED: Computed deterministically from verified base parameters.
 * - CURRENT_ASSUMPTION: Working empirical assumption pending on-site validation.
 * - CONFIGURABLE: Operational setpoint designed to be adjusted per mill/campaign without code modification.
 * - REQUIRES_VALIDATION: Parameter requiring field agronomist sign-off or lab certification.
 */

import {
  AgriculturalParameter,
  CaneGrowthStage,
  CaneVarietyYieldMaster,
  SoilType,
  ParameterValidationStatus,
} from "../../types/agriculture";

/**
 * Baseline Audited Canonical Parameters
 */
export const CANONICAL_AGRICULTURAL_PARAMETERS: AgriculturalParameter[] = [
  // 1. Commercial Varieties Catalog & Decay Retention (Item 1)
  {
    id: "param-var-rb86-7515",
    tenantId: "DEFAULT",
    category: "VARIETY_DECAY",
    name: "Variedad RB86-7515 (Master & Curva Decaimiento)",
    key: "VARIETY_MASTER_RB86_7515",
    value: {
      varietyCode: "RB86-7515",
      name: "RB86-7515 (Maduración Media / Alta Sacarosa)",
      cycleLengthMonths: 15,
      baseYieldTch: 105.0,
      polPercent: 14.5,
      fiberPercent: 13.2,
      purityPercent: 86.5,
      maturity: "MEDIA",
      ratoonDecayFactors: {
        PLANTA: 1.0,
        SOCA: 0.90,
        RETONO_Q2: 0.83,
        RETONO_Q3: 0.76,
        RETONO_Q4: 0.70,
        RETONO_Q5: 0.63,
        RETONO_Q6: 0.58,
        RETONO_Q7_PLUS: 0.52,
        DEMOLICION: 0.00,
      },
    },
    unit: "object",
    source: "Modelo ODS PDA Rev. 2014 (Hojas 'TCH' & 'EVOLUÇÃO tch por cepa')",
    sourceSheet: "EVOLUÇÃO tch por cepa",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Variedad patrón brasileña RB. Curva empírica de pérdida de vigor vegetativo por corte.",
    notes: "Requiere calibración agronómica para condiciones edafoclimáticas del ingenio específico.",
  },
  {
    id: "param-var-sp80-3280",
    tenantId: "DEFAULT",
    category: "VARIETY_DECAY",
    name: "Variedad SP80-3280 (Master & Curva Decaimiento)",
    key: "VARIETY_MASTER_SP80_3280",
    value: {
      varietyCode: "SP80-3280",
      name: "SP80-3280 (Maduración Temprana / Rústica)",
      cycleLengthMonths: 12,
      baseYieldTch: 100.0,
      polPercent: 15.1,
      fiberPercent: 12.8,
      purityPercent: 88.0,
      maturity: "TEMPRANA",
      ratoonDecayFactors: {
        PLANTA: 1.0,
        SOCA: 0.89,
        RETONO_Q2: 0.82,
        RETONO_Q3: 0.75,
        RETONO_Q4: 0.68,
        RETONO_Q5: 0.61,
        RETONO_Q6: 0.55,
        RETONO_Q7_PLUS: 0.50,
        DEMOLICION: 0.00,
      },
    },
    unit: "object",
    source: "Modelo ODS PDA Rev. 2014 (Hojas 'TCH' & 'EVOLUÇÃO tch por cepa')",
    sourceSheet: "EVOLUÇÃO tch por cepa",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Cultivar precoz de alta rusticidad en suelos marginales.",
  },
  {
    id: "param-var-ctc-4",
    tenantId: "DEFAULT",
    category: "VARIETY_DECAY",
    name: "Variedad CTC-4 (Master & Curva Decaimiento)",
    key: "VARIETY_MASTER_CTC_4",
    value: {
      varietyCode: "CTC-4",
      name: "CTC-4 (Maduración Media / Alta Biomasa)",
      cycleLengthMonths: 18,
      baseYieldTch: 112.0,
      polPercent: 14.2,
      fiberPercent: 13.8,
      purityPercent: 85.8,
      maturity: "TARDIA",
      ratoonDecayFactors: {
        PLANTA: 1.0,
        SOCA: 0.91,
        RETONO_Q2: 0.84,
        RETONO_Q3: 0.77,
        RETONO_Q4: 0.71,
        RETONO_Q5: 0.64,
        RETONO_Q6: 0.59,
        RETONO_Q7_PLUS: 0.53,
        DEMOLICION: 0.00,
      },
    },
    unit: "object",
    source: "Modelo ODS PDA Rev. 2014 (Hojas 'TCH' & 'EVOLUÇÃO tch por cepa')",
    sourceSheet: "EVOLUÇÃO tch por cepa",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Variedad Centro de Tecnología Cañera de alto tonelaje inicial.",
  },

  // 2. Soil Impact Factors (Item 2)
  {
    id: "param-soil-franco",
    tenantId: "DEFAULT",
    category: "SOIL_FACTORS",
    name: "Factor Suelo Franco (Referencia Neutra)",
    key: "SOIL_FACTOR_FRANCO",
    value: 1.00,
    unit: "ratio",
    source: "Premisa Agronómica Modelo PDA",
    sourceSheet: "PREMISSAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
    description: "Suelo de referencia con retención óptima de humedad y porosidad.",
  },
  {
    id: "param-soil-arcilloso",
    tenantId: "DEFAULT",
    category: "SOIL_FACTORS",
    name: "Factor Suelo Arcilloso",
    key: "SOIL_FACTOR_ARCILLOSO",
    value: 0.98,
    unit: "ratio",
    source: "Premisa Agronómica Modelo PDA",
    sourceSheet: "PREMISSAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Mayor retención hídrica pero mayor resistencia mecánica al enraizamiento.",
  },
  {
    id: "param-soil-arenoso",
    tenantId: "DEFAULT",
    category: "SOIL_FACTORS",
    name: "Factor Suelo Arenoso",
    key: "SOIL_FACTOR_ARENOSO",
    value: 0.92,
    unit: "ratio",
    source: "Premisa Agronómica Modelo PDA",
    sourceSheet: "PREMISSAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Menor retención de nutrientes y humedad estival.",
  },

  // 3. Agro Operations Catalog (Item 3)
  {
    id: "param-op-subsolado",
    tenantId: "DEFAULT",
    category: "AGRO_OPERATIONS",
    name: "Operación: Subsolado Profundo 50cm",
    key: "OP_SUBSOLADO_PROFUNDO",
    value: {
      id: "op-subsolado",
      category: "PREPARO_SOLO",
      name: "Subsolado Profundo 50cm",
      standardTractorPowerHp: 210,
      standardImplement: "Subsolador 5 Astes Desarmable",
      effectiveCapacityHaPerHour: 0.48,
      fuelConsumptionLitersPerHour: 24.5,
      targetCycle: "PRE_PLANTIO",
      operatorCount: 1,
    },
    unit: "object",
    source: "Modelo ODS PDA (Hoja 'Áreas PS_operações')",
    sourceSheet: "Áreas PS_operações",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
    description: "Rompimiento de pie de arado en renovación.",
  },
  {
    id: "param-op-arado-disco",
    tenantId: "DEFAULT",
    category: "AGRO_OPERATIONS",
    name: "Operación: Arado de Disco Pesado",
    key: "OP_ARADO_DISCO",
    value: {
      id: "op-arado-disco",
      category: "PREPARO_SOLO",
      name: "Arado de Disco Pesado",
      standardTractorPowerHp: 180,
      standardImplement: "Arado 4 Discos Reversibles 32''",
      effectiveCapacityHaPerHour: 0.65,
      fuelConsumptionLitersPerHour: 21.0,
      targetCycle: "PRE_PLANTIO",
      operatorCount: 1,
    },
    unit: "object",
    source: "Modelo ODS PDA (Hoja 'Áreas PS_operações')",
    sourceSheet: "Áreas PS_operações",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-op-grada-intermedia",
    tenantId: "DEFAULT",
    category: "AGRO_OPERATIONS",
    name: "Operación: Nivelación con Grada Intermedia",
    key: "OP_GRADA_INTERMEDIA",
    value: {
      id: "op-grada-intermedia",
      category: "PREPARO_SOLO",
      name: "Nivelación con Grada Intermedia",
      standardTractorPowerHp: 140,
      standardImplement: "Grada Niveladora 28 Discos",
      effectiveCapacityHaPerHour: 1.25,
      fuelConsumptionLitersPerHour: 16.0,
      targetCycle: "PRE_PLANTIO",
      operatorCount: 1,
    },
    unit: "object",
    source: "Modelo ODS PDA (Hoja 'Áreas PS_operações')",
    sourceSheet: "Áreas PS_operações",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-op-encalado",
    tenantId: "DEFAULT",
    category: "AGRO_OPERATIONS",
    name: "Operación: Distribución de Cal Dolomítica",
    key: "OP_DISTRIBUCION_CAL",
    value: {
      id: "op-encalado",
      category: "PREPARO_SOLO",
      name: "Distribución de Cal Dolomítica",
      standardTractorPowerHp: 110,
      standardImplement: "Distribuidor Centrífugo 4 t",
      effectiveCapacityHaPerHour: 2.10,
      fuelConsumptionLitersPerHour: 12.0,
      targetCycle: "PRE_PLANTIO",
      operatorCount: 1,
    },
    unit: "object",
    source: "Modelo ODS PDA (Hoja 'Áreas PS_operações')",
    sourceSheet: "Áreas PS_operações",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-op-surcado",
    tenantId: "DEFAULT",
    category: "AGRO_OPERATIONS",
    name: "Operación: Surcado & Abonado de Fondo",
    key: "OP_SURCADO_ABONADO",
    value: {
      id: "op-surcado",
      category: "PLANTIO",
      name: "Surcado & Abonado de Fondo",
      standardTractorPowerHp: 140,
      standardImplement: "Surcador 2 Líneas con Tolva NPK",
      effectiveCapacityHaPerHour: 0.90,
      fuelConsumptionLitersPerHour: 15.5,
      targetCycle: "PRE_PLANTIO",
      operatorCount: 1,
    },
    unit: "object",
    source: "Modelo ODS PDA (Hoja 'PLANTIO')",
    sourceSheet: "PLANTIO",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },

  // 4. Benchmark Equipment Acquisition Prices USD (Item 4)
  {
    id: "param-price-tractor-pesado",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Tractor Pesado 210 HP",
    key: "PRICE_TRACTOR_PESADO_USD",
    value: 190000.0,
    unit: "USD/unidad",
    source: "Modelo ODS PDA (Hoja 'Equipamentos PS_COMPRAS')",
    sourceSheet: "Equipamentos PS_COMPRAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
    description: "Precio benchmark de adquisición de tractor agrícola de tiro pesado.",
  },
  {
    id: "param-price-tractor-medio",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Tractor Medio 140 HP",
    key: "PRICE_TRACTOR_MEDIO_USD",
    value: 125000.0,
    unit: "USD/unidad",
    source: "Modelo ODS PDA (Hoja 'Equipamentos PS_COMPRAS')",
    sourceSheet: "Equipamentos PS_COMPRAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-tractor-ligero",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Tractor Ligero 100 HP",
    key: "PRICE_TRACTOR_LIGERO_USD",
    value: 85000.0,
    unit: "USD/unidad",
    source: "Modelo ODS PDA (Hoja 'Equipamentos PS_COMPRAS')",
    sourceSheet: "Equipamentos PS_COMPRAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-cosechadora",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Cosechadora Combinada de Caña Picada 350 HP",
    key: "PRICE_COSECHADORA_COMBINADA_USD",
    value: 450000.0,
    unit: "USD/unidad",
    source: "Modelo ODS PDA (Hoja 'Equipamentos PS_COMPRAS')",
    sourceSheet: "Equipamentos PS_COMPRAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-transbordo",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Tractor + Vagón Transbordo 14 t",
    key: "PRICE_TRACTOR_TRANSBORDO_USD",
    value: 165000.0,
    unit: "USD/unidad",
    source: "Modelo ODS PDA (Hoja 'Equipamentos PS_COMPRAS')",
    sourceSheet: "Equipamentos PS_COMPRAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-camion-cct",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Camión Cañero Rodoviario Bi-tren 45 t",
    key: "PRICE_CAMION_CANERO_RODOVIARIO_USD",
    value: 210000.0,
    unit: "USD/unidad",
    source: "Modelo ODS PDA (Hoja 'Equipamentos PS_COMPRAS')",
    sourceSheet: "Equipamentos PS_COMPRAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },

  // 5. Benchmark Economic OPEX Inputs (Item 5)
  {
    id: "param-price-diesel",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Diesel Agroindustrial Puesto en Tanque",
    key: "PRICE_DIESEL_USD_PER_LITER",
    value: 0.95,
    unit: "USD/L",
    source: "Modelo ODS PDA (Hoja 'DIESEL e LUBR')",
    sourceSheet: "DIESEL e LUBR",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
    description: "Costo de adquisición mayorista de diesel B5/B10 puesto en tanque rural.",
  },
  {
    id: "param-price-npk",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Fertilizante Granulado N-P-K Mezcla",
    key: "PRICE_FERTILIZER_NPK_USD_PER_TON",
    value: 620.0,
    unit: "USD/t",
    source: "Modelo ODS PDA (Hoja 'FERTILIZANTES')",
    sourceSheet: "FERTILIZANTES",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-cal",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Precio Cal Dolomítica / Enmienda",
    key: "PRICE_LIME_AMENDMENT_USD_PER_TON",
    value: 45.0,
    unit: "USD/t",
    source: "Modelo ODS PDA (Hoja 'FERTILIZANTES')",
    sourceSheet: "FERTILIZANTES",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-herbicida",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Costo Promedio Herbicidas y Defensivos por Hectárea",
    key: "COST_HERBICIDE_USD_PER_HA",
    value: 35.0,
    unit: "USD/ha",
    source: "Modelo ODS PDA (Hoja 'INSUMOS')",
    sourceSheet: "INSUMOS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-cost-mach-maint",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Costo Mantenimiento y Repuestos por Hora Máquina",
    key: "COST_MACHINERY_MAINTENANCE_USD_PER_HOUR",
    value: 12.50,
    unit: "USD/h",
    source: "Modelo ODS PDA (Hoja 'OPEX')",
    sourceSheet: "OPEX",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-labor-monthly",
    tenantId: "DEFAULT",
    category: "ECONOMIC_PRICES",
    name: "Salario Promedio Operador / Chofer CCT",
    key: "LABOR_OPERATOR_MONTHLY_USD",
    value: 1450.0,
    unit: "USD/mes",
    source: "Modelo ODS PDA (Hoja 'RESUMO PESSOAS')",
    sourceSheet: "RESUMO PESSOAS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Costo laboral total con cargas sociales para operador calificado.",
  },

  // 6. Diesel Consumption Defaults (Item 6)
  {
    id: "param-diesel-harvest-rate",
    tenantId: "DEFAULT",
    category: "AGRO_OPERATIONS",
    name: "Consumo Diesel Específico en Cosecha Mecanizada",
    key: "DIESEL_HARVEST_LITERS_PER_TON",
    value: 4.2,
    unit: "L/t caña",
    source: "Benchmark Operacional Caña (Hoja 'DIESEL e LUBR')",
    sourceSheet: "DIESEL e LUBR",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Consumo combinado de cosechadora picadora + transbordo de campo (L por tonelada cortada).",
    notes: "Varía entre 3.8 y 4.8 L/t según vigor del cañaveral y estado de cuchillas.",
  },
  {
    id: "param-diesel-transport-rate",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Consumo Diesel Específico en Transporte CCT",
    key: "DIESEL_TRANSPORT_LITERS_PER_TON",
    value: 1.8,
    unit: "L/t caña",
    source: "Benchmark Operacional Caña (Hoja 'DIESEL e LUBR')",
    sourceSheet: "DIESEL e LUBR",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Consumo medio de combustible en carretera rodoviaria por tonelada entregada en báscula.",
  },

  // 7. Ratoon Cover Fertilizer Rate (Item 7: 350 kg/ha)
  {
    id: "param-fertilizer-ratoon-rate",
    tenantId: "DEFAULT",
    category: "INPUTS_BYPRODUCTS",
    name: "Dosis Fertilizante de Cobertera en Soca / Retoño",
    key: "FERTILIZER_RATOON_KG_PER_HA",
    value: 350.0,
    unit: "kg/ha",
    source: "Modelo ODS PDA (Hoja 'TRATOS SOCAeRETONOS')",
    sourceSheet: "TRATOS SOCAeRETONOS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Fertilización nitrogenada y potásica de mantenimiento en retoño (350 kg/ha).",
    notes: "Reducible si se aplica vinaza fabril rica en potasio.",
  },

  // 8. Basal Seed Cane Consumption (Item 8: 13.5 t/ha)
  {
    id: "param-seed-cane-rate",
    tenantId: "DEFAULT",
    category: "INPUTS_BYPRODUCTS",
    name: "Dosis de Caña Semilla en Siembra Mecanizada",
    key: "SEED_CANE_RATE_TONS_PER_HA",
    value: 13.5,
    unit: "t/ha",
    source: "Modelo ODS PDA (Hoja 'PLANTIO')",
    sourceSheet: "PLANTIO",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Consumo de semilla troceada por hectárea sembrada con plantadora de 2 líneas.",
    notes: "Típicamente entre 12.0 y 15.0 t/ha según peso lineal y espaciamiento (1.50m).",
  },
  {
    id: "param-basal-fertilizer-rate",
    tenantId: "DEFAULT",
    category: "INPUTS_BYPRODUCTS",
    name: "Dosis Fertilizante de Fondo en Siembra",
    key: "FERTILIZER_BASAL_KG_PER_HA",
    value: 400.0,
    unit: "kg/ha",
    source: "Modelo ODS PDA (Hoja 'PLANTIO')",
    sourceSheet: "PLANTIO",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CONFIGURABLE",
  },

  // 9. Vinaza & Cachaza Recycling Rates (Item 9)
  {
    id: "param-vinasse-application-rate",
    tenantId: "DEFAULT",
    category: "INPUTS_BYPRODUCTS",
    name: "Dosis de Fertirriego con Vinaza Fabril",
    key: "VINASSE_APPLICATION_RATE_M3_PER_HA",
    value: 150.0,
    unit: "m³/ha",
    source: "Premisa Economía Circular BioAzúcar (Hoja 'TRATOS SOCAeRETONOS')",
    sourceSheet: "TRATOS SOCAeRETONOS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Volumen de vinaza reciclada de destilería aplicado mediante aspersión o cañón enrollador.",
    notes: "Debe respetar la norma ambiental del balance de potasio del suelo (límite lixiviación).",
  },
  {
    id: "param-vinasse-coverage-ratio",
    tenantId: "DEFAULT",
    category: "INPUTS_BYPRODUCTS",
    name: "Cobertura de Fertirriego en Área Retoño",
    key: "VINASSE_COVERAGE_RATIO",
    value: 0.60,
    unit: "ratio",
    source: "Premisa Operativa de Radio de Vinaza",
    sourceSheet: "TRATOS SOCAeRETONOS",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Porcentaje de los campos de retoño dentro del radio económico de bombeo / transporte de vinaza.",
  },
  {
    id: "param-filter-cake-rate",
    tenantId: "DEFAULT",
    category: "INPUTS_BYPRODUCTS",
    name: "Dosis de Aplicación de Cachaza de Filtro",
    key: "FILTER_CAKE_APPLICATION_RATE_TONS_PER_HA",
    value: 30.0,
    unit: "t/ha",
    source: "Premisa Economía Circular BioAzúcar (Hoja 'Áreas PS_operações')",
    sourceSheet: "Áreas PS_operações",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Torta de filtración de clarificación aplicada en fondo de surco o preparación.",
  },

  // 10. CCT Speeds (Item 10: 45 / 32 km/h)
  {
    id: "param-cct-speed-empty",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Velocidad Media Camión Vacío (Retorno a Campo)",
    key: "CCT_SPEED_EMPTY_KM_H",
    value: 45.0,
    unit: "km/h",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Velocidad media en ciclo de retorno vacío hacia el frente de cosecha.",
  },
  {
    id: "param-cct-speed-loaded",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Velocidad Media Camión Cargado (Viaje a Fábrica)",
    key: "CCT_SPEED_LOADED_KM_H",
    value: 32.0,
    unit: "km/h",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Velocidad media ponderada con carga completa rodoviaria en caminos secundarios y ruta.",
  },

  // 11. CCT Truck Payload (Item 11: 45 t)
  {
    id: "param-cct-truck-payload",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Carga Neta por Camión Bi-tren CCT",
    key: "CCT_TRUCK_PAYLOAD_TONS",
    value: 45.0,
    unit: "t/camión",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Capacidad útil reglamentaria de transporte de caña picada por conjunto articulado.",
  },

  // 12. CCT Daily Utilization Factor (Item 12: 0.80)
  {
    id: "param-cct-utilization-factor",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Factor de Utilización Diaria Flota CCT (19.2 h efectivas)",
    key: "CCT_UTILIZATION_FACTOR",
    value: 0.80,
    unit: "ratio",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "24 horas × 0.80 = 19.2 horas efectivas de rodaje, carga y descarga.",
    notes: "Descuenta paradas por cambio de turno, abastecimiento de combustible e inspección técnica.",
  },

  // CCT Operational Cycle Ancillary Times
  {
    id: "param-cct-loading-time",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Tiempo de Carga en Frente (Transbordo a Camión)",
    key: "CCT_LOADING_IN_FIELD_HOURS",
    value: 0.45,
    unit: "horas",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "27 minutos de alce continuo mediante vagones de transbordo en cabecera de lote.",
  },
  {
    id: "param-cct-unloading-time",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Tiempo de Descarga en Patio / Conductor Cañero",
    key: "CCT_UNLOADING_AT_MILL_HOURS",
    value: 0.35,
    unit: "horas",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "21 minutos en volcador lateral hilo alimentador / mesa receptora.",
  },
  {
    id: "param-cct-field-queue-time",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Tiempo de Espera en Cola de Campo",
    key: "CCT_FIELD_QUEUE_HOURS",
    value: 0.15,
    unit: "horas",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
  },
  {
    id: "param-cct-weighbridge-queue-time",
    tenantId: "DEFAULT",
    category: "HARVEST_CCT",
    name: "Tiempo en Báscula & Muestreo Core Sampler",
    key: "CCT_WEIGHBRIDGE_QUEUE_HOURS",
    value: 0.20,
    unit: "horas",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
  },

  // 13. TCH Threshold for Renovation / Demolition (Item 13: 55 t/ha)
  {
    id: "param-tch-renovation-threshold",
    tenantId: "DEFAULT",
    category: "THRESHOLDS",
    name: "Umbral Mínimo Económico de TCH para Demolición",
    key: "MIN_ECONOMIC_TCH_THRESHOLD",
    value: 55.0,
    unit: "t/ha",
    source: "Modelo ODS PDA (Hojas 'TCH' y 'análise Evolução TCH')",
    sourceSheet: "análise Evolução TCH",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "REQUIRES_VALIDATION",
    description: "Productividad por debajo de la cual el costo de corte, alce y transporte supera el ingreso fabril.",
    notes: "Lotes con TCH < 55 t/ha deben marcarse para demolición y renovación de cepa.",
  },

  // Harvester standard capacity
  {
    id: "param-harvester-effective-capacity",
    tenantId: "DEFAULT",
    category: "AGRO_OPERATIONS",
    name: "Capacidad Efectiva de Cosechadora Combinada",
    key: "HARVESTER_EFFECTIVE_CAPACITY_TCH",
    value: 52.0,
    unit: "t/h",
    source: "Modelo ODS PDA (Hoja 'COLHEITA')",
    sourceSheet: "COLHEITA",
    version: "1.0.0",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    validationStatus: "CURRENT_ASSUMPTION",
    description: "Toneladas efectivas cosechadas por hora neta de operación de corte.",
  },
];

/**
 * Parameter Store and Registry Service
 * Provides in-memory fast lookups, default fallbacks, and parameter management.
 */
export class AgriculturalParameterRegistry {
  private static parametersMap: Map<string, AgriculturalParameter> = new Map();

  static {
    // Initialize with canonical baseline
    for (const param of CANONICAL_AGRICULTURAL_PARAMETERS) {
      this.parametersMap.set(param.key, { ...param });
    }
  }

  /**
   * Return all currently loaded parameters
   */
  public static getAllParameters(): AgriculturalParameter[] {
    return Array.from(this.parametersMap.values());
  }

  /**
   * Get single parameter by key with fallback
   */
  public static getParameter<T = any>(key: string, defaultValue?: T): AgriculturalParameter | null {
    const p = this.parametersMap.get(key);
    if (p) return p;
    if (defaultValue !== undefined) {
      const canonical = CANONICAL_AGRICULTURAL_PARAMETERS.find((c) => c.key === key);
      return canonical ?? null;
    }
    return null;
  }

  /**
   * Get numeric value by key with safe fallback
   */
  public static getNumberValue(key: string, defaultValue: number): number {
    const param = this.parametersMap.get(key);
    if (param && typeof param.value === "number") {
      return param.value;
    }
    const canonical = CANONICAL_AGRICULTURAL_PARAMETERS.find((c) => c.key === key);
    if (canonical && typeof canonical.value === "number") {
      return canonical.value;
    }
    return defaultValue;
  }

  /**
   * Get object/complex value by key with fallback
   */
  public static getValue<T = any>(key: string, defaultValue: T): T {
    const param = this.parametersMap.get(key);
    if (param && param.value !== undefined) {
      return param.value as T;
    }
    const canonical = CANONICAL_AGRICULTURAL_PARAMETERS.find((c) => c.key === key);
    if (canonical && canonical.value !== undefined) {
      return canonical.value as T;
    }
    return defaultValue;
  }

  /**
   * Alias for getValue with fallback
   */
  public static getParameterValue<T = any>(key: string, defaultValue: T): T {
    return this.getValue<T>(key, defaultValue);
  }

  /**
   * Register or override parameter (e.g. from UI or DB sync)
   */
  public static registerParameter(param: AgriculturalParameter): void {
    this.parametersMap.set(param.key, { ...param });
  }

  public static registerCustomParameter(param: AgriculturalParameter): void {
    this.registerParameter(param);
  }

  public static registerCustomVariety(variety: CaneVarietyYieldMaster): void {
    const key = `VARIETY_MASTER_${variety.varietyCode.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
    this.registerParameter({
      id: `param-var-${variety.varietyCode.toLowerCase()}`,
      tenantId: "DEFAULT",
      category: "VARIETY_DECAY",
      name: `Variedad ${variety.varietyCode} (${variety.name})`,
      key,
      value: variety,
      unit: "object",
      source: "Catálogo Dinámico Agronómico",
      sourceSheet: "VARIEDADES",
      version: "1.0.0",
      effectiveFrom: new Date().toISOString(),
      validationStatus: "CONFIRMADO",
      description: `Variedad de caña ${variety.varietyCode} con TCH base ${variety.baseYieldTch} y Pol ${variety.polPercent}%.`,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Bulk load parameters (from Firestore or local persistence)
   */
  public static loadParameters(params: AgriculturalParameter[]): void {
    for (const p of params) {
      this.parametersMap.set(p.key, { ...p });
    }
  }

  /**
   * Reset all parameters back to canonical baseline
   */
  public static resetToCanonical(): void {
    this.parametersMap.clear();
    for (const param of CANONICAL_AGRICULTURAL_PARAMETERS) {
      this.parametersMap.set(param.key, { ...param });
    }
  }

  /**
   * Retrieve structured variety catalog from parameters
   */
  public static getVarietyCatalog(): Record<string, CaneVarietyYieldMaster> {
    const catalog: Record<string, CaneVarietyYieldMaster> = {};
    for (const [key, param] of this.parametersMap.entries()) {
      if (param.category === "VARIETY_DECAY" && typeof param.value === "object" && param.value !== null) {
        const variety = param.value as CaneVarietyYieldMaster;
        if (variety.varietyCode) {
          catalog[variety.varietyCode] = variety;
        }
      }
    }
    return catalog;
  }

  /**
   * Retrieve soil impact factors map from parameters
   */
  public static getSoilImpactFactors(): Record<SoilType, number> {
    return {
      FRANCO: this.getNumberValue("SOIL_FACTOR_FRANCO", 1.00),
      ARCILLOSO: this.getNumberValue("SOIL_FACTOR_ARCILLOSO", 0.98),
      ARENOSO: this.getNumberValue("SOIL_FACTOR_ARENOSO", 0.92),
    };
  }
}
