/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Engine
 * AgroEconomicsService: OPEX and CAPEX economic consolidation and unit cost metrics.
 * 
 * Sources:
 * - ODS Sheet: 'OPEX'
 * - ODS Sheet: 'CAPEX'
 * - ODS Sheet: 'resumo CAPEX'
 * - ODS Sheet: 'DIESEL e LUBR'
 * - ODS Sheet: 'FERTILIZANTES'
 * - ODS Sheet: 'INSUMOS'
 * - ODS Sheet: 'MATERIAIS MANUT'
 * - ODS Sheet: 'RESUMO PESSOAS'
 */

import {
  AgroEconomicsSummary,
  AgroOpexCostBreakdown,
  AgroCapexCostBreakdown,
  SoilPreparationPlan,
  PlantingPlan,
  CulturalTreatmentPlan,
  MachineryFleetPlan,
  CalculationTrace,
} from "../../types/agriculture";
import { MODEL_REVISION } from "./YieldCalculationService";
import { AgriculturalParameterRegistry } from "./AgriculturalParameterRegistry";

export const BENCHMARK_ECONOMIC_PRICES = {
  DIESEL_USD_PER_LITER: 0.95,
  FERTILIZER_NPK_USD_PER_TON: 620.0,
  AGRICULTURAL_LIME_USD_PER_TON: 45.0,
  HERBICIDE_DEFENSIVE_USD_PER_HA: 35.0,
  MAINTENANCE_PARTS_USD_PER_HOUR: 12.5,
  LABOR_OPERATOR_MONTH_USD: 1450.0,
};

