/**
 * BioAzúcar 4.0 — Agricultural Parameter Registry & Governance Master
 * Central audit authority for all agronomic, operational, mechanical and economic constants.
 * 
 * 100% Autonomous from external documents.
 * Operational parameters are versioned, configurable, and auditable internally.
 * 
 * Parameter Validation Statuses:
 * - PDA_VALIDATED: Empirically validated agronomic knowledge from canonical models (e.g. varietal decay curves).
 * - CONFIGURABLE: Operational setpoint designed to be adjusted per mill/campaign without code modifications.
 * - DERIVED: Computed deterministically from validated base parameters.
 * - BIOAZUCAR_MODEL: BioAzúcar 4.0 proprietary multi-variable optimizations (e.g. pedological indices, circular economy by-products).
 * - REQUIRES_VALIDATION: Parameter requiring field agronomist sign-off or laboratory certification for the specific mill.
 */

import {
  AgriculturalParameter,
  CaneVarietyYieldMaster,
  SoilType,
  ParameterValidationStatus,
  AgroParameterCategory,
} from "../../types/agriculture";

/**
 * Baseline Audited Canonical Parameters
 */
export const CANONICAL_AGRICULTURAL_PARAMETERS: AgriculturalParameter[] = [
  // 1. Commercial Varieties Catalog & Decay Retention
  {
    id: "param-var-rb86-7515",
    tenantId: "DEFAULT",
    category: "VARIEDAD",
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
    type: "object",
    description: "Variedad patrón brasileña RB. Curva empírica de retención de vigor vegetativo por corte sucesivo.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Estudio Agronómico PDA 2014 - Evolução TCH por Cepa",
    historicReference: "Modelo Canónico PDA Rev. 2014",
    createdBy: "Ingeniería Agronómica BioAzúcar",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Línea base canónica auditada",
    notes: "Curva empírica patrón para suelos de fertilidad media-alta.",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-var-sp80-3280",
    tenantId: "DEFAULT",
    category: "VARIEDAD",
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
    type: "object",
    description: "Cultivar precoz de alta rusticidad en suelos marginales y pronta maduración industrial.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Estudio Agronómico PDA 2014 - Evolução TCH por Cepa",
    historicReference: "Modelo Canónico PDA Rev. 2014",
    createdBy: "Ingeniería Agronómica BioAzúcar",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Línea base canónica auditada",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-var-ctc-4",
    tenantId: "DEFAULT",
    category: "VARIEDAD",
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
    type: "object",
    description: "Variedad Centro de Tecnología Cañera de alto tonelaje inicial y ciclo vegetativo extendido.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Estudio Agronómico PDA 2014 - Evolução TCH por Cepa",
    historicReference: "Modelo Canónico PDA Rev. 2014",
    createdBy: "Ingeniería Agronómica BioAzúcar",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Línea base canónica auditada",
    validationStatus: "PDA_VALIDATED",
  },

  // 2. Soil Impact Factors (BioAzúcar Multi-variable Pedological Model)
  {
    id: "param-soil-franco",
    tenantId: "DEFAULT",
    category: "SUELO",
    name: "Factor Edafológico Suelo Franco (Referencia Neutra)",
    key: "SOIL_FACTOR_FRANCO",
    value: 1.00,
    unit: "ratio",
    type: "factor",
    description: "Suelo franco de referencia con textura equilibrada y retención óptima de agua y aire.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Permanente",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo Edafológico BioAzúcar 4.0",
    historicReference: "Premisas Agronómicas de Pedología",
    createdBy: "Ingeniería Agronómica BioAzúcar",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Línea base de fertilidad",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-soil-arcilloso",
    tenantId: "DEFAULT",
    category: "SUELO",
    name: "Factor Edafológico Suelo Arcilloso",
    key: "SOIL_FACTOR_ARCILLOSO",
    value: 0.98,
    unit: "ratio",
    type: "factor",
    description: "Suelo pesado arcilloso: alta capacidad de campo hídrica pero mayor resistencia mecánica al enraizamiento.",
    version: "1.0.0",
    status: "BIOAZUCAR_MODEL",
    validity: "Permanente",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo Edafológico BioAzúcar 4.0",
    historicReference: "Premisas Agronómicas de Pedología",
    createdBy: "Ingeniería Agronómica BioAzúcar",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Calibración edafológica regional",
    validationStatus: "BIOAZUCAR_MODEL",
  },
  {
    id: "param-soil-arenoso",
    tenantId: "DEFAULT",
    category: "SUELO",
    name: "Factor Edafológico Suelo Arenoso",
    key: "SOIL_FACTOR_ARENOSO",
    value: 0.92,
    unit: "ratio",
    type: "factor",
    description: "Suelo liviano arenoso: drenaje rápido con menor retención de nutrientes catiónicos y agua útil.",
    version: "1.0.0",
    status: "BIOAZUCAR_MODEL",
    validity: "Permanente",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo Edafológico BioAzúcar 4.0",
    historicReference: "Premisas Agronómicas de Pedología",
    createdBy: "Ingeniería Agronómica BioAzúcar",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Calibración edafológica regional",
    validationStatus: "BIOAZUCAR_MODEL",
  },

  // 3. Agro Operations Catalog (Preparación, Siembra, Tratos)
  {
    id: "param-op-subsolado",
    tenantId: "DEFAULT",
    category: "PREPARACION_SUELO",
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
    type: "object",
    description: "Descompactación mecánica de horizonte B en suelo antes de la reforma.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Catálogo de Operaciones Agrícolas Mecanizadas",
    historicReference: "Normas de Preparación de Suelo",
    createdBy: "Jefatura de Maquinaria Agrícola",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Rendimiento y consumo horario calibrado",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-op-arado-disco",
    tenantId: "DEFAULT",
    category: "PREPARACION_SUELO",
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
    type: "object",
    description: "Inversión de prisma y rotura primaria de cepas viejas.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Catálogo de Operaciones Agrícolas Mecanizadas",
    historicReference: "Normas de Preparación de Suelo",
    createdBy: "Jefatura de Maquinaria Agrícola",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Parámetros de potencia e implemento",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-op-grada-intermedia",
    tenantId: "DEFAULT",
    category: "PREPARACION_SUELO",
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
    type: "object",
    description: "Refinamiento de cama de siembra y destrucción de terrones.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Catálogo de Operaciones Agrícolas Mecanizadas",
    historicReference: "Normas de Preparación de Suelo",
    createdBy: "Jefatura de Maquinaria Agrícola",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Rendimiento operativo estándar",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-op-encalado",
    tenantId: "DEFAULT",
    category: "PREPARACION_SUELO",
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
    type: "object",
    description: "Corrección de acidez y neutralización de aluminio intercambiable en suelo.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Catálogo de Operaciones Agrícolas Mecanizadas",
    historicReference: "Normas de Enmiendas y Suelo",
    createdBy: "Jefatura de Maquinaria Agrícola",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Norma de aplicación",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-op-surcado",
    tenantId: "DEFAULT",
    category: "PLANTIO",
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
    type: "object",
    description: "Apertura de surco a 1.50m con colocación simultánea de fertilizante fosforado de base.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Catálogo de Operaciones de Siembra",
    historicReference: "Normas de Plantación Mecanizada",
    createdBy: "Jefatura de Siembra",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Parámetros de espaciamiento y capacidad",
    validationStatus: "CONFIGURABLE",
  },

  // 4. Machinery Scheduling & Availability Limits
  {
    id: "param-hours-soil-prep",
    tenantId: "DEFAULT",
    category: "MAQUINARIA",
    name: "Jornada Diaria Efectiva en Preparación de Suelo",
    key: "HOURS_PER_DAY_SOIL_PREP",
    value: 16.0,
    unit: "h/día",
    type: "numeric",
    description: "Horas operativas programadas por día en dos turnos de laboreo de suelo.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Plan Maestro de Operación de Maquinaria",
    historicReference: "Jornada Operacional de Tracción",
    createdBy: "Gerencia Agrícola",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Turno doble de 8 horas con relevo",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-avail-soil-prep",
    tenantId: "DEFAULT",
    category: "MAQUINARIA",
    name: "Disponibilidad Mecánica Flota de Preparación",
    key: "EQUIPMENT_AVAILABILITY_SOIL_PREP",
    value: 0.85,
    unit: "ratio",
    type: "factor",
    description: "Porcentaje de confiabilidad y disponibilidad mecánica neta de tractores e implementos.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Plan Maestro de Mantenimiento Flota Agrícola",
    historicReference: "Disponibilidad Operativa Mecánica",
    createdBy: "Gerencia de Mantenimiento",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Meta de confiabilidad OEE",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-harvester-hours-day",
    tenantId: "DEFAULT",
    category: "MAQUINARIA",
    name: "Jornada Diaria Efectiva de Cosechadoras",
    key: "HARVESTER_HOURS_PER_DAY",
    value: 18.0,
    unit: "h/día",
    type: "numeric",
    description: "Horas efectivas diarias de corte continuo por máquina en zafra.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Manual de Cosecha Mecanizada BioAzúcar",
    historicReference: "Régimen de Corte Cosechadoras",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Régimen de 3 turnos rotativos",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-harvester-avail-factor",
    tenantId: "DEFAULT",
    category: "MAQUINARIA",
    name: "Disponibilidad Mecánica de Cosechadoras",
    key: "HARVESTER_AVAILABILITY_FACTOR",
    value: 0.82,
    unit: "ratio",
    type: "factor",
    description: "Disponibilidad mecánica esperada de cosechadoras de caña picada en campo.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Manual de Cosecha Mecanizada BioAzúcar",
    historicReference: "Estándar de Disponibilidad de Cosecha",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Estándar de disponibilidad mecánica",
    validationStatus: "CONFIGURABLE",
  },

  // 5. Benchmark Equipment Acquisition Prices USD (CAPEX Reference)
  {
    id: "param-price-tractor-pesado",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Benchmark Tractor Pesado 210 HP",
    key: "PRICE_TRACTOR_PESADO_USD",
    value: 190000.0,
    unit: "USD/unidad",
    type: "currency",
    description: "Precio benchmark de adquisición de tractor agrícola de tiro pesado.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Cotizaciones de Activos de Capital Agrícola",
    historicReference: "Presupuesto CAPEX de Maquinaria",
    createdBy: "Compras y Finanzas",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Actualización de precios de mercado",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-tractor-medio",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Benchmark Tractor Medio 140 HP",
    key: "PRICE_TRACTOR_MEDIO_USD",
    value: 125000.0,
    unit: "USD/unidad",
    type: "currency",
    description: "Precio benchmark tractor tracción asistida para labores intermedias y siembra.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Cotizaciones de Activos de Capital Agrícola",
    historicReference: "Presupuesto CAPEX de Maquinaria",
    createdBy: "Compras y Finanzas",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Actualización de precios de mercado",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-tractor-ligero",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Benchmark Tractor Ligero 100 HP",
    key: "PRICE_TRACTOR_LIGERO_USD",
    value: 85000.0,
    unit: "USD/unidad",
    type: "currency",
    description: "Precio tractor utilitario para pulverización y cultivos mecánicos entre líneas.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Cotizaciones de Activos de Capital Agrícola",
    historicReference: "Presupuesto CAPEX de Maquinaria",
    createdBy: "Compras y Finanzas",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Actualización de precios de mercado",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-cosechadora",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Benchmark Cosechadora Combinada de Caña 350 HP",
    key: "PRICE_COSECHADORA_COMBINADA_USD",
    value: 450000.0,
    unit: "USD/unidad",
    type: "currency",
    description: "Cosechadora de caña picada sobre orugas con extractor primario flotante.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Cotizaciones de Activos de Capital Agrícola",
    historicReference: "Presupuesto CAPEX de Maquinaria",
    createdBy: "Compras y Finanzas",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Actualización de precios de mercado",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-transbordo",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Benchmark Conjunto Transbordo 14 t",
    key: "PRICE_TRACTOR_TRANSBORDO_USD",
    value: 165000.0,
    unit: "USD/unidad",
    type: "currency",
    description: "Tractor agrícola 140 HP equipado con vagón tolva basculante de campo.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Cotizaciones de Activos de Capital Agrícola",
    historicReference: "Presupuesto CAPEX de Maquinaria",
    createdBy: "Compras y Finanzas",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Actualización de precios de mercado",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-camion-cct",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Benchmark Camión Rodoviario Bi-tren 45 t",
    key: "PRICE_CAMION_CANERO_RODOVIARIO_USD",
    value: 210000.0,
    unit: "USD/unidad",
    type: "currency",
    description: "Tractor carretero 6x4 con semirremolques tipo cañero volcables laterales.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Cotizaciones de Activos de Capital Agrícola",
    historicReference: "Presupuesto CAPEX de Logística",
    createdBy: "Compras y Finanzas",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Actualización de precios de mercado",
    validationStatus: "CONFIGURABLE",
  },

  // 6. Benchmark Economic OPEX Inputs
  {
    id: "param-price-diesel",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Diesel Agroindustrial Puesto en Tanque",
    key: "PRICE_DIESEL_USD_PER_LITER",
    value: 0.95,
    unit: "USD/L",
    type: "currency",
    description: "Costo de adquisición mayorista de combustible diesel puesto en tanques de patio rural.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Contratos de Suministro de Combustibles",
    historicReference: "Presupuesto Energético OPEX",
    createdBy: "Gerencia Financiera",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Tarifa mayorista contratada",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-npk",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Fertilizante Granulado N-P-K Mezcla",
    key: "PRICE_FERTILIZER_NPK_USD_PER_TON",
    value: 620.0,
    unit: "USD/t",
    type: "currency",
    description: "Precio tonelada métrica de fertilizante mineral formulado para cañaveral.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Licitación de Insumos Químicos y Fertilizantes",
    historicReference: "Presupuesto de Insumos OPEX",
    createdBy: "Gerencia Financiera",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Precio de importación cerrado",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-cal",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Precio Cal Dolomítica / Enmienda",
    key: "PRICE_LIME_AMENDMENT_USD_PER_TON",
    value: 45.0,
    unit: "USD/t",
    type: "currency",
    description: "Costo de cal agrícola a granel puesta en cabecera de lote.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Contratos de Enmiendas Calcáreas",
    historicReference: "Presupuesto de Insumos OPEX",
    createdBy: "Gerencia Financiera",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Tarifa flete y producto",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-price-herbicida",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Costo Promedio Herbicidas y Defensivos por Hectárea",
    key: "COST_HERBICIDE_USD_PER_HA",
    value: 35.0,
    unit: "USD/ha",
    type: "currency",
    description: "Paquete de control de malezas en pre y post-emergencia temprana por hectárea tratada.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Programa de Manejo Integrado de Malezas",
    historicReference: "Presupuesto de Sanidad Vegetal",
    createdBy: "Sanidad Vegetal",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Ajuste de dosis y moléculas",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-cost-mach-maint",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Costo Mantenimiento y Repuestos por Hora Máquina",
    key: "COST_MACHINERY_MAINTENANCE_USD_PER_HOUR",
    value: 12.50,
    unit: "USD/h",
    type: "currency",
    description: "Lubricantes, filtros, cuchillas de corte y desgaste mecánico por horómetro.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Historial de Órdenes de Trabajo de Taller Central",
    historicReference: "Costo Horario de Mantenimiento",
    createdBy: "Jefatura de Taller",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Tasa histórica de mantenimiento preventivo",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-labor-monthly",
    tenantId: "DEFAULT",
    category: "ECONOMIA",
    name: "Salario Promedio Operador / Chofer CCT",
    key: "LABOR_OPERATOR_MONTHLY_USD",
    value: 1450.0,
    unit: "USD/mes",
    type: "currency",
    description: "Costo laboral integrado con cargas sociales para operador calificado de maquinaria pesada.",
    version: "1.0.0",
    status: "REQUIRES_VALIDATION",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Escala Salarial y Convenio Colectivo Agroindustrial",
    historicReference: "Presupuesto de Mano de Obra",
    createdBy: "Recursos Humanos",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Actualización salarial anual",
    validationStatus: "REQUIRES_VALIDATION",
  },

  // 7. Diesel Consumption Factors
  {
    id: "param-diesel-harvest-rate",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Consumo Diesel Específico en Cosecha Mecanizada",
    key: "DIESEL_HARVEST_LITERS_PER_TON",
    value: 4.2,
    unit: "L/t caña",
    type: "rate",
    description: "Consumo combinado de cosechadora picadora + tractor de transbordo en corte (L por tonelada).",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Telemetría de Cosecha & Balance de Combustibles PDA",
    historicReference: "Norma de Consumo Específico de Cosecha",
    createdBy: "Ingeniería de Combustibles",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Validación mediante telemetría CAN-bus",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-diesel-transport-rate",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Consumo Diesel Específico en Transporte CCT",
    key: "DIESEL_TRANSPORT_LITERS_PER_TON",
    value: 1.8,
    unit: "L/t caña",
    type: "rate",
    description: "Consumo medio de combustible en carretera rodoviaria por tonelada cañera entregada en báscula.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Telemetría de Flota CCT & Balance de Combustibles PDA",
    historicReference: "Norma de Consumo Específico de Transporte",
    createdBy: "Ingeniería de Combustibles",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Validación por odómetro y aforo de tanques",
    validationStatus: "PDA_VALIDATED",
  },

  // 8. Ratoon Maintenance & Seed Cane Inputs
  {
    id: "param-fertilizer-ratoon-rate",
    tenantId: "DEFAULT",
    category: "TRATOS_CULTURALES",
    name: "Dosis Fertilizante de Cobertera en Soca / Retoño",
    key: "FERTILIZER_RATOON_KG_PER_HA",
    value: 350.0,
    unit: "kg/ha",
    type: "rate",
    description: "Fertilización nitrogenada y potásica de mantenimiento en retoño (350 kg/ha NPK).",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Manual de Nutrición Vegetal BioAzúcar",
    historicReference: "Dosis Estándar de Nutrición en Retoño",
    createdBy: "Jefatura Agronómica",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Plan de fertilización anual",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-seed-cane-rate",
    tenantId: "DEFAULT",
    category: "PLANTIO",
    name: "Dosis de Caña Semilla en Siembra Mecanizada",
    key: "SEED_CANE_RATE_TONS_PER_HA",
    value: 13.5,
    unit: "t/ha",
    type: "rate",
    description: "Consumo de semilla troceada por hectárea sembrada con plantadora de 2 líneas.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Norma Técnica de Plantación Mecanizada PDA",
    historicReference: "Dosis de Semilla de Caña",
    createdBy: "Jefatura de Siembra",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Calibración de densidad de yemas viables",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-basal-fertilizer-rate",
    tenantId: "DEFAULT",
    category: "PLANTIO",
    name: "Dosis Fertilizante de Fondo en Siembra",
    key: "FERTILIZER_BASAL_KG_PER_HA",
    value: 400.0,
    unit: "kg/ha",
    type: "rate",
    description: "Dosis de fertilizante en fondo de surco durante el plantío mecanizado.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Manual de Nutrición Vegetal BioAzúcar",
    historicReference: "Dosis de Fondo en Plantío",
    createdBy: "Jefatura Agronómica",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Dosis de fósforo y potasio en siembra",
    validationStatus: "CONFIGURABLE",
  },

  // 9. Vinasse & Filter Cake By-Products (BioAzúcar Circular Economy Model)
  {
    id: "param-vinasse-application-rate",
    tenantId: "DEFAULT",
    category: "TRATOS_CULTURALES",
    name: "Dosis de Fertirriego con Vinaza Fabril",
    key: "VINASSE_APPLICATION_RATE_M3_PER_HA",
    value: 150.0,
    unit: "m³/ha",
    type: "rate",
    description: "Volumen de vinaza reciclada de destilería aplicado mediante aspersión o cañón enrollador.",
    version: "1.0.0",
    status: "BIOAZUCAR_MODEL",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo de Economía Circular BioAzúcar 4.0",
    historicReference: "Programa Ambiental de Fertirriego",
    createdBy: "Gestión Ambiental y Destilería",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Balance agronómico de potasio y pH",
    validationStatus: "BIOAZUCAR_MODEL",
  },
  {
    id: "param-vinasse-coverage-ratio",
    tenantId: "DEFAULT",
    category: "TRATOS_CULTURALES",
    name: "Cobertura de Fertirriego en Área Retoño",
    key: "VINASSE_COVERAGE_RATIO",
    value: 0.60,
    unit: "ratio",
    type: "factor",
    description: "Porcentaje de los campos de retoño dentro del radio económico de bombeo o transporte de vinaza.",
    version: "1.0.0",
    status: "BIOAZUCAR_MODEL",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo de Economía Circular BioAzúcar 4.0",
    historicReference: "Radio Hidráulico de Distribución de Vinaza",
    createdBy: "Gestión Ambiental y Destilería",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Ampliación de red de canales y tuberías",
    validationStatus: "BIOAZUCAR_MODEL",
  },
  {
    id: "param-filter-cake-rate",
    tenantId: "DEFAULT",
    category: "TRATOS_CULTURALES",
    name: "Dosis de Aplicación de Cachaza de Filtro",
    key: "FILTER_CAKE_APPLICATION_RATE_TONS_PER_HA",
    value: 30.0,
    unit: "t/ha",
    type: "rate",
    description: "Torta de filtración orgánica de fábrica aplicada en surco o preparación de suelo.",
    version: "1.0.0",
    status: "BIOAZUCAR_MODEL",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo de Economía Circular BioAzúcar 4.0",
    historicReference: "Aprovechamiento de Coproductos Fabriles",
    createdBy: "Gestión Ambiental y Destilería",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Enmienda orgánica rica en fósforo y humedad",
    validationStatus: "BIOAZUCAR_MODEL",
  },

  // 10. CCT Speeds & Cycle Dynamics
  {
    id: "param-cct-speed-empty",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Velocidad Media Camión Vacío (Retorno a Campo)",
    key: "CCT_SPEED_EMPTY_KM_H",
    value: 45.0,
    unit: "km/h",
    type: "numeric",
    description: "Velocidad media rodoviaria en ciclo de retorno vacío hacia el frente de cosecha.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo Operativo de Logística CCT PDA",
    historicReference: "Velocidades de Circulación de Flota",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Calibración con tacógrafo y GPS",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-cct-speed-loaded",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Velocidad Media Camión Cargado (Viaje a Fábrica)",
    key: "CCT_SPEED_LOADED_KM_H",
    value: 32.0,
    unit: "km/h",
    type: "numeric",
    description: "Velocidad media ponderada con carga completa rodoviaria en caminos secundarios y ruta.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo Operativo de Logística CCT PDA",
    historicReference: "Velocidades de Circulación de Flota",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Calibración con tacógrafo y GPS",
    validationStatus: "PDA_VALIDATED",
  },

  // 11. CCT Truck Payload & Utilization Factor
  {
    id: "param-cct-truck-payload",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Carga Neta por Camión Bi-tren CCT",
    key: "CCT_TRUCK_PAYLOAD_TONS",
    value: 45.0,
    unit: "t/camión",
    type: "numeric",
    description: "Capacidad útil reglamentaria de transporte de caña picada por conjunto articulado bi-tren.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Norma Operacional de Transporte de Caña PDA",
    historicReference: "Carga Media Reglamentaria",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Límite legal de carga por eje",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-cct-utilization-factor",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Factor de Utilización Diaria Flota CCT (19.2 h efectivas)",
    key: "CCT_UTILIZATION_FACTOR",
    value: 0.80,
    unit: "ratio",
    type: "factor",
    description: "24 horas × 0.80 = 19.2 horas efectivas de rodaje, carga y descarga.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo Operativo de Logística CCT PDA",
    historicReference: "Coeficiente de Disponibilidad de Flota",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Descuento por relevos e inspección",
    validationStatus: "PDA_VALIDATED",
  },

  // 12. CCT Operational Cycle Ancillary Times
  {
    id: "param-cct-loading-time",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Tiempo de Carga en Frente (Transbordo a Camión)",
    key: "CCT_LOADING_IN_FIELD_HOURS",
    value: 0.45,
    unit: "horas",
    type: "numeric",
    description: "27 minutos de alce continuo mediante vagones de transbordo en cabecera de lote.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Estudio de Tiempos y Movimientos CCT PDA",
    historicReference: "Tiempo Estándar de Alce en Campo",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Cronometraje de transbordo en cabecera",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-cct-unloading-time",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Tiempo de Descarga en Conductor / Mesa Receptora",
    key: "CCT_UNLOADING_AT_MILL_HOURS",
    value: 0.35,
    unit: "horas",
    type: "numeric",
    description: "21 minutos en volcador lateral o mesa receptora de caña en fábrica.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Estudio de Tiempos y Movimientos Patio Fabril PDA",
    historicReference: "Tiempo Estándar de Descarga en Mesa",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Cronometraje de volteo y limpieza de batea",
    validationStatus: "PDA_VALIDATED",
  },
  {
    id: "param-cct-field-queue-time",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Tiempo de Espera en Cola de Campo",
    key: "CCT_FIELD_QUEUE_HOURS",
    value: 0.15,
    unit: "horas",
    type: "numeric",
    description: "9 minutos de maniobra y acople en cabecera de corte.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Estudio de Tiempos y Movimientos CCT",
    historicReference: "Tiempo de Maniobra de Cabecera",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Optimización de radio de giro",
    validationStatus: "CONFIGURABLE",
  },
  {
    id: "param-cct-weighbridge-queue-time",
    tenantId: "DEFAULT",
    category: "CCT_LOGISTICA",
    name: "Tiempo en Báscula & Muestreo Core Sampler",
    key: "CCT_WEIGHBRIDGE_QUEUE_HOURS",
    value: 0.20,
    unit: "horas",
    type: "numeric",
    description: "12 minutos en pesaje de entrada, muestreo PCT y pesaje de tara de salida.",
    version: "1.0.0",
    status: "CONFIGURABLE",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Procedimiento de Laboratorio y Báscula Cañera",
    historicReference: "Tiempo de Recepción y Calidad",
    createdBy: "Control de Calidad Fabril",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Automatización de sonda muestreadora",
    validationStatus: "CONFIGURABLE",
  },

  // 13. TCH Threshold for Renovation / Demolition
  {
    id: "param-tch-renovation-threshold",
    tenantId: "DEFAULT",
    category: "VARIEDAD",
    name: "Umbral Mínimo Económico de TCH para Demolición",
    key: "MIN_ECONOMIC_TCH_THRESHOLD",
    value: 55.0,
    unit: "t/ha",
    type: "numeric",
    description: "Rendimiento agronómico por debajo del cual los costos fijos y variables de cosecha superan el ingreso de azúcar.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Modelo de Punto de Equilibrio Económico Agrícola PDA",
    historicReference: "Criterio de Demolición Económica",
    createdBy: "Planificación Agronómica",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Validación de margen de contribución por lote",
    notes: "Lotes con TCH proyectado inferior a 55 t/ha se catalogan automáticamente para reforma.",
    validationStatus: "PDA_VALIDATED",
  },

  // 14. Harvester Standard Effective Capacity
  {
    id: "param-harvester-effective-capacity",
    tenantId: "DEFAULT",
    category: "MAQUINARIA",
    name: "Capacidad Efectiva de Cosechadora Combinada",
    key: "HARVESTER_EFFECTIVE_CAPACITY_TCH",
    value: 52.0,
    unit: "t/h",
    type: "numeric",
    description: "Toneladas efectivas de caña cosechadas por hora neta de avance de corte en lote comercial.",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    validity: "Zafra Vigente 2026/2027",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    provenanceDoc: "Manual de Rendimiento Operativo de Cosecha PDA",
    historicReference: "Capacidad Nominal de Cosecha Mecanizada",
    createdBy: "Superintendencia de CCT",
    updatedBy: "Sistema BioAzúcar 4.0",
    updatedAt: "2026-09-01T00:00:00.000Z",
    changeReason: "Rendimiento de corte en hileras de 1.50m",
    validationStatus: "PDA_VALIDATED",
  },
];

