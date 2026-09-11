/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Engine
 * YieldCalculationService: Autonomous deterministic biological yield, ratoon decay & campaign simulation engine.
 * 
 * 100% Autonomous from spreadsheet runtime dependencies.
 * Supports:
 * - PDA_VALIDATED (Empirical Varietal Decay Model)
 * - BIOAZUCAR_MODEL (Pedological Soil Modifiers + Bioclimatic Factor)
 * - WHAT_IF_SCENARIO (Sensitivity and multi-scenario simulations)
 */

import {
  CaneGrowthStage,
  CaneVarietyYieldMaster,
  FieldPlot,
  CalculationTrace,
  SoilType,
  YieldScenarioParams,
  YieldCalculationResult,
  AgroModelType,
} from "../../types/agriculture";
import { AgriculturalParameterRegistry } from "./AgriculturalParameterRegistry";

export const MODEL_REVISION = "BIOAZUCAR-AGRO-MODEL-V1.0";

/**
 * Baseline soil productivity modifiers based on physical-hydraulic characteristics.
 * Franco: Reference balance (1.00)
 * Arcilloso: Heavy clay, high water retention, root impedance (0.98)
 * Arenoso: Sandy, high percolation, low cation exchange (0.92)
 */
export const SOIL_IMPACT_FACTORS: Record<SoilType, number> = {
  FRANCO: 1.00,
  ARCILLOSO: 0.98,
  ARENOSO: 0.92,
};

/**
 * Standard reference commercial varieties master data catalog.
 * Dynamically configurable through AgriculturalParameterRegistry.
 */