export class AgroEconomicsService {
  /**
   * Consolidates OPEX and CAPEX for an agricultural campaign.
   * Produces the canonical cost per hectare ($/ha) and cost per delivered cane ton ($/t).
   * 
   * Deterministic formulas:
   *   TotalDieselCost = TotalDieselLiters * DieselPriceUSD
   *   TotalOpex = Fuel + Fertilizers + Chemicals + Maintenance + Labor + Other
   *   CostPerHa = TotalOpex / TotalArableAreaHa
   *   CostPerTon = TotalOpex / TotalCaneTonsDelivered
   * 
   * Source: ODS Sheets 'OPEX', 'CAPEX', 'DIESEL e LUBR', 'FERTILIZANTES'
   */
  public static consolidateCampaignEconomics(params: {
    tenantId: string;
    campaignId: string;
    totalArableAreaHa: number;
    totalCaneTonsDelivered: number;
    soilPrepPlan?: SoilPreparationPlan;
    plantingPlan?: PlantingPlan;
    treatmentsPlan?: CulturalTreatmentPlan;
    fleetPlan?: MachineryFleetPlan;
    harvestDieselLiters?: number;       // e.g. ~4.2 L/t harvested
    transportDieselLiters?: number;     // e.g. ~1.8 L/t transported
    customDieselPriceUSD?: number;
    infrastructureCapexUSD?: number;    // From 'OUTROS INV'
    soilRenovationCapexUSD?: number;
  }): AgroEconomicsSummary {
    const dieselPrice =
      params.customDieselPriceUSD ??
      AgriculturalParameterRegistry.getParameterValue<number>(
        "DIESEL_PRICE_USD_PER_LITER",
        BENCHMARK_ECONOMIC_PRICES.DIESEL_USD_PER_LITER
      );

    const harvestDieselRate = AgriculturalParameterRegistry.getParameterValue<number>(
      "DIESEL_HARVEST_LITERS_PER_TON",
      4.2
    );
    const transportDieselRate = AgriculturalParameterRegistry.getParameterValue<number>(
      "DIESEL_TRANSPORT_LITERS_PER_TON",
      1.8
    );

    // Diesel volume consolidation
    const prepDiesel = params.soilPrepPlan?.totalDieselLiters ?? 0;
    const plantDiesel = params.plantingPlan?.requiredDieselLiters ?? 0;
    const treatDiesel = params.treatmentsPlan?.totalDieselLiters ?? 0;
    const harvestDiesel =
      params.harvestDieselLiters ?? params.totalCaneTonsDelivered * harvestDieselRate;
    const transportDiesel =
      params.transportDieselLiters ?? params.totalCaneTonsDelivered * transportDieselRate;

    const totalDieselLiters = Number(
      (prepDiesel + plantDiesel + treatDiesel + harvestDiesel + transportDiesel).toFixed(2)
    );
    const fuelDieselCostUSD = Number((totalDieselLiters * dieselPrice).toFixed(2));

    // Insumos & Fertilizers
    const basalFertilizerTons = params.plantingPlan?.totalBasalFertilizerTons ?? 0;
    const ratoonFertilizerRateKgPerHa = AgriculturalParameterRegistry.getParameterValue<number>(
      "FERTILIZER_RATOON_KG_PER_HA",
      350.0
    );
    const fertilizerNpkPriceUSD = AgriculturalParameterRegistry.getParameterValue<number>(
      "PRICE_FERTILIZER_NPK_USD_PER_TON",
      BENCHMARK_ECONOMIC_PRICES.FERTILIZER_NPK_USD_PER_TON
    );
    const herbicideCostPerHa = AgriculturalParameterRegistry.getParameterValue<number>(
      "COST_HERBICIDE_USD_PER_HA",
      BENCHMARK_ECONOMIC_PRICES.HERBICIDE_DEFENSIVE_USD_PER_HA
    );
    const maintenanceRatePerHourUSD = AgriculturalParameterRegistry.getParameterValue<number>(
      "COST_MACHINERY_MAINTENANCE_USD_PER_HOUR",
      BENCHMARK_ECONOMIC_PRICES.MAINTENANCE_PARTS_USD_PER_HOUR
    );
    const operatorMonthlySalaryUSD = AgriculturalParameterRegistry.getParameterValue<number>(
      "LABOR_OPERATOR_MONTHLY_USD",
      BENCHMARK_ECONOMIC_PRICES.LABOR_OPERATOR_MONTH_USD
    );

    const ratoonArea = params.treatmentsPlan?.ratoonCaneAreaHa ?? params.totalArableAreaHa * 0.8;
    const coverFertilizerTons = (ratoonArea * ratoonFertilizerRateKgPerHa) / 1000.0;
    const totalFertilizerTons = basalFertilizerTons + coverFertilizerTons;
    const fertilizersAndAmendmentsCostUSD = Number(
      (totalFertilizerTons * fertilizerNpkPriceUSD).toFixed(2)
    );

    const agrochemicalsAndDefensivesCostUSD = Number(
      (params.totalArableAreaHa * herbicideCostPerHa).toFixed(2)
    );

    // Maintenance of Fleet & Implement wear parts
    const totalMachineHours =
      (params.soilPrepPlan?.totalMachineHours ?? 0) +
      (params.plantingPlan?.requiredMachineHours ?? 0) +
      (params.treatmentsPlan?.totalMachineHours ?? 0) +
      (params.totalCaneTonsDelivered / 50.0); // Harvester hours (~50 t/h)

    const machineryMaintenanceCostUSD = Number(
      (totalMachineHours * maintenanceRatePerHourUSD).toFixed(2)
    );

    // Labor (estimated headcount based on machine hours / standard shift)
    const totalWorkDays = totalMachineHours / 8.0;
    const laborMonths = totalWorkDays / 25.0;
    const workforceLaborCostUSD = Number(
      (laborMonths * operatorMonthlySalaryUSD).toFixed(2)
    );

    const otherOperationalCostsUSD = Number(
      (params.totalArableAreaHa * 18.5).toFixed(2) // Roads, communication, safety
    );

    const totalOpexUSD = Number(
      (
        fuelDieselCostUSD +
        fertilizersAndAmendmentsCostUSD +
        agrochemicalsAndDefensivesCostUSD +
        machineryMaintenanceCostUSD +
        workforceLaborCostUSD +
        otherOperationalCostsUSD
      ).toFixed(2)
    );

    const costPerHectareUSD =
      params.totalArableAreaHa > 0
        ? Number((totalOpexUSD / params.totalArableAreaHa).toFixed(2))
        : 0;

    const costPerTonCaneUSD =
      params.totalCaneTonsDelivered > 0
        ? Number((totalOpexUSD / params.totalCaneTonsDelivered).toFixed(2))
        : 0;

    const opex: AgroOpexCostBreakdown = {
      fuelDieselCostUSD,
      fertilizersAndAmendmentsCostUSD,
      agrochemicalsAndDefensivesCostUSD,
      machineryMaintenanceCostUSD,
      workforceLaborCostUSD,
      otherOperationalCostsUSD,
      totalOpexUSD,
      costPerHectareUSD,
      costPerTonCaneUSD,
    };

    // CAPEX consolidation
    const machineryAcquisitionUSD = params.fleetPlan?.totalAcquisitionCapexUSD ?? 0;
    const agriculturalInfrastructureUSD = params.infrastructureCapexUSD ?? 120000.0;
    const soilImprovementAndRenovationUSD = params.soilRenovationCapexUSD ?? 85000.0;
    const totalCapexUSD = Number(
      (
        machineryAcquisitionUSD +
        agriculturalInfrastructureUSD +
        soilImprovementAndRenovationUSD
      ).toFixed(2)
    );

    const capex: AgroCapexCostBreakdown = {
      machineryAcquisitionUSD,
      agriculturalInfrastructureUSD,
      soilImprovementAndRenovationUSD,
      totalCapexUSD,
    };

    const trace: CalculationTrace = {
      formula:
        "TotalOpex = Sum(Diesel + Fert + Chem + Maint + Labor + Other); CostPerTon = TotalOpex / TotalCaneTons; CostPerHa = TotalOpex / TotalAreaHa",
      sourceSheet: "OPEX / CAPEX / DIESEL e LUBR",
      sourceCells: "OPEX!B4:H30, CAPEX!C3:J20",
      inputs: {
        totalAreaHa: { value: params.totalArableAreaHa, unit: "ha" },
        totalCaneTons: { value: params.totalCaneTonsDelivered, unit: "t" },
        totalDieselLiters: { value: totalDieselLiters, unit: "L" },
        dieselPriceUSD: { value: dieselPrice, unit: "USD/L" },
        totalOpexUSD: { value: totalOpexUSD, unit: "USD" },
        costPerHaUSD: { value: costPerHectareUSD, unit: "USD/ha" },
        costPerTonUSD: { value: costPerTonCaneUSD, unit: "USD/t" },
        totalCapexUSD: { value: totalCapexUSD, unit: "USD" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      currency: "USD",
      dieselPricePerLiterUSD: dieselPrice,
      totalDieselConsumedLiters: totalDieselLiters,
      totalCaneTonsDelivered: params.totalCaneTonsDelivered,
      totalArableAreaHa: params.totalArableAreaHa,
      opex,
      capex,
      trace,
    };
  }
}
