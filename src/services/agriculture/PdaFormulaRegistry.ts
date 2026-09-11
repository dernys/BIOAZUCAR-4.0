/**
 * BioAzúcar 4.0 — Agricultural Mathematical Model & Formula Governance Master
 * Canonical source of truth for all agronomic equations, physical boundaries and lineage.
 * 
 * 100% Autonomous and decoupled from external spreadsheet files.
 * Provides versioned, auditable, and configurable formulas for:
 * 1. PDA_VALIDATED (Canonical historical validated equations)
 * 2. BIOAZUCAR_MODEL (Multi-variable multivariate predictive models: Soil + Climate + NDVI)
 * 3. WHAT_IF_SCENARIO (Sensitivity & scenario simulations)
 */

import {
  PdaFormulaMaster,
  PdaFormulaStatus,
  PdaModelOrigin,
  CalculationTrace,
  AgroModelType,
} from "../../types/agriculture";

export const CANONICAL_PDA_FORMULAS: PdaFormulaMaster[] = [
  // 1. TCH Individual de Parcela - Modelo Canónico Validado (Empirical Ratoon Decay Only)
  {
    formulaId: "TCH_PROYECTADO_V1",
    name: "Rendimiento Agrícola Proyectado por Parcela (TCH Canónico PDA)",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "RENDIMIENTO_TCH",
    expression: "TCH = BaseYieldTch * RatoonDecay(Stage)",
    variables: [
      { name: "TCH Base del Cultivar", symbol: "BaseYieldTch", unit: "t/ha", description: "Rendimiento intrínseco en ciclo Planta", moduleCategory: "VARIEDAD" },
      { name: "Factor de Decaimiento de Cepa", symbol: "RatoonDecay", unit: "ratio", description: "Retención empírica de vigor vegetativo por corte sucesivo (Planta a Q7+)", moduleCategory: "VARIEDAD" },
      { name: "Corte / Ciclo Vegetativo", symbol: "Stage", unit: "corte", description: "Estado de la cepa (Planta, Soca 1, etc.)", moduleCategory: "VARIEDAD" },
      { name: "Superficie de Lote", symbol: "AreaHa", unit: "ha", description: "Superficie del lote en hectáreas", moduleCategory: "CAMPANA" },
    ],
    units: "t/ha",
    description: "Modelo canónico empírico para proyección determinística de biomasa cañera por lote según ciclo vegetativo.",
    provenanceDoc: "Modelo Agronómico Canónico PDA 2014 (Evolução TCH por Cepa)",
    historicReference: "Curva empírica de decaimiento por corte",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
    rules: [
      "Si la parcela está en DEMOLICION, el TCH es estrictamente 0.00 t/ha",
      "El factor de decaimiento en PLANTA es 1.00",
    ],
    notes: "Fórmula base canónica validada. Para factores edáficos y climáticos usar el modelo multivariante BioAzúcar 4.0.",
  },

  // 1b. TCH Multivariante BioAzúcar 4.0 (Soil + Climate Enrichment)
  {
    formulaId: "TCH_PROYECTADO_BIOAZUCAR_V1",
    name: "Rendimiento Agrícola Multivariante BioAzúcar 4.0 (TCH Enriquecido)",
    version: "1.1.0",
    status: "BIOAZUCAR_MODEL",
    modelOrigin: "BIOAZUCAR_4_0",
    moduleCategory: "RENDIMIENTO_TCH",
    expression: "TCH = BaseYieldTch * RatoonDecay(Stage) * SoilFactor(SoilType) * ClimateFactor",
    variables: [
      { name: "TCH Base del Cultivar", symbol: "BaseYieldTch", unit: "t/ha", description: "Rendimiento intrínseco en ciclo Planta", moduleCategory: "VARIEDAD" },
      { name: "Factor de Decaimiento de Cepa", symbol: "RatoonDecay", unit: "ratio", description: "Retención de vigor vegetativo por corte", moduleCategory: "VARIEDAD" },
      { name: "Factor Edafológico de Suelo", symbol: "SoilFactor", unit: "ratio", description: "Modificador por textura de suelo (Franco 1.0, Arcilloso 0.98, Arenoso 0.92)", moduleCategory: "SUELO" },
      { name: "Factor Agroclimático", symbol: "ClimateFactor", unit: "ratio", description: "Ajuste por balance hídrico y radiación fotosintética de campaña", moduleCategory: "CLIMA" },
    ],
    units: "t/ha",
    description: "Modelo predictivo multivariante de BioAzúcar 4.0 con ajuste edafológico y agroclimático.",
    provenanceDoc: "Motor de Inteligencia Agronómica BioAzúcar 4.0",
    historicReference: "Enriquecimiento Multivariante",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    isEditable: true,
    notes: "Modelo avanzado multivariante. Incorpora balance hídrico y textura de suelo.",
  },

  // 1c. TCH What-If Escenarios
  {
    formulaId: "TCH_PROYECTADO_WHAT_IF_V1",
    name: "Simulación de Rendimiento Agrícola (What-If Sensibilidad)",
    version: "1.0.0",
    status: "CONFIGURABLE",
    modelOrigin: "BIOAZUCAR_4_0",
    moduleCategory: "RENDIMIENTO_TCH",
    expression: "TCH = BaseYieldTch * RatoonDecay(Stage) * SoilFactor(SoilType) * ClimateFactor * (1 + TchVarPct / 100)",
    variables: [
      { name: "TCH Base del Cultivar", symbol: "BaseYieldTch", unit: "t/ha", description: "Rendimiento intrínseco en ciclo Planta", moduleCategory: "VARIEDAD" },
      { name: "Factor de Decaimiento", symbol: "RatoonDecay", unit: "ratio", description: "Retención de vigor por corte", moduleCategory: "VARIEDAD" },
      { name: "Factor de Suelo", symbol: "SoilFactor", unit: "ratio", description: "Modificador edafológico", moduleCategory: "SUELO" },
      { name: "Factor Climático", symbol: "ClimateFactor", unit: "ratio", description: "Modificador climático", moduleCategory: "CLIMA" },
      { name: "Variación Porcentual What-If", symbol: "TchVarPct", unit: "%", description: "Variación simulada en escenarios de estrés hídrico o fertilización", moduleCategory: "ESCENARIOS" },
    ],
    units: "t/ha",
    description: "Fórmula de simulación paramétrica para análisis de sensibilidad y escenarios de estrés climático.",
    provenanceDoc: "Módulo de Simulación Predictiva BioAzúcar 4.0",
    historicReference: "Simulación Paramétrica",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    isEditable: true,
  },

  // 2. Producción Total en Toneladas por Parcela
  {
    formulaId: "PRODUCCION_LOTE_V1",
    name: "Producción Total de Caña por Lote",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "RENDIMIENTO_TCH",
    expression: "ProductionTons = AreaHectares * TCH",
    variables: [
      { name: "Área de la Parcela", symbol: "AreaHectares", unit: "ha", description: "Superficie efectiva cultivada del lote", moduleCategory: "CATASTRO" },
      { name: "TCH Proyectado", symbol: "TCH", unit: "t/ha", description: "Toneladas de caña por hectárea según modelo activo", moduleCategory: "RENDIMIENTO_TCH" },
    ],
    units: "t",
    description: "Cálculo de biomasa cosechable neta por parcela catastrada.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Multiplicación de Superficie por Productividad",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
    notes: "Si la parcela está en DEMOLICIÓN, la producción computable es 0.00 t.",
  },

  // 3. Balance Dinámico de Áreas
  {
    formulaId: "AREA_FINAL_V1",
    name: "Balance Dinámico de Áreas Cañeras (Conservación Catastral)",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "BALANCE_AREAS",
    expression: "AreaFinal = AreaInicial + Plantacion - Demolicion + AltasTierras - BajasTierras",
    variables: [
      { name: "Área Inicial de Zafra", symbol: "AreaInicial", unit: "ha", description: "Superficie cañera al cierre de zafra previa", moduleCategory: "BALANCE_AREAS" },
      { name: "Área Plantada / Renovada", symbol: "Plantacion", unit: "ha", description: "Nueva caña planta incorporada", moduleCategory: "PLANTIO" },
      { name: "Área Demolida", symbol: "Demolicion", unit: "ha", description: "Cañaverales viejos erradicados para reforma", moduleCategory: "BALANCE_AREAS" },
      { name: "Nuevas Incorporaciones", symbol: "AltasTierras", unit: "ha", description: "Tierras nuevas arrendadas o habilitadas", moduleCategory: "BALANCE_AREAS" },
      { name: "Bajas de Patrimonio", symbol: "BajasTierras", unit: "ha", description: "Devolución de arriendos o cambios de uso de suelo", moduleCategory: "BALANCE_AREAS" },
    ],
    units: "ha",
    description: "Garantiza la conservación rigurosa de superficie y balance catastral entre campañas.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014 (Balanço de Áreas de Cana)",
    historicReference: "Balance Catastral de Superficies",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 4. Promedio Ponderado TCH de Campaña
  {
    formulaId: "TCH_MEDIO_CAMPANA_V1",
    name: "TCH Medio Ponderado de Campaña Agrícola",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "RENDIMIENTO_TCH",
    expression: "AverageTCH = Sum(ProductionTons) / (TotalAreaHa - DemolitionAreaHa)",
    variables: [
      { name: "Producción Total Acumulada", symbol: "Sum(ProductionTons)", unit: "t", description: "Suma de toneladas proyectadas en todos los lotes activos", moduleCategory: "RENDIMIENTO_TCH" },
      { name: "Área Total Catastrada", symbol: "TotalAreaHa", unit: "ha", description: "Superficie total de parcelas registradas", moduleCategory: "CATASTRO" },
      { name: "Área en Demolición / Barbecho", symbol: "DemolitionAreaHa", unit: "ha", description: "Área no cosechable en preparación de suelo", moduleCategory: "BALANCE_AREAS" },
    ],
    units: "t/ha",
    description: "Promedio ponderado real por hectárea cosechable.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Ponderación Productiva de Campaña",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
    notes: "Excluye estrictamente las áreas en demolición del denominador productivo.",
  },

  // 5. Demanda Diaria de Molienda de Fábrica
  {
    formulaId: "DEMANDA_DIARIA_V1",
    name: "Demanda Diaria de Cosecha para Fábrica",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "COSECHA_CCT",
    expression: "DailyDemand = TotalProjectedCaneTons / EffectiveHarvestDays",
    variables: [
      { name: "Producción Total de Zafra", symbol: "TotalProjectedCaneTons", unit: "t", description: "Toneladas totales a cosechar en la zafra", moduleCategory: "RENDIMIENTO_TCH" },
      { name: "Días Efectivos de Zafra", symbol: "EffectiveHarvestDays", unit: "días", description: "Días calendario menos días perdidos por lluvia o mantenimiento", moduleCategory: "PLANIFICACION" },
    ],
    units: "t/día",
    description: "Vincula la demanda agrícola con la capacidad nominal de molienda del tándem de molinos.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Ritmo Diario de Molienda",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 6. Horas Máquina en Preparación de Suelo
  {
    formulaId: "PREP_SUELO_HORAS_V1",
    name: "Horas Máquina Requeridas en Preparación de Suelo",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "PREPARACION_SUELO",
    expression: "MachineHours = TargetAreaHa / EffectiveCapacityHaPerHour",
    variables: [
      { name: "Área Objetivo de Preparación", symbol: "TargetAreaHa", unit: "ha", description: "Superficie de reforma o expansión a preparar", moduleCategory: "PREPARACION_SUELO" },
      { name: "Capacidad Efectiva de Trabajo", symbol: "EffectiveCapacityHaPerHour", unit: "ha/h", description: "Rendimiento neto de campo del conjunto tractor e implemento", moduleCategory: "MAQUINARIA" },
    ],
    units: "h",
    description: "Horas netas de trabajo requeridas por implemento en labores de preparación.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Rendimiento Operativo de Laboreo",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 7. Consumo de Combustible Diésel en Operaciones
  {
    formulaId: "PREP_SUELO_DIESEL_V1",
    name: "Consumo de Diésel por Labor Agrícola",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "PREPARACION_SUELO",
    expression: "DieselLiters = MachineHours * FuelConsumptionLitersPerHour",
    variables: [
      { name: "Horas Máquina Efectivas", symbol: "MachineHours", unit: "h", description: "Horas netas de trabajo del motor", moduleCategory: "MAQUINARIA" },
      { name: "Consumo Específico Horario", symbol: "FuelConsumptionLitersPerHour", unit: "L/h", description: "Consumo específico según potencia HP del tractor", moduleCategory: "MAQUINARIA" },
    ],
    units: "L",
    description: "Volumen de combustible requerido por labor mecanizada.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Consumo Específico Horario",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 8. Requerimiento de Semilla de Caña
  {
    formulaId: "SEMILLA_REQUERIDA_V1",
    name: "Demanda de Caña Semilla para Plantación",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "PLANTIO",
    expression: "SeedTons = PlantingAreaHa * SeedRateTonsPerHa",
    variables: [
      { name: "Área de Siembra", symbol: "PlantingAreaHa", unit: "ha", description: "Superficie de renovación planificada", moduleCategory: "PLANTIO" },
      { name: "Densidad de Semilla", symbol: "SeedRateTonsPerHa", unit: "t/ha", description: "Dosificación estándar de trozos de caña en surco (12 a 15 t/ha)", moduleCategory: "PLANTIO" },
    ],
    units: "t",
    description: "Determina las toneladas de semilla requeridas y el semillero a reservar.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Tasa de Inoculación de Semilla",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 9. Dimensionamiento de Flota de Maquinaria
  {
    formulaId: "FLOTA_REQUERIDA_V1",
    name: "Dimensionamiento de Flota Requerida de Maquinaria",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "MAQUINARIA",
    expression: "RequiredUnits = Ceil( WorkloadHours / (CalendarDays * DailyOperatingHours * AvailabilityRatio) )",
    variables: [
      { name: "Demanda Total de Horas", symbol: "WorkloadHours", unit: "h", description: "Horas máquina totales de la categoría de labor", moduleCategory: "MAQUINARIA" },
      { name: "Ventana Calendario", symbol: "CalendarDays", unit: "días", description: "Días disponibles antes del inicio de zafra", moduleCategory: "PLANIFICACION" },
      { name: "Jornada Diaria Operativa", symbol: "DailyOperatingHours", unit: "h/día", description: "Turnos de operación activos (16 a 20 h/día)", moduleCategory: "MAQUINARIA" },
      { name: "Disponibilidad Mecánica", symbol: "AvailabilityRatio", unit: "ratio", description: "Ratio de tiempo operativo sin averías (ej. 0.85)", moduleCategory: "MAQUINARIA" },
    ],
    units: "unidades",
    description: "Dimensionamiento de parque de tractores mediante función techo para evitar subdimensionamiento.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Capacidad de Tracción y Laboreo",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 10. Déficit de Flota y Necesidad de Compra (CAPEX)
  {
    formulaId: "DEFICIT_FLOTA_V1",
    name: "Déficit de Flota y Necesidad de Adquisición (CAPEX)",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "MAQUINARIA",
    expression: "DeficitUnits = Max( 0, RequiredUnits - AvailableUnits )",
    variables: [
      { name: "Unidades Requeridas", symbol: "RequiredUnits", unit: "unidades", description: "Flota teórica necesaria calculada", moduleCategory: "MAQUINARIA" },
      { name: "Unidades Disponibles Propias", symbol: "AvailableUnits", unit: "unidades", description: "Parque de maquinaria operativo existente", moduleCategory: "MAQUINARIA" },
    ],
    units: "unidades",
    description: "Déficit neto de maquinaria que gatilla requerimientos de compra o alquiler.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Balance de Parque de Maquinaria",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 11. Tiempo de Tránsito de Transporte CCT
  {
    formulaId: "TIEMPO_TRANSITO_CCT_V1",
    name: "Tiempo de Tránsito Ida y Vuelta en Transporte de Caña",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "COSECHA_CCT",
    expression: "TransitTime = (DistanceKm / SpeedEmptyKmH) + (DistanceKm / SpeedLoadedKmH)",
    variables: [
      { name: "Distancia Unidireccional Campo-Fábrica", symbol: "DistanceKm", unit: "km", description: "Distancia media desde el frente de corte a la báscula", moduleCategory: "COSECHA_CCT" },
      { name: "Velocidad en Vacío", symbol: "SpeedEmptyKmH", unit: "km/h", description: "Velocidad de retorno camión vacío (típicamente 45 km/h)", moduleCategory: "COSECHA_CCT" },
      { name: "Velocidad Cargado", symbol: "SpeedLoadedKmH", unit: "km/h", description: "Velocidad con carga rodoviaria (típicamente 32 km/h)", moduleCategory: "COSECHA_CCT" },
    ],
    units: "h",
    description: "Tiempo dinámico rodoviario de viaje redondo de camión bi-tren.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Cinemática de Transporte Cañero",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 12. Ciclo Total de Transporte CCT y Camiones Requeridos
  {
    formulaId: "FLOTA_CAMIONES_V1",
    name: "Flota Requerida de Camiones Cañeros (CCT)",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "COSECHA_CCT",
    expression: "TrucksRequired = Ceil( DailyHarvestDemandTons / ((24 * DailyUtilization / TotalCycleTimeHours) * PayloadTonsPerTruck) )",
    variables: [
      { name: "Demanda Diaria de Caña", symbol: "DailyHarvestDemandTons", unit: "t/día", description: "Caudal de suministro diario a fábrica", moduleCategory: "COSECHA_CCT" },
      { name: "Tiempo Total de Ciclo", symbol: "TotalCycleTimeHours", unit: "h", description: "Tránsito + Carga en campo + Descarga báscula + Colas", moduleCategory: "COSECHA_CCT" },
      { name: "Factor de Utilización Diaria", symbol: "DailyUtilization", unit: "ratio", description: "Disponibilidad efectiva 24h (típicamente 0.80 = 19.2 h)", moduleCategory: "COSECHA_CCT" },
      { name: "Capacidad de Carga Útil", symbol: "PayloadTonsPerTruck", unit: "t/viaje", description: "Carga neta por viaje de camión (ej. 45 t bi-tren)", moduleCategory: "COSECHA_CCT" },
    ],
    units: "camiones",
    description: "Dimensión óptima de camiones cañeros para abastecer continuamente el patio de molienda.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Dimensionamiento de Flota CCT",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 13. Consolidación de Costes OPEX
  {
    formulaId: "OPEX_TOTAL_V1",
    name: "Consolidación de Costes Operativos Agrícolas (OPEX)",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "ECONOMIA_OPEX",
    expression: "TotalOpex = FuelDiesel + Fertilizers + Agrochemicals + FleetMaintenance + Labor + OtherOps",
    variables: [
      { name: "Combustible Diésel", symbol: "FuelDiesel", unit: "USD", description: "Gasto total en combustible", moduleCategory: "ECONOMIA_OPEX" },
      { name: "Fertilizantes y Enmiendas", symbol: "Fertilizers", unit: "USD", description: "NPK, cal agrícola y fertilización de cobertura", moduleCategory: "ECONOMIA_OPEX" },
      { name: "Agroquímicos y Defensivos", symbol: "Agrochemicals", unit: "USD", description: "Herbicidas pre y post-emergentes", moduleCategory: "ECONOMIA_OPEX" },
      { name: "Mantenimiento de Flota", symbol: "FleetMaintenance", unit: "USD", description: "Repuestos, lubricantes y desgaste de implementos", moduleCategory: "ECONOMIA_OPEX" },
      { name: "Mano de Obra Operativa", symbol: "Labor", unit: "USD", description: "Operadores de tractor, cosechadora y choferes", moduleCategory: "ECONOMIA_OPEX" },
      { name: "Otros Gastos Operacionales", symbol: "OtherOps", unit: "USD", description: "Mantenimiento de caminos y logística interna", moduleCategory: "ECONOMIA_OPEX" },
    ],
    units: "USD",
    description: "Matriz económica consolidada del costo operacional de la zafra agrícola.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Matriz de Costos OPEX Agrícola",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 14. Costo Unitario por Tonelada de Caña Entregada
  {
    formulaId: "OPEX_POR_TONELADA_V1",
    name: "Costo Unitario por Tonelada de Caña Puesta en Fábrica",
    version: "1.0.0",
    status: "PDA_VALIDATED",
    modelOrigin: "PDA_2014",
    moduleCategory: "ECONOMIA_OPEX",
    expression: "CostPerTon = TotalOpex / TotalCaneTonsDelivered",
    variables: [
      { name: "OPEX Total Consolidado", symbol: "TotalOpex", unit: "USD", description: "Costo operacional agrícola total de campaña", moduleCategory: "ECONOMIA_OPEX" },
      { name: "Toneladas de Caña Entregadas", symbol: "TotalCaneTonsDelivered", unit: "t", description: "Toneladas netas recibidas en mesa de alimentación", moduleCategory: "RENDIMIENTO_TCH" },
    ],
    units: "USD/t",
    description: "Indicador cardinal de competitividad industrial de la caña de azúcar.",
    provenanceDoc: "Modelo Canónico PDA Rev. 2014",
    historicReference: "Costo Agroindustrial Unitario",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
  },

  // 15. Fórmula Histórica Inválida (#REF!) - Documentada y Aislada
  {
    formulaId: "FORMULA_DAMAGED_HISTORIC_REF",
    name: "Ajuste Histórico por Inflación Diésel (Referencia Rota Documentada)",
    version: "1.0.0",
    status: "INVALID_SOURCE",
    modelOrigin: "PDA_2014",
    moduleCategory: "AUDITORIA",
    expression: "=#REF! * DIESEL_BENCHMARK_2014",
    variables: [
      { name: "Referencia Rota en Fuente Histórica", symbol: "#REF!", unit: "desconocida", description: "Celda de origen eliminada o inaccesible en el archivo histórico", moduleCategory: "AUDITORIA" },
      { name: "Benchmark Diésel 2014", symbol: "DIESEL_BENCHMARK_2014", unit: "USD/L", description: "Precio histórico de referencia", moduleCategory: "ECONOMIA_OPEX" },
    ],
    units: "INVALID",
    description: "Fórmula histórica dañada (#REF!) aislada y catalogada estrictamente como INVALID_SOURCE para evitar cualquier ejecución en el sistema.",
    provenanceDoc: "Documento Histórico PDA 2014 (Fórmula Dañada #REF!)",
    historicReference: "Referencia documental dañada",
    effectiveFrom: "2014-09-30T00:00:00.000Z",
    isEditable: false,
    notes: "Aislada por gobernanza y deshabilitada. Nunca se ejecuta.",
  },

  // 16. Modelo Predictivo BioAzúcar 4.0: Calibración Espectral Satelital NDVI
  {
    formulaId: "BIOAZUCAR_NDVI_TCH_V1",
    name: "BioAzúcar 4.0 — Calibración Espectral Satelital de Biomasa (NDVI)",
    version: "1.2.0",
    status: "BIOAZUCAR_MODEL",
    modelOrigin: "BIOAZUCAR_4_0",
    moduleCategory: "INTELIGENCIA_BIOAZUCAR",
    expression: "TCH_Satelital = TCH_PDA * (0.80 + 0.40 * (NDVI_Sentinel2 - 0.20) / (0.85 - 0.20))",
    variables: [
      { name: "TCH Canónico Base", symbol: "TCH_PDA", unit: "t/ha", description: "Rendimiento proyectado según modelo agronómico base", moduleCategory: "RENDIMIENTO_TCH" },
      { name: "Índice NDVI Satelital", symbol: "NDVI_Sentinel2", unit: "índice (0-1)", description: "Índice de vegetación de diferencia normalizada (Sentinel-2 / Copernicus)", moduleCategory: "TELEMETRIA" },
    ],
    units: "t/ha",
    description: "Ajusta la estimación de biomasa mediante reflectancia espectral satelital continua durante el ciclo vegetativo.",
    provenanceDoc: "BioAzúcar 4.0 — Módulo de Inteligencia Satelital & Visión Multiespectral",
    historicReference: "Algoritmo Espectral Propietario",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    isEditable: true,
  },

  // 17. Modelo Predictivo BioAzúcar 4.0: Despacho Dinámico CCT
  {
    formulaId: "BIOAZUCAR_DYNAMIC_DISPATCH_V1",
    name: "BioAzúcar 4.0 — Despacho Dinámico Predictivo CCT con Cola de Báscula",
    version: "1.1.0",
    status: "BIOAZUCAR_MODEL",
    modelOrigin: "BIOAZUCAR_4_0",
    moduleCategory: "INTELIGENCIA_BIOAZUCAR",
    expression: "Trucks_Opt = Trucks_Base * (1 + 0.15 * Exp(CurrentWeighbridgeQueue / 5.0) - 0.10 * RoadQualityIndex)",
    variables: [
      { name: "Camiones Base PDA", symbol: "Trucks_Base", unit: "camiones", description: "Dimensionamiento estático según fórmula canónica PDA", moduleCategory: "COSECHA_CCT" },
      { name: "Camiones en Espera en Báscula", symbol: "CurrentWeighbridgeQueue", unit: "camiones", description: "Monitoreo en tiempo real desde telemetría SCADA / UNS", moduleCategory: "TELEMETRIA" },
      { name: "Índice de Estado de Camino", symbol: "RoadQualityIndex", unit: "ratio (0-1)", description: "Condición meteorológica y estado de terraplén", moduleCategory: "LOGISTICA" },
    ],
    units: "camiones",
    description: "Optimización heurística en tiempo real para evitar congestión en el patio de recepción de caña.",
    provenanceDoc: "BioAzúcar 4.0 — Motor de Despacho Autónomo Industrial",
    historicReference: "Algoritmo UNS v1.1",
    effectiveFrom: "2026-03-01T00:00:00.000Z",
    isEditable: true,
  },
];

// Aliases mapping old IDs to new internal IDs
const FORMULA_ALIASES: Record<string, string> = {
  FORMULA_TCH_PLOT: "TCH_PROYECTADO_V1",
  FORMULA_PLOT_TONS: "PRODUCCION_LOTE_V1",
  FORMULA_AREA_BALANCE: "AREA_FINAL_V1",
  FORMULA_CAMPAIGN_AVG_TCH: "TCH_MEDIO_CAMPANA_V1",
  FORMULA_DAILY_HARVEST_DEMAND: "DEMANDA_DIARIA_V1",
  FORMULA_SOIL_PREP_HOURS: "PREP_SUELO_HORAS_V1",
  FORMULA_SOIL_PREP_DIESEL: "PREP_SUELO_DIESEL_V1",
  FORMULA_PLANTING_SEED: "SEMILLA_REQUERIDA_V1",
  FORMULA_SEED_CANE_REQUIRED: "SEMILLA_REQUERIDA_V1",
  FORMULA_FLEET_REQUIRED: "FLOTA_REQUERIDA_V1",
  FORMULA_FLEET_DEFICIT: "DEFICIT_FLOTA_V1",
  FORMULA_CCT_TRANSIT: "TIEMPO_TRANSITO_CCT_V1",
  FORMULA_CCT_TRUCKS: "FLOTA_CAMIONES_V1",
  FORMULA_OPEX_CONSOLIDATION: "OPEX_TOTAL_V1",
  FORMULA_COST_PER_TON: "OPEX_POR_TONELADA_V1",
  FORMULA_OPEX_PER_TON: "OPEX_POR_TONELADA_V1",
  FORMULA_BIOAZUCAR_NDVI_TCH: "BIOAZUCAR_NDVI_TCH_V1",
  FORMULA_BIOAZUCAR_DYNAMIC_DISPATCH: "BIOAZUCAR_DYNAMIC_DISPATCH_V1",
};

/**
 * PdaFormulaRegistry: Governance store and versioning service
 */
export class PdaFormulaRegistry {
  private static formulasMap: Map<string, PdaFormulaMaster> = new Map();

  static {
    this.resetToCanonical();
  }

  public static getAllFormulas(): PdaFormulaMaster[] {
    const unique = new Map<string, PdaFormulaMaster>();
    for (const f of this.formulasMap.values()) {
      if (!unique.has(f.formulaId)) {
        unique.set(f.formulaId, f);
      }
    }
    return Array.from(unique.values());
  }

  public static getFormula(formulaId: string): PdaFormulaMaster | undefined {
    const direct = this.formulasMap.get(formulaId);
    if (direct) return direct;
    const aliasTarget = FORMULA_ALIASES[formulaId];
    if (aliasTarget) {
      return this.formulasMap.get(aliasTarget);
    }
    // Search by name or substring if necessary
    for (const f of this.formulasMap.values()) {
      if (f.formulaId === formulaId || f.formulaId === aliasTarget) {
        return f;
      }
    }
    return undefined;
  }

  public static getFormulasByOrigin(origin: PdaModelOrigin): PdaFormulaMaster[] {
    return Array.from(this.formulasMap.values()).filter((f) => f.modelOrigin === origin);
  }

  public static getFormulasByStatus(status: PdaFormulaStatus): PdaFormulaMaster[] {
    return Array.from(this.formulasMap.values()).filter((f) => f.status === status);
  }

  /**
   * Updates or versions a formula.
   * Can create audited new versions.
   */
  public static updateFormula(params: {
    formulaId: string;
    newExpression?: string;
    changedBy: string;
    reason: string;
  }): { success: boolean; updatedFormula?: PdaFormulaMaster; error?: string } {
    const targetId = FORMULA_ALIASES[params.formulaId] || params.formulaId;
    const existing = this.formulasMap.get(targetId);
    if (!existing) {
      return { success: false, error: `Fórmula no encontrada: ${params.formulaId}` };
    }

    if (existing.status === "PDA_VALIDATED" && !params.newExpression) {
      return {
        success: false,
        error: "Las fórmulas canónicas PDA_VALIDATED están protegidas contra modificaciones arbitrarias.",
      };
    }

    // Increment minor version
    const parts = existing.version.split(".").map(Number);
    const newVersion = `${parts[0] || 1}.${(parts[1] || 0) + 1}.0`;

    const auditEntry = {
      version: existing.version,
      changedAt: new Date().toISOString(),
      changedBy: params.changedBy,
      reason: params.reason,
      previousExpression: existing.expression,
    };

    const updated: PdaFormulaMaster = {
      ...existing,
      version: newVersion,
      expression: params.newExpression || existing.expression,
      auditHistory: [...(existing.auditHistory || []), auditEntry],
      notes: `${existing.notes || ""} [Modificado v${newVersion} por ${params.changedBy}: ${params.reason}]`,
    };

    this.formulasMap.set(targetId, updated);
    return { success: true, updatedFormula: updated };
  }

  /**
   * Resets all formulas to canonical baseline
   */
  public static resetToCanonical(): void {
    this.formulasMap.clear();
    for (const f of CANONICAL_PDA_FORMULAS) {
      this.formulasMap.set(f.formulaId, {
        ...f,
        auditHistory: [...(f.auditHistory || [])],
        variables: f.variables.map((v) => ({ ...v })),
      });
    }
  }

  /**
   * Generates a fully qualified CalculationTrace from an internal formula record.
   * Completely decoupled from external files.
   */
  public static createCalculationTrace(params: {
    formulaId: string;
    inputs: Record<string, { value: number | string | boolean; unit: string; description?: string; parameterKey?: string }>;
    result: { value: number | string; unit: string };
    modelType?: AgroModelType;
    scenario?: string;
    user?: string;
    campaignId?: string;
  }): CalculationTrace {
    const formula = this.getFormula(params.formulaId);
    const resolvedModelType: AgroModelType =
      params.modelType ||
      (formula?.status === "BIOAZUCAR_MODEL"
        ? "BIOAZUCAR_MODEL"
        : formula?.status === "CONFIGURABLE"
        ? "WHAT_IF_SCENARIO"
        : "PDA_VALIDATED");

    return {
      formulaId: formula?.formulaId || params.formulaId,
      formulaName: formula?.name || params.formulaId,
      formulaExpression: formula?.expression || "Cálculo interno determinístico",
      modelType: resolvedModelType,
      modelVersion: formula?.version || "1.0.0",
      campaignId: params.campaignId || "ZAFRA-2026-2027",
      scenario: params.scenario || "Línea Base Canónica",
      user: params.user || "agronomo_bioazucar",
      calculatedAt: new Date().toISOString(),
      inputs: params.inputs,
      result: params.result,
      provenance: {
        documentSource: formula?.provenanceDoc || "Modelo Interno BioAzúcar 4.0",
        historicReference: formula?.historicReference || "Regla Agronómica Interna",
      },
      // Backward compatibility fields
      formula: formula ? `${formula.name}: ${formula.expression}` : params.formulaId,
      sourceSheet: formula?.moduleCategory || "Módulo Agronómico BioAzúcar",
      modelRevision: `BIOAZUCAR-AGRO-MODEL-V${formula?.version || "1.0"}`,
    };
  }
}
