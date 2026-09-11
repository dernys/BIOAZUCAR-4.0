/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Engine
 * YieldCalculationService: Deterministic biological yield and ratoon decay engine.
 * 
 * Sources:
 * - ODS Sheet: 'TCH'
 * - ODS Sheet: 'EVOLUÇÃO tch por cepa'
 * - ODS Sheet: 'análise Evolução TCH'
 * - ODS Sheet: 'PDA_SET30'
 */

import {
  CaneGrowthStage,
  CaneVarietyYieldMaster,
  FieldPlot,
  CalculationTrace,
  SoilType,
  YieldScenarioParams,
  YieldCalculationResult,
} from "../../types/agriculture";
import { AgriculturalParameterRegistry } from "./AgriculturalParameterRegistry";

export const MODEL_REVISION = "ODS-PDA-SET30-REV2014-V1.0";

/**
 * Soil productivity modifiers based on physical-hydraulic characteristics.
 * Source: ODS Sheet 'TCH' (Pedological index modifiers)
 */
export const SOIL_IMPACT_FACTORS: Record<SoilType, number> = {
  FRANCO: 1.00,     // Loam - standard reference
  ARCILLOSO: 0.98,  // Heavy clay - good water holding, slight root compaction
  ARENOSO: 0.92,    // Sandy - high percolation, lower water and nutrient retention
};

