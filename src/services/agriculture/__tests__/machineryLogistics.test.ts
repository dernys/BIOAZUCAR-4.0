/**
 * BioAzúcar 4.0 — Agricultural Fleet & CCT Logistics Unit Tests
 * Test Suite: Machinery Dimensioning, Fleet Balance & Transport Logistics
 * 
 * Verifies mathematical compliance with:
 * - ODS Sheet: 'Equipamentos PS_CALCULOS'
 * - ODS Sheet: 'Equipamentos PS_COMPRAS'
 * - ODS Sheet: 'EQUIPAos_RESUMO'
 * - ODS Sheet: 'COLHEITA'
 * - ODS Sheet: 'CCT_pessoas'
 */

import { describe, it, expect } from "vitest";
import {
  MachineryAndLogisticsService,
  BENCHMARK_ACQUISITION_PRICES_USD,
} from "../MachineryAndLogisticsService";
import { MODEL_REVISION } from "../YieldCalculationService";

describe("BioAzúcar 4.0 — Machinery Dimensioning & CCT Logistics (ODS PDA)", () => {
  it("1. Benchmark Prices: contains validated market prices for heavy agricultural equipment", () => {
    expect(BENCHMARK_ACQUISITION_PRICES_USD.TRACTOR_PESADO).toBe(190000.0);
    expect(BENCHMARK_ACQUISITION_PRICES_USD.COSECHADORA_COMBINADA).toBe(450000.0);
    expect(BENCHMARK_ACQUISITION_PRICES_USD.CAMION_CANERO_RODOVIARIO).toBe(185000.0);
  });

  it("2. Fleet Balance Calculation: computes required units, deficit and CAPEX accurately", () => {
    // Heavy tractor workload: 2,000 hours in subsoiling/tillage
    // Calendar window: 60 days
    // Working hours: 16 h/day, availability: 0.85 -> 13.6 effective h/day
    // Capacity per tractor: 60 * 13.6 = 816 h
    // Required: ceil(2000 / 816) = ceil(2.45) = 3 tractors
    // Available: 1 tractor
    // Deficit: 3 - 1 = 2 tractors
    // Unit price: $190,000 USD -> Total CAPEX: $380,000 USD
    const balance = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_PESADO",
      description: "Tractor Pesado 210 HP para Subsolado",
      totalWorkloadHours: 2000.0,
      workingWindowDays: 60,
      dailyOperatingHours: 16,
      mechanicalAvailabilityRatio: 0.85,
      fleetAvailableUnits: 1,
    });

    expect(balance.fleetRequiredUnits).toBe(3);
    expect(balance.fleetAvailableUnits).toBe(1);
    expect(balance.fleetDeficitUnits).toBe(2);
    expect(balance.totalAcquisitionCapexUSD).toBe(380000.0);

    expect(balance.trace.sourceSheet).toContain("Equipamentos");
    expect(balance.trace.modelRevision).toBe(MODEL_REVISION);
    expect(balance.trace.inputs.workloadHours.value).toBe(2000.0);
    expect(balance.trace.inputs.deficitUnits.value).toBe(2);
  });

  it("3. Fleet Consolidation: sums total required machines and investment budget", () => {
    const item1 = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_PESADO",
      description: "Tractores Pesados Subsolado",
      totalWorkloadHours: 2000.0,
      workingWindowDays: 60,
      fleetAvailableUnits: 1,
    }); // 2 deficit * $190,000 = $380,000

    const item2 = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "COSECHADORA_COMBINADA",
      description: "Cosechadoras Combinadas de Caña Picada",
      totalWorkloadHours: 1800.0,
      workingWindowDays: 120,
      dailyOperatingHours: 18,
      mechanicalAvailabilityRatio: 0.80, // 120 * 18 * 0.80 = 1,728 h capacity
      fleetAvailableUnits: 0,
    }); // ceil(1800 / 1728) = 2 harvesters -> 2 deficit * $450,000 = $900,000

    const consolidated = MachineryAndLogisticsService.consolidateFleetPlan({
      tenantId: "tenant-central",
      campaignId: "campaign-2026",
      balanceItems: [item1, item2],
    });

    expect(consolidated.totalFleetRequired).toBe(item1.fleetRequiredUnits + item2.fleetRequiredUnits);
    expect(consolidated.totalFleetDeficit).toBe(item1.fleetDeficitUnits + item2.fleetDeficitUnits);
    expect(consolidated.totalAcquisitionCapexUSD).toBe(380000.0 + 900000.0);
    expect(consolidated.trace.sourceSheet).toBe("EQUIPAos_RESUMO");
  });

  it("4. Transport Cycle (CCT): verifies transit, cycle times, trips and required truck fleet", () => {
    // 60 km round trip (30 km one way)
    // Speed empty: 45 km/h -> 30/45 = 0.667 h
    // Speed loaded: 30 km/h -> 30/30 = 1.000 h
    // Transit time: 1.667 h
    // Loading in field: 0.45 h, Unload at mill: 0.35 h, Field queue: 0.15 h, Mill queue: 0.20 h
    // Total cycle: 1.667 + 0.45 + 0.35 + 0.15 + 0.20 = 2.817 h (~2.82 h)
    // Daily utilization: 80% of 24h = 19.2 effective h/day
    // Trips per truck: 19.2 / 2.82 = 6.81 trips/day
    // Payload: 45 t (Bi-tren cañero)
    // Daily capacity per truck: 6.81 * 45 = 306.45 t/day
    // Mill daily demand: 3,000 t/day
    // Trucks required: ceil(3000 / 306.45) = 10 trucks
    const cct = MachineryAndLogisticsService.calculateTransportCycle({
      roundTripDistanceKm: 60.0,
      dailyHarvestDemandTons: 3000.0,
      averageSpeedEmptyKmH: 45.0,
      averageSpeedLoadedKmH: 30.0,
      loadingInFieldTimeHours: 0.45,
      unloadingAtMillTimeHours: 0.35,
      fieldQueueTimeHours: 0.15,
      millWeighbridgeQueueTimeHours: 0.20,
      payloadTonsPerTruck: 45.0,
      dailyUtilizationFactor: 0.80,
    });

    expect(cct.roundTripDistanceKm).toBe(60.0);
    expect(cct.transitTimeHours).toBeCloseTo(1.667, 2);
    expect(cct.totalCycleTimeHours).toBeCloseTo(2.82, 1);
    expect(cct.effectiveTripsPerTruckDay).toBeGreaterThan(6.0);
    expect(cct.dailyCapacityPerTruckTons).toBeGreaterThan(250.0);
    expect(cct.trucksRequiredForDailyDemand).toBe(10);

    expect(cct.trace.sourceSheet).toContain("COLHEITA");
    expect(cct.trace.inputs.trucksRequired.value).toBe(10);
  });
});
