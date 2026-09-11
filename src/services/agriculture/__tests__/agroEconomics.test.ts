/**
 * BioAzúcar 4.0 — Agro-Economics & OPEX / CAPEX Unit Tests
 * Test Suite: Economic Consolidation & Agricultural Unit Costs
 * 
 * Verifies mathematical compliance with:
 * - ODS Sheet: 'OPEX'
 * - ODS Sheet: 'CAPEX'
 * - ODS Sheet: 'resumo CAPEX'
 * - ODS Sheet: 'DIESEL e LUBR'
 * - ODS Sheet: 'FERTILIZANTES'
 */

import { describe, it, expect } from "vitest";
import {
  AgroEconomicsService,
  BENCHMARK_ECONOMIC_PRICES,
} from "../AgroEconomicsService";
import { AgriculturalPlanningService } from "../AgriculturalPlanningService";
import { MachineryAndLogisticsService } from "../MachineryAndLogisticsService";
import { MODEL_REVISION } from "../YieldCalculationService";

describe("BioAzúcar 4.0 — Agro-Economics Consolidation (ODS PDA)", () => {
  it("1. Benchmark Prices: contains validated prices for energy, agrochemicals and labor", () => {
    expect(BENCHMARK_ECONOMIC_PRICES.DIESEL_USD_PER_LITER).toBe(0.95);
    expect(BENCHMARK_ECONOMIC_PRICES.FERTILIZER_NPK_USD_PER_TON).toBe(620.0);
    expect(BENCHMARK_ECONOMIC_PRICES.MAINTENANCE_PARTS_USD_PER_HOUR).toBe(12.5);
    expect(BENCHMARK_ECONOMIC_PRICES.LABOR_OPERATOR_MONTH_USD).toBe(1450.0);
  });

  it("2. OPEX & Unit Costs: consolidates fuel, inputs, maintenance and labor into $/ha and $/t", () => {
    const totalAreaHa = 1000.0;
    const totalCaneTons = 85000.0; // 85 t/ha average

    const prepPlan = AgriculturalPlanningService.planSoilPreparation({
      tenantId: "tenant-central",
      campaignId: "camp-2026",
      targetPreparationAreaHa: 150.0, // 15% renewal
      availableCalendarDays: 45,
    });

    const plantPlan = AgriculturalPlanningService.planPlanting({
      tenantId: "tenant-central",
      campaignId: "camp-2026",
      targetPlantingAreaHa: 150.0,
    });

    const treatPlan = AgriculturalPlanningService.planCulturalTreatments({
      tenantId: "tenant-central",
      campaignId: "camp-2026",
      plantCaneAreaHa: 150.0,
      ratoonCaneAreaHa: 850.0,
    });

    const economics = AgroEconomicsService.consolidateCampaignEconomics({
      tenantId: "tenant-central",
      campaignId: "camp-2026",
      totalArableAreaHa: totalAreaHa,
      totalCaneTonsDelivered: totalCaneTons,
      soilPrepPlan: prepPlan,
      plantingPlan: plantPlan,
      treatmentsPlan: treatPlan,
      customDieselPriceUSD: 0.95,
    });

    expect(economics.totalDieselConsumedLiters).toBeGreaterThan(0);
    expect(economics.opex.fuelDieselCostUSD).toBeCloseTo(
      economics.totalDieselConsumedLiters * 0.95,
      0
    );

    expect(economics.opex.totalOpexUSD).toBeGreaterThan(0);
    expect(economics.opex.costPerHectareUSD).toBeCloseTo(
      economics.opex.totalOpexUSD / totalAreaHa,
      2
    );
    expect(economics.opex.costPerTonCaneUSD).toBeCloseTo(
      economics.opex.totalOpexUSD / totalCaneTons,
      2
    );

    // Realistic range for sugar cane agricultural direct OPEX: $8 to $30 USD/t of cane
    expect(economics.opex.costPerTonCaneUSD).toBeGreaterThan(8.0);
    expect(economics.opex.costPerTonCaneUSD).toBeLessThan(35.0);

    expect(economics.trace.formulaId).toBe("AGRO_ECONOMICS_CONSOLIDATED_V1");
    expect(economics.trace.modelType).toBe("PDA_VALIDATED");
  });

  it("3. CAPEX Consolidation: integrates fleet acquisition, infrastructure and soil improvements", () => {
    const fleetItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_PESADO",
      description: "Tractor Pesado",
      totalWorkloadHours: 1500,
      workingWindowDays: 60,
      fleetAvailableUnits: 0,
    }); // 2 deficit * $190,000 = $380,000

    const fleetPlan = MachineryAndLogisticsService.consolidateFleetPlan({
      tenantId: "tenant-central",
      campaignId: "camp-2026",
      balanceItems: [fleetItem],
    });

    const economics = AgroEconomicsService.consolidateCampaignEconomics({
      tenantId: "tenant-central",
      campaignId: "camp-2026",
      totalArableAreaHa: 1000.0,
      totalCaneTonsDelivered: 80000.0,
      fleetPlan,
      infrastructureCapexUSD: 150000.0,
      soilRenovationCapexUSD: 50000.0,
    });

    expect(economics.capex.machineryAcquisitionUSD).toBe(380000.0);
    expect(economics.capex.agriculturalInfrastructureUSD).toBe(150000.0);
    expect(economics.capex.soilImprovementAndRenovationUSD).toBe(50000.0);
    expect(economics.capex.totalCapexUSD).toBe(380000.0 + 150000.0 + 50000.0);
  });
});