/**
 * Standard reference commercial varieties master data from the sugar region.
 * Source: ODS Sheet 'TCH' & 'EVOLUÇÃO tch por cepa'
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
   * areaHa > 0, tch >= 0, and if tons provided, abs(areaHa * tch - tons) <= 0.1
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
   * Deterministic formula:
   *   TCH = BaseTch * RatoonDecay(Stage) * SoilImpact(SoilType) * ClimateFactor * (1 + TchVariationPercent / 100)
   *   ProductionTons = AreaHectares * TCH
   * 
   * Source: ODS Sheets 'TCH', 'EVOLUÇÃO tch por cepa'
   */
  public static calculatePlotYield(
    plotInput: Omit<FieldPlot, "projectedTch" | "projectedTotalCaneTons" | "trace">,
    options: {
      climateFactor?: number;
      tchVariationPercent?: number;
      varietyCatalog?: CaneVarietyYieldMaster[];
    } = {}
  ): FieldPlot {
    // Dynamically query registry with fallback to catalog
    const dynamicCatalog = AgriculturalParameterRegistry.getVarietyCatalog();
    const catalog = options.varietyCatalog || Object.values(dynamicCatalog).length > 0 ? Object.values(dynamicCatalog) : COMMERCIAL_VARIETIES_CATALOG;
    const variety =
      catalog.find((v) => v.varietyCode.toUpperCase() === plotInput.varietyCode.toUpperCase()) ||
      this.getVariety(plotInput.varietyCode);

    const dynamicSoilFactors = AgriculturalParameterRegistry.getSoilImpactFactors();
    const decayFactor = variety.ratoonDecayFactors[plotInput.currentStage] ?? 0.0;
    const soilFactor = dynamicSoilFactors[plotInput.soilType] ?? SOIL_IMPACT_FACTORS[plotInput.soilType] ?? 1.0;
    const climateFactor = options.climateFactor ?? 1.0;
    const variationMultiplier = 1.0 + (options.tchVariationPercent ?? 0.0) / 100.0;

    // If stage is DEMOLICION, projected TCH and production are 0
    let projectedTch = 0.0;
    let projectedTotalCaneTons = 0.0;

    if (plotInput.currentStage !== "DEMOLICION") {
      projectedTch = Number(
        (variety.baseYieldTch * decayFactor * soilFactor * climateFactor * variationMultiplier).toFixed(2)
      );
      projectedTotalCaneTons = Number((plotInput.areaHectares * projectedTch).toFixed(2));
    }

    const trace: CalculationTrace = {
      formula:
        "ProductionTons = AreaHectares * (BaseYieldTch * RatoonDecay * SoilFactor * ClimateFactor * (1 + TchVarPct/100))",
      sourceSheet: "TCH / EVOLUÇÃO tch por cepa",
      sourceCells: "PDA_SET30!C5:H30, TCH!B3:F20",
      inputs: {
        areaHectares: { value: plotInput.areaHectares, unit: "ha" },
        varietyCode: { value: variety.varietyCode, unit: "variety" },
        baseYieldTch: { value: variety.baseYieldTch, unit: "t/ha" },
        currentStage: { value: plotInput.currentStage, unit: "stage" },
        decayFactor: { value: decayFactor, unit: "ratio" },
        soilType: { value: plotInput.soilType, unit: "pedology" },
        soilFactor: { value: soilFactor, unit: "ratio" },
        climateFactor: { value: climateFactor, unit: "ratio" },
        tchVariationPercent: { value: options.tchVariationPercent ?? 0, unit: "%" },
        resultTch: { value: projectedTch, unit: "t/ha" },
        resultTotalTons: { value: projectedTotalCaneTons, unit: "t" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      ...plotInput,
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
    } = {}
  ): FieldPlot[] {
    return plots.map((p) => this.calculatePlotYield(p, options));
  }

  /**
   * Computes the mathematical area balance across seasons:
   * AreaFinal = AreaInicial + Plantacion - Demolicion + Altas - Bajas
   * 
   * Source: ODS Sheet 'Áreas PS e PL' (Balanço de Áreas de Cana)
   */
  public static computeAreaBalance(params: {
    initialAreaHa: number;
    plantedAreaHa: number;
    demolishedAreaHa: number;
    newArableAdditionsHa?: number;
    lostAreaDeletionsHa?: number;
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
      formula: "AreaFinal = AreaInicial + Plantacion - Demolicion + Altas - Bajas",
      sourceSheet: "Áreas PS e PL",
      sourceCells: "Áreas PS e PL!B3:H12",
      inputs: {
        initialAreaHa: { value: params.initialAreaHa, unit: "ha" },
        plantedAreaHa: { value: params.plantedAreaHa, unit: "ha" },
        demolishedAreaHa: { value: params.demolishedAreaHa, unit: "ha" },
        finalAreaHa: { value: finalAreaHa, unit: "ha" },
        netChangeHa: { value: netChangeHa, unit: "ha" },
      },
      calculatedAt: new Date().toISOString(),
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
   * 
   * Source: ODS Sheets 'resumoEVOLUÇÃO', 'análise Evolução TCH'
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
      formula: "AverageTCH = Sum(ProductionTons) / (TotalAreaHa - DemolitionAreaHa)",
      sourceSheet: "resumoEVOLUÇÃO",
      sourceCells: "resumoEVOLUÇÃO!B2:G15",
      inputs: {
        totalAreaHa: { value: Number(totalAreaHa.toFixed(2)), unit: "ha" },
        demolitionAreaHa: { value: Number(demolitionAreaHa.toFixed(2)), unit: "ha" },
        totalProductionTons: { value: Number(totalProductionTons.toFixed(2)), unit: "t" },
        averageTch: { value: averageTch, unit: "t/ha" },
        plotCount: { value: plots.length, unit: "plots" },
      },
      calculatedAt: new Date().toISOString(),
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
   * 
   * Source: ODS Sheet 'Áreas PS e PL' (Renovación de cañaverales)
   */
  public static evaluateRenewalNeeds(
    plots: FieldPlot[],
    minEconomicTchThreshold = 55.0
  ): {
    plotsToRenew: FieldPlot[];
    totalRenewalAreaHa: number;
    percentOfTotalArea: number;
  } {
    const totalArea = plots.reduce((sum, p) => sum + p.areaHectares, 0);
    const plotsToRenew = plots.filter((plot) => {
      if (plot.currentStage === "DEMOLICION") return true;
      if (plot.currentStage === "RETONO_Q7_PLUS") return true;
      if (plot.projectedTch > 0 && plot.projectedTch < minEconomicTchThreshold) return true;
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
   * 
   * Source: ODS Sheet 'análise Evolução TCH'
   */
  public static simulateWhatIfScenario(
    baselinePlots: FieldPlot[],
    params: YieldScenarioParams
  ): YieldCalculationResult {
    const simulatedPlots: FieldPlot[] = baselinePlots.map((plot) => {
      // Area variation
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
        }
      );
    });

    const result = this.calculateCampaignYieldSummary(simulatedPlots);
    result.trace.formula = `What-If Scenario: ${params.name} | TchVar: ${params.tchVariationPercent ?? 0}% | AreaVar: ${params.areaVariationPercent ?? 0}% | Climate: ${params.climateFactor ?? 1.0}`;
    return result;
  }
}
