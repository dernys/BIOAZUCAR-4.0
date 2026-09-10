/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Unit Tests
 * Test Suite: Yield Calculation Engine & Ratoon Decay Model
 * 
 * Verifies mathematical compliance with:
 * - ODS Sheet: 'TCH'
 * - ODS Sheet: 'EVOLUÇÃO tch por cepa'
 * - ODS Sheet: 'análise Evolução TCH'
 * - ODS Sheet: 'resumoEVOLUÇÃO'
 */

import { describe, it, expect } from "vitest";
import {
  YieldCalculationService,
  SOIL_IMPACT_FACTORS,
  COMMERCIAL_VARIETIES_CATALOG,
  MODEL_REVISION,
} from "../YieldCalculationService";
import { FieldPlot } from "../../../types/agriculture";

describe("BioAzúcar 4.0 — Agronomic Yield Calculation Engine (ODS PDA)", () => {
  it("1. Commercial Varieties Catalog: contains base varieties with valid biological traits", () => {
    const catalog = YieldCalculationService.getCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(3);

    const rb86 = YieldCalculationService.getVariety("RB86-7515");
    expect(rb86.baseYieldTch).toBe(105.0);
    expect(rb86.polPercent).toBe(14.5);
    expect(rb86.fiberPercent).toBe(13.2);
    expect(rb86.ratoonDecayFactors.PLANTA).toBe(1.0);
    expect(rb86.ratoonDecayFactors.SOCA).toBe(0.90);
    expect(rb86.ratoonDecayFactors.RETONO_Q7_PLUS).toBe(0.52);
    expect(rb86.ratoonDecayFactors.DEMOLICION).toBe(0.0);

    expect(() => YieldCalculationService.getVariety("NON_EXISTENT_VAR")).toThrow();
  });

  it("2. Dimension & Unit Safety: validates area, TCH and tonnage relationships strictly", () => {
    // Valid cases
    expect(YieldCalculationService.validateDimensions(100, 80, 8000)).toBe(true);
    expect(YieldCalculationService.validateDimensions(50.5, 92.4, 4666.2)).toBe(true);

    // Invalid cases (negative area, negative TCH, math mismatch)
    expect(YieldCalculationService.validateDimensions(-10, 80)).toBe(false);
    expect(YieldCalculationService.validateDimensions(100, -5)).toBe(false);
    expect(YieldCalculationService.validateDimensions(100, 80, 9999)).toBe(false); // 100 * 80 != 9999
  });

  it("3. Plot Yield Calculation: correctly calculates Planta on standard Loam (Franco) soil", () => {
    const rawPlot = {
      id: "plot-001",
      tenantId: "tenant-central-portuguesa",
      code: "LOTE-N01",
      uebName: "División Norte",
      areaHectares: 50.0,
      varietyCode: "RB86-7515",
      currentStage: "PLANTA" as const,
      ratoonAgeYears: 1,
      soilType: "FRANCO" as const,
      distanceToMillKm: 12.5,
      historicalAverageTch: 104.0,
      scheduledHarvestMonth: 3,
      status: "VEGETACION" as const,
    };

    const calculated = YieldCalculationService.calculatePlotYield(rawPlot);

    // Base TCH is 105.0, decay is 1.0, soil is 1.0 => 105.0 t/ha
    expect(calculated.projectedTch).toBe(105.0);
    // 50 ha * 105.0 t/ha = 5250 t
    expect(calculated.projectedTotalCaneTons).toBe(5250.0);

    // Check evidence-first calculation trace
    expect(calculated.trace).toBeDefined();
    expect(calculated.trace?.sourceSheet).toContain("TCH");
    expect(calculated.trace?.modelRevision).toBe(MODEL_REVISION);
    expect(calculated.trace?.inputs.areaHectares.value).toBe(50.0);
    expect(calculated.trace?.inputs.resultTch.value).toBe(105.0);
  });

  it("4. Ratoon Decay Curve: verifies deterministic yield reduction through all cutting stages", () => {
    const stages = [
      { stage: "PLANTA" as const, expectedTch: 105.0 },
      { stage: "SOCA" as const, expectedTch: 94.5 },      // 105 * 0.90
      { stage: "RETONO_Q2" as const, expectedTch: 87.15 }, // 105 * 0.83
      { stage: "RETONO_Q3" as const, expectedTch: 79.8 },  // 105 * 0.76
      { stage: "RETONO_Q4" as const, expectedTch: 73.5 },  // 105 * 0.70
      { stage: "RETONO_Q5" as const, expectedTch: 66.15 }, // 105 * 0.63
      { stage: "RETONO_Q6" as const, expectedTch: 60.9 },  // 105 * 0.58
      { stage: "RETONO_Q7_PLUS" as const, expectedTch: 54.6 }, // 105 * 0.52
      { stage: "DEMOLICION" as const, expectedTch: 0.0 },
    ];

    for (const item of stages) {
      const plot = YieldCalculationService.calculatePlotYield({
        id: `plot-${item.stage}`,
        tenantId: "tenant-test",
        code: `LOTE-${item.stage}`,
        uebName: "División Centro",
        areaHectares: 10.0,
        varietyCode: "RB86-7515",
        currentStage: item.stage,
        ratoonAgeYears: 2,
        soilType: "FRANCO",
        distanceToMillKm: 15,
        historicalAverageTch: 80,
        scheduledHarvestMonth: 4,
        status: "VEGETACION",
      });

      expect(plot.projectedTch).toBeCloseTo(item.expectedTch, 1);
      if (item.stage === "DEMOLICION") {
        expect(plot.projectedTotalCaneTons).toBe(0);
      } else {
        expect(plot.projectedTotalCaneTons).toBeCloseTo(10.0 * item.expectedTch, 1);
      }
    }
  });

  it("5. Soil Impact Factors: modifies yield according to pedological classification", () => {
    // Franco: 1.00
    // Arcilloso: 0.98 => 105 * 0.98 = 102.9 t/ha
    // Arenoso: 0.92 => 105 * 0.92 = 96.6 t/ha

    const baseInput = {
      id: "plot-soil",
      tenantId: "tenant-test",
      code: "LOTE-SOIL",
      uebName: "División Este",
      areaHectares: 100.0,
      varietyCode: "RB86-7515",
      currentStage: "PLANTA" as const,
      ratoonAgeYears: 1,
      distanceToMillKm: 20,
      historicalAverageTch: 100,
      scheduledHarvestMonth: 2,
      status: "VEGETACION" as const,
    };

    const plotFranco = YieldCalculationService.calculatePlotYield({
      ...baseInput,
      soilType: "FRANCO",
    });
    const plotArcilloso = YieldCalculationService.calculatePlotYield({
      ...baseInput,
      soilType: "ARCILLOSO",
    });
    const plotArenoso = YieldCalculationService.calculatePlotYield({
      ...baseInput,
      soilType: "ARENOSO",
    });

    expect(plotFranco.projectedTch).toBe(105.0);
    expect(plotArcilloso.projectedTch).toBe(102.9);
    expect(plotArenoso.projectedTch).toBe(96.6);
  });

  it("6. Campaign Summary: calculates weighted average TCH and breakdown by cycle stage", () => {
    const plots: FieldPlot[] = [
      YieldCalculationService.calculatePlotYield({
        id: "p1",
        tenantId: "t1",
        code: "L-1",
        uebName: "UEB 1",
        areaHectares: 100.0,
        varietyCode: "RB86-7515",
        currentStage: "PLANTA",
        ratoonAgeYears: 1,
        soilType: "FRANCO",
        distanceToMillKm: 10,
        historicalAverageTch: 105,
        scheduledHarvestMonth: 1,
        status: "VEGETACION",
      }), // 100 ha * 105.0 t/ha = 10,500 t
      YieldCalculationService.calculatePlotYield({
        id: "p2",
        tenantId: "t1",
        code: "L-2",
        uebName: "UEB 1",
        areaHectares: 100.0,
        varietyCode: "RB86-7515",
        currentStage: "SOCA",
        ratoonAgeYears: 2,
        soilType: "FRANCO",
        distanceToMillKm: 12,
        historicalAverageTch: 95,
        scheduledHarvestMonth: 2,
        status: "VEGETACION",
      }), // 100 ha * 94.5 t/ha = 9,450 t
      YieldCalculationService.calculatePlotYield({
        id: "p3",
        tenantId: "t1",
        code: "L-3",
        uebName: "UEB 1",
        areaHectares: 50.0,
        varietyCode: "RB86-7515",
        currentStage: "DEMOLICION",
        ratoonAgeYears: 7,
        soilType: "FRANCO",
        distanceToMillKm: 14,
        historicalAverageTch: 45,
        scheduledHarvestMonth: 5,
        status: "EN_PREPARACION",
      }), // 50 ha * 0 t/ha = 0 t
    ];

    const summary = YieldCalculationService.calculateCampaignYieldSummary(plots);

    expect(summary.totalAreaHa).toBe(250.0);
    expect(summary.totalProductionTons).toBe(19950.0); // 10,500 + 9,450
    expect(summary.demolitionAreaHa).toBe(50.0);

    // Weighted average TCH over harvestable area (200 ha): 19,950 / 200 = 99.75 t/ha
    expect(summary.averageTch).toBe(99.75);

    expect(summary.areaByStage.PLANTA).toBe(100.0);
    expect(summary.areaByStage.SOCA).toBe(100.0);
    expect(summary.areaByStage.DEMOLICION).toBe(50.0);
  });

  it("7. Renewal Needs Evaluation: identifies plots below economic threshold or in Q7+/Demolición", () => {
    const plots: FieldPlot[] = [
      YieldCalculationService.calculatePlotYield({
        id: "p-ok",
        tenantId: "t1",
        code: "L-OK",
        uebName: "UEB 1",
        areaHectares: 100.0,
        varietyCode: "RB86-7515",
        currentStage: "SOCA",
        ratoonAgeYears: 2,
        soilType: "FRANCO",
        distanceToMillKm: 10,
        historicalAverageTch: 95,
        scheduledHarvestMonth: 1,
        status: "VEGETACION",
      }), // 94.5 t/ha (> 55)
      YieldCalculationService.calculatePlotYield({
        id: "p-old",
        tenantId: "t1",
        code: "L-OLD",
        uebName: "UEB 1",
        areaHectares: 40.0,
        varietyCode: "RB86-7515",
        currentStage: "RETONO_Q7_PLUS",
        ratoonAgeYears: 7,
        soilType: "FRANCO",
        distanceToMillKm: 10,
        historicalAverageTch: 50,
        scheduledHarvestMonth: 2,
        status: "VEGETACION",
      }), // 54.6 t/ha (< 55 and Q7+)
      YieldCalculationService.calculatePlotYield({
        id: "p-demo",
        tenantId: "t1",
        code: "L-DEMO",
        uebName: "UEB 1",
        areaHectares: 60.0,
        varietyCode: "RB86-7515",
        currentStage: "DEMOLICION",
        ratoonAgeYears: 8,
        soilType: "FRANCO",
        distanceToMillKm: 10,
        historicalAverageTch: 40,
        scheduledHarvestMonth: 3,
        status: "EN_PREPARACION",
      }), // Demolition
    ];

    const evaluation = YieldCalculationService.evaluateRenewalNeeds(plots, 55.0);

    expect(evaluation.plotsToRenew.length).toBe(2);
    expect(evaluation.totalRenewalAreaHa).toBe(100.0); // 40 ha + 60 ha
    // Total area is 200 ha, renewal is 100 ha => 50%
    expect(evaluation.percentOfTotalArea).toBe(50.0);
  });

  it("8. What-If Scenario Simulation: accurately calculates drought (-10% TCH) and area variations", () => {
    const baselinePlots: FieldPlot[] = [
      YieldCalculationService.calculatePlotYield({
        id: "p-base",
        tenantId: "t1",
        code: "L-BASE",
        uebName: "UEB 1",
        areaHectares: 100.0,
        varietyCode: "RB86-7515",
        currentStage: "PLANTA",
        ratoonAgeYears: 1,
        soilType: "FRANCO",
        distanceToMillKm: 10,
        historicalAverageTch: 105,
        scheduledHarvestMonth: 1,
        status: "VEGETACION",
      }),
    ];

    // Drought scenario: -10% TCH
    const droughtScenario = YieldCalculationService.simulateWhatIfScenario(baselinePlots, {
      name: "Sequía Severa (-10% TCH)",
      tchVariationPercent: -10,
    });

    // 105 * 0.90 = 94.5 t/ha
    expect(droughtScenario.averageTch).toBe(94.5);
    expect(droughtScenario.totalProductionTons).toBe(9450.0);

    // Area expansion (+10% area)
    const expansionScenario = YieldCalculationService.simulateWhatIfScenario(baselinePlots, {
      name: "Expansión de Área (+10%)",
      areaVariationPercent: 10,
    });

    expect(expansionScenario.totalAreaHa).toBe(110.0);
    expect(expansionScenario.averageTch).toBe(105.0);
    expect(expansionScenario.totalProductionTons).toBe(11550.0);
  });
});
