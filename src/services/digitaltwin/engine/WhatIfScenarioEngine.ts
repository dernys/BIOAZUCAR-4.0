/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — PRESCRIPTIVE WHAT-IF SCENARIO ENGINE
 * Baseline vs Scenario Comparison, Delta Analysis & Potential Alarm Forecasting
 * ============================================================================
 */

import {
  ScenarioDefinition,
  ScenarioRunResult,
  ScenarioComparisonMetric,
  EquipmentOperationalState,
  ProcessFlowConnection,
} from "../domain/DigitalTwinTypes";
import { twinProcessSimulator, SimulationInputParameters } from "./TwinProcessSimulator";
import { CANONICAL_TWIN_FLOWS } from "../domain/TwinAssetCatalog";

export class WhatIfScenarioEngine {
  private static instance: WhatIfScenarioEngine | null = null;

  public static readonly CANONICAL_PRESETS: ScenarioDefinition[] = [
    {
      id: "scen-high-throughput",
      name: "Incrementar Molienda +15% (520 TCH)",
      description: "Evalúa el comportamiento del tándem, saturación de calderas y capacidad de evacuación de vapor al elevar la molienda a 520 TCH.",
      presetCategory: "HIGH_THROUGHPUT",
      overrides: [
        { parameterKey: "TCH", baselineValue: 452.4, targetValue: 520.0, unit: "TCH" },
      ],
      createdAt: "2026-03-01T00:00:00Z",
      createdBy: "Ingeniería de Procesos",
    },
    {
      id: "scen-wet-bagasse",
      name: "Deterioro Humedad Bagazo (52.5% Humedad)",
      description: "Simula el impacto de lluvia en batey y desgaste de rayado de molinos sobre el poder calorífico (PCI) del bagazo y generación de vapor.",
      presetCategory: "DEGRADED_FEED",
      overrides: [
        { parameterKey: "BAGASSE_MOISTURE", baselineValue: 48.8, targetValue: 52.5, unit: "%" },
      ],
      createdAt: "2026-03-01T00:00:00Z",
      createdBy: "Operaciones Central",
    },
    {
      id: "scen-max-cogen",
      name: "Máxima Exportación PPA SEN (26.5 MW)",
      description: "Maximiza el despacho eléctrico elevando la presión de caldera a 66 bar y optimizando la tasa de imbibición a 240% sobre fibra.",
      presetCategory: "MAX_COGEN",
      overrides: [
        { parameterKey: "BOILER_PRESSURE", baselineValue: 64.6, targetValue: 66.0, unit: "bar" },
        { parameterKey: "IMBIBITION_RATIO", baselineValue: 250.0, targetValue: 240.0, unit: "%" },
        { parameterKey: "GRID_EXPORT_MW", baselineValue: 21.2, targetValue: 26.5, unit: "MW" },
      ],
      createdAt: "2026-03-01T00:00:00Z",
      createdBy: "Despacho Energético",
    },
    {
      id: "scen-steam-saver",
      name: "Optimización Térmica & Ahorro de Vapor Fábrica",
      description: "Reduce el consumo específico de vapor en evaporadores y tachos mediante sangrado de vapor vegetal a calentadores.",
      presetCategory: "ENERGY_EFFICIENCY",
      overrides: [
        { parameterKey: "TCH", baselineValue: 452.4, targetValue: 440.0, unit: "TCH" },
        { parameterKey: "BAGASSE_MOISTURE", baselineValue: 48.8, targetValue: 47.2, unit: "%" },
      ],
      createdAt: "2026-03-01T00:00:00Z",
      createdBy: "Eficiencia Energética",
    },
  ];

  public static getInstance(): WhatIfScenarioEngine {
    if (!WhatIfScenarioEngine.instance) {
      WhatIfScenarioEngine.instance = new WhatIfScenarioEngine();
    }
    return WhatIfScenarioEngine.instance;
  }

