/**
 * BioAzúcar 4.0 — Agricultural Planning Unit Tests
 * Test Suite: Soil Preparation, Planting, and Cultural Treatments
 * 
 * Verifies mathematical compliance with:
 * - ODS Sheet: 'Áreas PS e PL'
 * - ODS Sheet: 'Áreas PS_operações'
 * - ODS Sheet: 'PLANTIO'
 * - ODS Sheet: 'TRATOS PLANTA'
 * - ODS Sheet: 'TRATOS SOCAeRETONOS'
 */

import { describe, it, expect } from "vitest";
import {
  AgriculturalPlanningService,
  STANDARD_AGRO_OPERATIONS,
} from "../AgriculturalPlanningService";
import { MODEL_REVISION } from "../YieldCalculationService";

describe("BioAzúcar 4.0 — Agricultural Planning Service (ODS PDA)", () => {
  it("1. Standard Operations Catalog: contains calibrated mechanized operations", () => {
    expect(STANDARD_AGRO_OPERATIONS.length).toBeGreaterThanOrEqual(10);
    const subsolado = STANDARD_AGRO_OPERATIONS.find((op) => op.id === "OP-PS-01");
    expect(subsolado).toBeDefined();
    expect(subsolado?.effectiveCapacityHaPerHour).toBe(0.48);
    expect(subsolado?.fuelConsumptionLitersPerHour).toBe(24.5);
    expect(subsolado?.standardTractorPowerHp).toBe(210);
  });

  it("2. Soil Preparation Planning: computes exact machine hours, diesel volume and machine fleet", () => {
    // Preparing 500 ha over 60 calendar days (16 hours/day, 85% availability = 13.6 effective h/day)
    const plan = AgriculturalPlanningService.planSoilPreparation({
      tenantId: "tenant-central",
      campaignId: "campaign-2026",
      targetPreparationAreaHa: 500.0,
      availableCalendarDays: 60,
      dailyEffectiveHours: 16,
      mechanicalAvailability: 0.85,
    });

    expect(plan.totalPreparationAreaHa).toBe(500.0);
    expect(plan.workloadItems.length).toBe(5); // 5 preparation operations

    // For Subsolado (0.48 ha/h, 24.5 L/h):
    // Hours = 500 / 0.48 = 1041.67 h
    // Diesel = 1041.67 * 24.5 = 25,520.92 L
    const subsoladoItem = plan.workloadItems.find((w) => w.operation.id === "OP-PS-01");
    expect(subsoladoItem).toBeDefined();
    expect(subsoladoItem?.requiredMachineHours).toBeCloseTo(1041.67, 1);
    expect(subsoladoItem?.requiredDieselLiters).toBeCloseTo(25520.92, 0);

    // Fleet required:
    // WorkDays = 1041.67 / (16 * 0.85) = 76.59 days
    // Machines = ceil(76.59 / 60) = 2 machines
    expect(subsoladoItem?.requiredMachines).toBe(2);

    expect(plan.totalMachineHours).toBeGreaterThan(0);
    expect(plan.totalDieselLiters).toBeGreaterThan(0);
    expect(plan.trace.formulaId).toBe("SOIL_PREP_CONSOLIDATED_V1");
    expect(plan.trace.modelType).toBe("PDA_VALIDATED");
  });

  it("3. Planting Planning: verifies seed cane demand, nursery area discount and fertilizer", () => {
    // Planting 1,000 ha of cane
    // Seed rate: 13.5 t/ha -> 13,500 tons
    // Nursery TCH: 90 t/ha -> 150 ha dedicated nursery harvested
    // Fertilizer: 400 kg/ha -> 400 tons of N-P-K
    const plantingPlan = AgriculturalPlanningService.planPlanting({
      tenantId: "tenant-central",
      campaignId: "campaign-2026",
      targetPlantingAreaHa: 1000.0,
      seedCaneRateTonsPerHa: 13.5,
      nurseryCaneAverageTch: 90.0,
      effectiveCapacityHaPerHour: 0.75,
      fuelConsumptionLitersPerHour: 20.0,
      basalFertilizerKgPerHa: 400.0,
    });

    expect(plantingPlan.targetPlantingAreaHa).toBe(1000.0);
    expect(plantingPlan.totalSeedCaneRequiredTons).toBe(13500.0);
    expect(plantingPlan.dedicatedSeedCaneAreaHa).toBe(150.0);
    expect(plantingPlan.totalBasalFertilizerTons).toBe(400.0);

    // Required hours: 1000 / 0.75 = 1333.33 h
    // Required diesel: 1333.33 * 20 = 26,666.67 L
    expect(plantingPlan.requiredMachineHours).toBeCloseTo(1333.33, 1);
    expect(plantingPlan.requiredDieselLiters).toBeCloseTo(26666.67, 0);

    expect(plantingPlan.trace.formulaId).toBe("PLANTING_OPERATIONS_V1");
    expect(plantingPlan.trace.modelType).toBe("PDA_VALIDATED");
  });

  it("4. Cultural Treatments: computes plant vs ratoon treatments and factory vinasse recycling", () => {
    // 1,000 ha plant cane, 5,000 ha ratoon cane
    const treatments = AgriculturalPlanningService.planCulturalTreatments({
      tenantId: "tenant-central",
      campaignId: "campaign-2026",
      plantCaneAreaHa: 1000.0,
      ratoonCaneAreaHa: 5000.0,
      vinasseApplicationRateM3PerHa: 150.0,
      vinasseEligiblePercent: 0.4, // 40% within distance = 2,000 ha
    });

    expect(treatments.plantCaneAreaHa).toBe(1000.0);
    expect(treatments.ratoonCaneAreaHa).toBe(5000.0);

    // Vinasse applied on 2,000 ha * 150 m3/ha = 300,000 m3 recycled from mill
    expect(treatments.vinasseAppliedM3).toBe(300000.0);

    // Verify subproduct flag
    const vinasseItem = treatments.treatmentItems.find((t) => t.usesIndustrialSubproduct);
    expect(vinasseItem).toBeDefined();
    expect(vinasseItem?.operationName).toContain("Vinaza");
    expect(vinasseItem?.targetAreaHa).toBe(2000.0);

    expect(treatments.totalMachineHours).toBeGreaterThan(0);
    expect(treatments.totalDieselLiters).toBeGreaterThan(0);
    expect(treatments.trace.formulaId).toBe("CULTURAL_TREATMENTS_V1");
    expect(treatments.trace.modelType).toBe("PDA_VALIDATED");
  });
});