/**
 * Parameter Store and Registry Service
 * Provides in-memory fast lookups, default fallbacks, and governance management.
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
   * Get parameters filtered by validation status
   */
  public static getParametersByStatus(status: ParameterValidationStatus): AgriculturalParameter[] {
    return this.getAllParameters().filter((p) => p.status === status || p.validationStatus === status);
  }

  /**
   * Get parameters filtered by category
   */
  public static getParametersByCategory(category: AgroParameterCategory): AgriculturalParameter[] {
    return this.getAllParameters().filter((p) => p.category === category);
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
   * Update an existing parameter with audit trail
   */
  public static updateParameter(
    idOrKey: string,
    updates: Partial<AgriculturalParameter>,
    user: string = "Usuario BioAzúcar",
    reason: string = "Ajuste operativo"
  ): AgriculturalParameter | null {
    let existing = this.parametersMap.get(idOrKey);
    if (!existing) {
      for (const p of this.parametersMap.values()) {
        if (p.id === idOrKey) {
          existing = p;
          break;
        }
      }
    }
    if (!existing) return null;

    const updated: AgriculturalParameter = {
      ...existing,
      ...updates,
      updatedBy: user,
      updatedAt: new Date().toISOString(),
      changeReason: reason || updates.changeReason || existing.changeReason,
      validationStatus: updates.status || existing.status,
    };

    this.parametersMap.set(updated.key, updated);
    return updated;
  }

  /**
   * Register or override parameter (e.g. from UI or DB sync)
   */
  public static registerParameter(param: AgriculturalParameter): void {
    const normalized: AgriculturalParameter = {
      ...param,
      validationStatus: param.status || param.validationStatus || "CONFIGURABLE",
      status: param.status || (param.validationStatus as ParameterValidationStatus) || "CONFIGURABLE",
      updatedAt: param.updatedAt || new Date().toISOString(),
    };
    this.parametersMap.set(normalized.key, normalized);
  }

  public static registerCustomParameter(param: AgriculturalParameter): void {
    this.registerParameter(param);
  }

  public static registerCustomVariety(variety: CaneVarietyYieldMaster, user: string = "Agrónomo BioAzúcar"): void {
    const key = `VARIETY_MASTER_${variety.varietyCode.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
    this.registerParameter({
      id: `param-var-${variety.varietyCode.toLowerCase()}`,
      tenantId: "DEFAULT",
      category: "VARIEDAD",
      name: `Variedad ${variety.varietyCode} (${variety.name})`,
      key,
      value: variety,
      unit: "object",
      type: "object",
      version: "1.0.0",
      status: "CONFIGURABLE",
      validity: "Zafra Vigente 2026/2027",
      effectiveFrom: new Date().toISOString(),
      provenanceDoc: "Catálogo Interno Dinámico de Variedades BioAzúcar",
      historicReference: "Incorporación Agronómica Local",
      createdBy: user,
      updatedBy: user,
      updatedAt: new Date().toISOString(),
      changeReason: "Alta de nuevo cultivar comercial",
      description: `Variedad de caña ${variety.varietyCode} con TCH base ${variety.baseYieldTch} y Pol ${variety.polPercent}%.`,
      validationStatus: "CONFIGURABLE",
    });
  }

  /**
   * Bulk load parameters (from Firestore or local persistence)
   */
  public static loadParameters(params: AgriculturalParameter[]): void {
    for (const p of params) {
      const normalized: AgriculturalParameter = {
        ...p,
        status: p.status || (p.validationStatus as ParameterValidationStatus) || "CONFIGURABLE",
        validationStatus: p.status || p.validationStatus || "CONFIGURABLE",
      };
      this.parametersMap.set(normalized.key, normalized);
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
      if (
        (param.category === "VARIEDAD" || (param.category as string) === "VARIETY_DECAY") &&
        typeof param.value === "object" &&
        param.value !== null
      ) {
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