  /**
   * Executes a What-If scenario against baseline conditions and outputs full comparative impact
   */
  public runScenario(
    scenario: ScenarioDefinition,
    currentBaselineInputs: Partial<SimulationInputParameters> = {}
  ): ScenarioRunResult {
    // 1. Solve Baseline
    const baselineOut = twinProcessSimulator.solve(currentBaselineInputs);

    // 2. Prepare Scenario Overrides
    const scenarioInputs: Partial<SimulationInputParameters> = { ...currentBaselineInputs };
    for (const ov of scenario.overrides) {
      if (ov.parameterKey === "TCH") scenarioInputs.tch = ov.targetValue;
      if (ov.parameterKey === "BAGASSE_MOISTURE") scenarioInputs.bagasseMoisturePercent = ov.targetValue;
      if (ov.parameterKey === "BOILER_PRESSURE") scenarioInputs.boilerOperatingPressureBar = ov.targetValue;
      if (ov.parameterKey === "IMBIBITION_RATIO") scenarioInputs.imbibitionWaterRatio = ov.targetValue;
      if (ov.parameterKey === "GRID_EXPORT_MW") scenarioInputs.gridExportDemandMW = ov.targetValue;
      if (ov.parameterKey === "CANE_POL") scenarioInputs.canePolPercent = ov.targetValue;
    }

    // 3. Solve Scenario
    const scenarioOut = twinProcessSimulator.solve(scenarioInputs);

    // 4. Compute Comparison Metrics
    const comparisonMetrics: ScenarioComparisonMetric[] = [
      this.createMetric(
        "kpi-tch",
        "Molienda Horaria",
        "TCH",
        currentBaselineInputs.tch || 452.4,
        scenarioInputs.tch || 452.4,
        "Capacidad de procesamiento de caña en tándem."
      ),
      this.createMetric(
        "kpi-extraction",
        "Extracción Sacarosa",
        "%",
        baselineOut.millingExtractionPercent,
        scenarioOut.millingExtractionPercent,
        "Eficiencia de extracción de jugo en molinos."
      ),
      this.createMetric(
        "kpi-steam-flow",
        "Generación Vapor HP",
        "t/h",
        baselineOut.steamFlowHpTonsH,
        scenarioOut.steamFlowHpTonsH,
        "Producción de vapor sobrecalentado a 65 bar."
      ),
      this.createMetric(
        "kpi-power-export",
        "Potencia Exportada SEN",
        "MW",
        baselineOut.powerExportNetMw,
        scenarioOut.powerExportNetMw,
        "Excedente de energía inyectada a la red eléctrica nacional."
      ),
      this.createMetric(
        "kpi-bagasse-surplus",
        "Excedente Bagazo Acopio",
        "t/h",
        baselineOut.bagasseSurplusStorageTonsH,
        scenarioOut.bagasseSurplusStorageTonsH,
        "Bagazo enviado a patio para paradas o venta de fibra."
      ),
      this.createMetric(
        "kpi-sugar-today",
        "Producción Azúcar 24h",
        "t/día",
        baselineOut.sugarProductionTonsToday,
        scenarioOut.sugarProductionTonsToday,
        "Toneladas métricas de azúcar comercial producidas."
      ),
      this.createMetric(
        "kpi-steam-per-cane",
        "Consumo Vapor / t Caña",
        "kg/t",
        baselineOut.steamPerTonCaneKgT,
        scenarioOut.steamPerTonCaneKgT,
        "Indicador clave de eficiencia térmica del central."
      ),
    ];

    // 5. Evaluate Potential Operational Alarms
    const potentialAlarms: Array<{
      equipmentId: string;
      tag: string;
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      cause: string;
    }> = [];

    if (scenarioOut.steamFlowHpTonsH > 240) {
      potentialAlarms.push({
        equipmentId: "eq-caldera-1",
        tag: "Boiler1.Steam_Flow_HP",
        severity: "HIGH",
        cause: `Flujo de vapor (${scenarioOut.steamFlowHpTonsH} t/h) supera el 98% de la capacidad de diseño de la caldera 1.`,
      });
    }

    if (scenarioOut.bagasseLhvKcalKg < 1720) {
      potentialAlarms.push({
        equipmentId: "eq-caldera-1",
        tag: "Boiler1.Fuel_LHV",
        severity: "CRITICAL",
        cause: `Poder calorífico inferior muy bajo (${scenarioOut.bagasseLhvKcalKg} kcal/kg) por exceso de humedad; riesgo de inestabilidad de llama.`,
      });
    }

    if (scenarioOut.powerExportNetMw < 12.0) {
      potentialAlarms.push({
        equipmentId: "eq-subestacion",
        tag: "Grid.ExportPower_MW",
        severity: "MEDIUM",
        cause: `Despacho a red (${scenarioOut.powerExportNetMw} MW) por debajo del compromiso PPA contractual (15 MW).`,
      });
    }

    // 6. Project Equipment States
    const simulatedEquipmentStates: Record<string, EquipmentOperationalState> = {
      "eq-patio-cana": (scenarioInputs.tch || 452.4) > 540 ? "WARNING" : "RUNNING",
      "eq-preparacion": (scenarioInputs.tch || 452.4) > 520 ? "WARNING" : "RUNNING",
      "eq-molino-1": "RUNNING",
      "eq-molino-3": "RUNNING",
      "eq-molino-6": scenarioOut.millingExtractionPercent < 95.0 ? "WARNING" : "RUNNING",
      "eq-caldera-1": scenarioOut.steamFlowHpTonsH > 240 ? "WARNING" : "RUNNING",
      "eq-turbina-1": scenarioOut.powerGeneratedGrossMw > 34.0 ? "WARNING" : "RUNNING",
      "eq-subestacion": "RUNNING",
      "eq-clarificador": "RUNNING",
      "eq-evaporadores": "RUNNING",
      "eq-tachos-cristalizacion": "RUNNING",
      "eq-secador-ensacado": "RUNNING",
    };

    // 7. Update Flow Rates for Simulation View
    const simulatedFlows: ProcessFlowConnection[] = CANONICAL_TWIN_FLOWS.map((f) => {
      let rate = f.currentRate;
      if (f.id === "flow-mat-cane-prep") rate = scenarioInputs.tch || 452.4;
      if (f.id === "flow-mat-m6-boiler") rate = scenarioOut.bagasseBoilerConsumptionTonsH;
      if (f.id === "flow-energy-boiler-turbine") rate = scenarioOut.steamFlowHpTonsH;
      if (f.id === "flow-energy-turbine-substation") rate = scenarioOut.powerExportNetMw;
      return { ...f, currentRate: rate };
    });

    const netMwDelta = +(scenarioOut.powerExportNetMw - baselineOut.powerExportNetMw).toFixed(2);
    const sugarDelta = +(scenarioOut.sugarProductionTonsToday - baselineOut.sugarProductionTonsToday).toFixed(1);

    const operationalSummary = `Escenario '${scenario.name}': Impacto neto en generación de ${
      netMwDelta >= 0 ? `+${netMwDelta}` : netMwDelta
    } MW exportados y ${sugarDelta >= 0 ? `+${sugarDelta}` : sugarDelta} t/día de azúcar. ${
      potentialAlarms.length > 0 ? `Se pronostican ${potentialAlarms.length} alarmas potenciales de proceso.` : "Operación dentro de la envolvente segura de planta."
    }`;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      executedAt: new Date().toISOString(),
      comparisonMetrics,
      simulatedEquipmentStates,
      simulatedFlows,
      potentialAlarms,
      operationalSummary,
    };
  }

  private createMetric(
    kpiId: string,
    name: string,
    unit: string,
    baseline: number,
    scenario: number,
    operationalNotes: string
  ): ScenarioComparisonMetric {
    const deltaAbsolute = +(scenario - baseline).toFixed(2);
    const deltaPercent = baseline !== 0 ? +((deltaAbsolute / baseline) * 100).toFixed(2) : 0;
    const impactCategory =
      deltaPercent > 0.5 ? "FAVORABLE" : deltaPercent < -0.5 ? "UNFAVORABLE" : "NEUTRAL";

    return {
      kpiId,
      name,
      unit,
      baseline,
      scenario,
      deltaAbsolute,
      deltaPercent,
      impactCategory,
      operationalNotes,
    };
  }
}

export const whatIfScenarioEngine = WhatIfScenarioEngine.getInstance();