export const COMMERCIAL_VARIETIES_CATALOG: CaneVarietyYieldMaster[] = [
  {
    varietyCode: "RB86-7515",
    name: "República Biocombustíveis 86-7515",
    cycleLengthMonths: 15,
    baseYieldTch: 105.0,
    polPercent: 14.5,
    fiberPercent: 13.2,
    purityPercent: 86.5,
    maturity: "MEDIA",
    ratoonDecayFactors: {
      PLANTA: 1.00,
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
  {
    varietyCode: "SP80-3280",
    name: "São Paulo 80-3280",
    cycleLengthMonths: 12,
    baseYieldTch: 100.0,
    polPercent: 15.1,
    fiberPercent: 12.8,
    purityPercent: 88.0,
    maturity: "TEMPRANA",
    ratoonDecayFactors: {
      PLANTA: 1.00,
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
  {
    varietyCode: "CTC-4",
    name: "Centro de Tecnología Canavieira 4",
    cycleLengthMonths: 18,
    baseYieldTch: 112.0,
    polPercent: 14.2,
    fiberPercent: 13.8,
    purityPercent: 85.8,
    maturity: "TARDIA",
    ratoonDecayFactors: {
      PLANTA: 1.00,
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
];

export class YieldCalculationService {
  /**
   * Retrieves a cane variety by code or throws an explicit error.
   * Dynamically resolved from AgriculturalParameterRegistry.
   */
  public static getVariety(code: string): CaneVarietyYieldMaster {
    const dynamicCatalog = AgriculturalParameterRegistry.getVarietyCatalog();
    const catalog =
      Object.values(dynamicCatalog).length > 0
        ? Object.values(dynamicCatalog)
        : COMMERCIAL_VARIETIES_CATALOG;
    const variety = catalog.find(
      (v) => v.varietyCode.toUpperCase() === code.toUpperCase()
    );
    if (!variety) {
      throw new Error(`[YieldCalculationService] Variedad no encontrada en catálogo: "${code}"`);
    }
    return variety;
  }

  /**
   * Returns the entire dynamic catalog of commercial cane varieties.
   */
  public static getCatalog(): CaneVarietyYieldMaster[] {
    const dynamicCatalog = AgriculturalParameterRegistry.getVarietyCatalog();
    const values = Object.values(dynamicCatalog);
    return values.length > 0 ? values : [...COMMERCIAL_VARIETIES_CATALOG];
  }

  /**
   * Validates physical dimensional consistency:
   * areaHa > 0, tch >= 0, and if tons provided, abs(areaHa * tch - tons) <= 0.5
   */
  public static validateDimensions(areaHa: number, tch: number, tons?: number): boolean {
    if (areaHa <= 0 || Number.isNaN(areaHa)) return false;
    if (tch < 0 || Number.isNaN(tch)) return false;
    if (tons !== undefined) {
      if (tons < 0 || Number.isNaN(tons)) return false;
      const expectedTons = areaHa * tch;
      const diff = Math.abs(expectedTons - tons);
      if (diff > 0.5) return false;
    }
    return true;
  }

  /**
   * Calculates the expected TCH and total production for a single field plot.
   * 
   * Models supported:
   * 1. PDA_VALIDATED: TCH = BaseTch * RatoonDecay(Stage)
   * 2. BIOAZUCAR_MODEL: TCH = BaseTch * RatoonDecay(Stage) * SoilFactor(SoilType) * ClimateFactor
   * 3. WHAT_IF_SCENARIO: TCH = BaseTch * RatoonDecay(Stage) * SoilFactor(SoilType) * ClimateFactor * (1 + VarPct/100)
   */
  public static calculatePlotYield(
    plotInput: Omit<FieldPlot, "projectedTch" | "projectedTotalCaneTons" | "trace">,
    options: {
      climateFactor?: number;
      tchVariationPercent?: number;
      varietyCatalog?: CaneVarietyYieldMaster[];
      modelType?: AgroModelType;
    } = {}
  ): FieldPlot {
    const modelType: AgroModelType =
      plotInput.agronomicModel || options.modelType || "BIOAZUCAR_MODEL";

    // Dynamically query registry with fallback to catalog
    const dynamicCatalog = AgriculturalParameterRegistry.getVarietyCatalog();
    const catalog =
      options.varietyCatalog || Object.values(dynamicCatalog).length > 0
        ? Object.values(dynamicCatalog)
        : COMMERCIAL_VARIETIES_CATALOG;
    const variety =
      catalog.find((v) => v.varietyCode.toUpperCase() === plotInput.varietyCode.toUpperCase()) ||
      this.getVariety(plotInput.varietyCode);

    const dynamicSoilFactors = AgriculturalParameterRegistry.getSoilImpactFactors();
    const decayFactor = variety.ratoonDecayFactors[plotInput.currentStage] ?? 0.0;
    
    // In strict PDA_VALIDATED model, soil and climate multipliers are 1.0 (empirical ratoon decay only)
    const isPdaValidated = modelType === "PDA_VALIDATED";
    const soilFactor = isPdaValidated
      ? 1.0
      : (dynamicSoilFactors[plotInput.soilType] ?? SOIL_IMPACT_FACTORS[plotInput.soilType] ?? 1.0);
    const climateFactor = isPdaValidated ? 1.0 : (options.climateFactor ?? 1.0);
    const variationMultiplier = isPdaValidated
      ? 1.0
      : (1.0 + (options.tchVariationPercent ?? 0.0) / 100.0);

    // If stage is DEMOLICION, projected TCH and production are strictly 0.0
    let projectedTch = 0.0;
    let projectedTotalCaneTons = 0.0;

    if (plotInput.currentStage !== "DEMOLICION") {
      projectedTch = Number(
        (variety.baseYieldTch * decayFactor * soilFactor * climateFactor * variationMultiplier).toFixed(2)
      );
      projectedTotalCaneTons = Number((plotInput.areaHectares * projectedTch).toFixed(2));
    }

    const formulaId = isPdaValidated ? "TCH_PROYECTADO_V1" : "TCH_PROYECTADO_BIOAZUCAR_V1";
    const formulaExpression = isPdaValidated
      ? "TCH = BaseYieldTch * RatoonDecay(Stage)"
      : "TCH = BaseYieldTch * RatoonDecay(Stage) * SoilFactor(SoilType) * ClimateFactor * (1 + TchVarPct/100)";

    const trace: CalculationTrace = {
      formulaId,
      formulaName: isPdaValidated
        ? "Rendimiento Agrícola Proyectado Canónico PDA"
        : "Rendimiento Agrícola Multivariante BioAzúcar 4.0",
      formulaExpression,
      modelType,
      modelVersion: "1.0.0",
      campaignId: "ZAFRA-2026-2027",
      scenario: options.tchVariationPercent ? `Variación TCH ${options.tchVariationPercent}%` : "Línea Base Canónica",
      user: "agronomo_bioazucar",
      calculatedAt: new Date().toISOString(),
      inputs: {
        areaHectares: { value: plotInput.areaHectares, unit: "ha", description: "Área de la parcela" },
        varietyCode: { value: variety.varietyCode, unit: "variedad", description: "Código de cultivar" },
        baseYieldTch: { value: variety.baseYieldTch, unit: "t/ha", description: "TCH base ciclo Planta", parameterKey: `VARIETY_MASTER_${variety.varietyCode.replace(/[^A-Za-z0-9]/g, '_')}` },
        currentStage: { value: plotInput.currentStage, unit: "etapa", description: "Corte / Retoño" },
        decayFactor: { value: decayFactor, unit: "ratio", description: "Factor de decaimiento por corte" },
        soilType: { value: plotInput.soilType, unit: "edafología", description: "Clasificación de suelo" },
        soilFactor: { value: soilFactor, unit: "ratio", description: "Factor edafológico aplicado", parameterKey: `SOIL_FACTOR_${plotInput.soilType}` },
        climateFactor: { value: climateFactor, unit: "ratio", description: "Factor agroclimático" },
        tchVariationPercent: { value: options.tchVariationPercent ?? 0, unit: "%", description: "Variación what-if" },
      },
      result: { value: projectedTch, unit: "t/ha" },
      provenance: {
        documentSource: isPdaValidated
          ? "Modelo Agronómico Canónico PDA 2014"
          : "Modelo Predictivo Multivariante BioAzúcar 4.0",
        historicReference: isPdaValidated
          ? "Curva empírica de decaimiento por corte"
          : "Enriquecimiento edafoclimático BioAzúcar",
      },
      // Backward compatibility fields
      formula: `ProductionTons = AreaHectares * (${formulaExpression})`,
      sourceSheet: "Módulo Agronómico TCH",
      modelRevision: MODEL_REVISION,
    };

    return {
      ...plotInput,
      agronomicModel: modelType,
      projectedTch,
      projectedTotalCaneTons,
      trace,
    };
  }

  /**
   * Evaluates an entire collection of field plots recalculating yields and lineage traces.
   */
  public static calculatePlotYields(
    plots: FieldPlot[],
    options: {
      climateFactor?: number;
      tchVariationPercent?: number;
      varietyCatalog?: CaneVarietyYieldMaster[];
      modelType?: AgroModelType;
    } = {}
  ): FieldPlot[] {
    return plots.map((p) => this.calculatePlotYield(p, options));
  }

  /**
   * Computes the mathematical area balance across seasons:
   * AreaFinal = AreaInicial + Plantacion - Demolicion + Altas - Bajas
   */
  public static computeAreaBalance(params: {
    initialAreaHa: number;
    plantedAreaHa: number;
    demolishedAreaHa: number;
    newArableAdditionsHa?: number;
    lostAreaDeletionsHa?: number;
    campaignId?: string;
  }): {
    initialAreaHa: number;
    plantedAreaHa: number;
    demolishedAreaHa: number;
    finalAreaHa: number;
    netChangeHa: number;
    trace: CalculationTrace;
  } {
    const additions = params.newArableAdditionsHa ?? 0;
    const deletions = params.lostAreaDeletionsHa ?? 0;
    const finalAreaHa = Number(
      (params.initialAreaHa + params.plantedAreaHa - params.demolishedAreaHa + additions - deletions).toFixed(2)
    );
    const netChangeHa = Number((finalAreaHa - params.initialAreaHa).toFixed(2));

    const trace: CalculationTrace = {
      formulaId: "AREA_FINAL_V1",
      formulaName: "Balance Dinámico de Áreas Cañeras",
      formulaExpression: "AreaFinal = AreaInicial + Plantacion - Demolicion + AltasTierras - BajasTierras",
      modelType: "PDA_VALIDATED",
      modelVersion: "1.0.0",
      campaignId: params.campaignId || "ZAFRA-2026-2027",
      scenario: "Balance Catastral",
      user: "planificador_agricola",
      calculatedAt: new Date().toISOString(),
      inputs: {
        initialAreaHa: { value: params.initialAreaHa, unit: "ha", description: "Área al inicio de campaña" },
        plantedAreaHa: { value: params.plantedAreaHa, unit: "ha", description: "Área nueva de plantío" },
        demolishedAreaHa: { value: params.demolishedAreaHa, unit: "ha", description: "Área erradicada para reforma" },
        newArableAdditionsHa: { value: additions, unit: "ha", description: "Tierras nuevas incorporadas" },
        lostAreaDeletionsHa: { value: deletions, unit: "ha", description: "Bajas de patrimonio" },
      },
      result: { value: finalAreaHa, unit: "ha" },
      provenance: {
        documentSource: "Módulo de Balance Catastral BioAzúcar 4.0",
        historicReference: "Conservación de masa superficial",
      },
      formula: "AreaFinal = AreaInicial + Plantacion - Demolicion + Altas - Bajas",
      sourceSheet: "Módulo Catastral de Superficies",
      modelRevision: MODEL_REVISION,
    };

    return {
      initialAreaHa: params.initialAreaHa,
      plantedAreaHa: params.plantedAreaHa,
      demolishedAreaHa: params.demolishedAreaHa,
      finalAreaHa,
      netChangeHa,
      trace,
    };
  }

  /**
   * Physical-dimensional validation for agricultural field plot data.
   */
  public static validateFieldPlotData(plot: FieldPlot): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!plot.code || plot.code.trim().length === 0) {
      errors.push("El código de lote es obligatorio");
    }
    if (plot.areaHectares <= 0 || Number.isNaN(plot.areaHectares)) {
      errors.push(`Área inválida: ${plot.areaHectares} ha (debe ser > 0)`);
    }
    if (plot.projectedTch != null && (plot.projectedTch < 0 || Number.isNaN(plot.projectedTch))) {
      errors.push(`TCH proyectado inválido: ${plot.projectedTch} t/ha`);
    }
    if (plot.distanceToMillKm < 0 || Number.isNaN(plot.distanceToMillKm)) {
      errors.push(`Distancia a fábrica inválida: ${plot.distanceToMillKm} km`);
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Consolidates an array of FieldPlots into an overall Campaign Yield Summary.
   * Computes weighted average TCH, area and tonnage breakdown by cycle stage.
   */
  public static calculateCampaignYieldSummary(plots: FieldPlot[]): YieldCalculationResult {
    let totalAreaHa = 0;
    let totalProductionTons = 0;
    let demolitionAreaHa = 0;

    const areaByStage: Record<CaneGrowthStage, number> = {
      PLANTA: 0,
      SOCA: 0,
      RETONO_Q2: 0,
      RETONO_Q3: 0,
      RETONO_Q4: 0,
      RETONO_Q5: 0,
      RETONO_Q6: 0,
      RETONO_Q7_PLUS: 0,
      DEMOLICION: 0,
    };

    const productionByStageTons: Record<CaneGrowthStage, number> = {
      PLANTA: 0,
      SOCA: 0,
      RETONO_Q2: 0,
      RETONO_Q3: 0,
      RETONO_Q4: 0,
      RETONO_Q5: 0,
      RETONO_Q6: 0,
      RETONO_Q7_PLUS: 0,
      DEMOLICION: 0,
    };

    for (const plot of plots) {
      totalAreaHa += plot.areaHectares;
      totalProductionTons += plot.projectedTotalCaneTons;

      areaByStage[plot.currentStage] = Number(
        (areaByStage[plot.currentStage] + plot.areaHectares).toFixed(2)
      );
      productionByStageTons[plot.currentStage] = Number(
        (productionByStageTons[plot.currentStage] + plot.projectedTotalCaneTons).toFixed(2)
      );

      if (plot.currentStage === "DEMOLICION") {
        demolitionAreaHa += plot.areaHectares;
      }
    }

    const averageTch =
      totalAreaHa > 0
        ? Number((totalProductionTons / (totalAreaHa - demolitionAreaHa || 1)).toFixed(2))
        : 0;

    const trace: CalculationTrace = {
      formulaId: "TCH_MEDIO_CAMPANA_V1",
      formulaName: "TCH Medio Ponderado de Campaña Agrícola",
      formulaExpression: "AverageTCH = Sum(ProductionTons) / (TotalAreaHa - DemolitionAreaHa)",
      modelType: "PDA_VALIDATED",
      modelVersion: "1.0.0",
      campaignId: "ZAFRA-2026-2027",
      scenario: "Resumen de Campaña",
      user: "planificador_agricola",
      calculatedAt: new Date().toISOString(),
      inputs: {
        totalAreaHa: { value: Number(totalAreaHa.toFixed(2)), unit: "ha", description: "Área total catastrada" },
        demolitionAreaHa: { value: Number(demolitionAreaHa.toFixed(2)), unit: "ha", description: "Área en demolición excluida" },
        totalProductionTons: { value: Number(totalProductionTons.toFixed(2)), unit: "t", description: "Producción total estimada" },
        plotCount: { value: plots.length, unit: "lotes", description: "Cantidad de parcelas activas" },
      },
      result: { value: averageTch, unit: "t/ha" },
      provenance: {
        documentSource: "Módulo de Rendimiento Consolidado BioAzúcar 4.0",
        historicReference: "Ponderación Productiva de Campaña",
      },
      formula: "AverageTCH = Sum(ProductionTons) / (TotalAreaHa - DemolitionAreaHa)",
      sourceSheet: "Módulo de Rendimiento Consolidado",
      modelRevision: MODEL_REVISION,
    };

    return {
      plots,
      totalAreaHa: Number(totalAreaHa.toFixed(2)),
      totalProductionTons: Number(totalProductionTons.toFixed(2)),
      averageTch,
      areaByStage,
      productionByStageTons,
      demolitionAreaHa: Number(demolitionAreaHa.toFixed(2)),
      trace,
    };
  }

  /**
   * Evaluates field plots to identify those that must be demolished/renovated
   * based on economic yield threshold (e.g. TCH < 55 t/ha or Q7+).
   */
  public static evaluateRenewalNeeds(
    plots: FieldPlot[],
    minEconomicTchThreshold?: number
  ): {
    plotsToRenew: FieldPlot[];
    totalRenewalAreaHa: number;
    percentOfTotalArea: number;
  } {
    const threshold =
      minEconomicTchThreshold ??
      AgriculturalParameterRegistry.getNumberValue("MIN_ECONOMIC_TCH_THRESHOLD", 55.0);

    const totalArea = plots.reduce((sum, p) => sum + p.areaHectares, 0);
    const plotsToRenew = plots.filter((plot) => {
      if (plot.currentStage === "DEMOLICION") return true;
      if (plot.currentStage === "RETONO_Q7_PLUS") return true;
      if (plot.projectedTch > 0 && plot.projectedTch < threshold) return true;
      return false;
    });

    const totalRenewalAreaHa = Number(
      plotsToRenew.reduce((sum, p) => sum + p.areaHectares, 0).toFixed(2)
    );
    const percentOfTotalArea =
      totalArea > 0 ? Number(((totalRenewalAreaHa / totalArea) * 100).toFixed(2)) : 0;

    return {
      plotsToRenew,
      totalRenewalAreaHa,
      percentOfTotalArea,
    };
  }

  /**
   * Simulates a What-If agronomic scenario over baseline plots.
   * e.g. climate drought (-15% TCH), area expansion, fertilizer reduction.
   */
  public static simulateWhatIfScenario(
    baselinePlots: FieldPlot[],
    params: YieldScenarioParams
  ): YieldCalculationResult {
    const simulatedPlots: FieldPlot[] = baselinePlots.map((plot) => {
      const areaMultiplier = 1.0 + (params.areaVariationPercent ?? 0) / 100;
      const modifiedArea = Number((plot.areaHectares * areaMultiplier).toFixed(2));

      return this.calculatePlotYield(
        {
          ...plot,
          areaHectares: modifiedArea,
        },
        {
          climateFactor: params.climateFactor ?? 1.0,
          tchVariationPercent: params.tchVariationPercent ?? 0.0,
          modelType: params.modelType || "WHAT_IF_SCENARIO",
        }
      );
    });

    const result = this.calculateCampaignYieldSummary(simulatedPlots);
    result.trace.formulaId = "TCH_PROYECTADO_WHAT_IF_V1";
    result.trace.formulaName = `Simulación de Escenario: ${params.name}`;
    result.trace.scenario = params.name;
    result.trace.modelType = params.modelType || "WHAT_IF_SCENARIO";
    result.trace.formula = `What-If: ${params.name} | TchVar: ${params.tchVariationPercent ?? 0}% | AreaVar: ${params.areaVariationPercent ?? 0}% | Climate: ${params.climateFactor ?? 1.0}`;
    return result;
  }
}
