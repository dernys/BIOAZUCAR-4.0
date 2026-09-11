/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Engine
 * MachineryAndLogisticsService: Machinery dimensioning, fleet balance and CCT logistics.
 * 
 * Sources:
 * - ODS Sheet: 'Equipamentos PS_CALCULOS'
 * - ODS Sheet: 'Equipamentos PS_COMPRAS'
 * - ODS Sheet: 'EQUIPAos_RESUMO'
 * - ODS Sheet: 'COLHEITA'
 * - ODS Sheet: 'CCT_pessoas'
 * - ODS Sheet: 'Equipamentos_base/DIN'
 */

import {
  EquipmentCategory,
  MachineryFleetBalanceItem,
  MachineryFleetPlan,
  CctTransportCycleCalculation,
  CalculationTrace,
} from "../../types/agriculture";
import { MODEL_REVISION } from "./YieldCalculationService";
import { AgriculturalParameterRegistry } from "./AgriculturalParameterRegistry";

/**
 * Standard benchmark acquisition cost for agricultural machinery (USD).
 * Dynamic resolution via AgriculturalParameterRegistry with fallback.
 */
export const BENCHMARK_ACQUISITION_PRICES_USD: Record<EquipmentCategory, number> = {
  TRACTOR_PESADO: 190000.0,
  TRACTOR_MEDIO: 125000.0,
  TRACTOR_LIGERO: 80000.0,
  COSECHADORA_COMBINADA: 450000.0,
  TRACTOR_TRANSBORDO: 145000.0,
  CAMION_CANERO_RODOVIARIO: 185000.0,
  IMPLEMENTO_AGRICOLA: 35000.0,
};

export class MachineryAndLogisticsService {
  /**
   * Helper to retrieve equipment acquisition price from the dynamic registry.
   */
  public static getEquipmentUnitPrice(category: EquipmentCategory): number {
    const regKey = `PRICE_${category}_USD`;
    return AgriculturalParameterRegistry.getParameterValue<number>(
      regKey,
      BENCHMARK_ACQUISITION_PRICES_USD[category] ?? 100000.0
    );
  }

  /**
   * Calculates fleet dimensioning and acquisition deficit for an operational category.
   * Deterministic formula:
   *   RequiredUnits = Ceil( WorkloadHours / (CalendarDays * DailyOperatingHours * Availability) )
   *   DeficitUnits = Max( 0, RequiredUnits - AvailableUnits )
   *   TotalCapex = DeficitUnits * UnitPriceUSD
   * 
   * Source: ODS Sheet 'Equipamentos PS_CALCULOS', 'Equipamentos PS_COMPRAS'
   */
  public static calculateFleetBalanceItem(params: {
    category: EquipmentCategory;
    description: string;
    totalWorkloadHours: number;
    workingWindowDays: number;
    dailyOperatingHours?: number;         // default from registry
    mechanicalAvailabilityRatio?: number; // default from registry
    fleetAvailableUnits: number;
    customUnitPriceUSD?: number;
  }): MachineryFleetBalanceItem {
    const dailyHours =
      params.dailyOperatingHours ??
      AgriculturalParameterRegistry.getParameterValue<number>("HOURS_PER_DAY_SOIL_PREP", 16);
    const availability =
      params.mechanicalAvailabilityRatio ??
      AgriculturalParameterRegistry.getParameterValue<number>("EQUIPMENT_AVAILABILITY_SOIL_PREP", 0.85);
    const unitPrice =
      params.customUnitPriceUSD ?? this.getEquipmentUnitPrice(params.category);

    const capacityPerMachineHours = params.workingWindowDays * dailyHours * availability;
    const fleetRequiredUnits =
      capacityPerMachineHours > 0
        ? Math.max(1, Math.ceil(params.totalWorkloadHours / capacityPerMachineHours))
        : 1;

    const fleetDeficitUnits = Math.max(0, fleetRequiredUnits - params.fleetAvailableUnits);
    const totalAcquisitionCapexUSD = Number((fleetDeficitUnits * unitPrice).toFixed(2));

    const trace: CalculationTrace = {
      formula:
        "Required = Ceil(Hours / (Days * DailyHours * Avail)); Deficit = Max(0, Req - Avail); Capex = Deficit * Price",
      sourceSheet: "Equipamentos PS_CALCULOS / Equipamentos PS_COMPRAS",
      sourceCells: "Equipamentos PS_CALCULOS!D4:K20",
      inputs: {
        category: { value: params.category, unit: "category" },
        workloadHours: { value: params.totalWorkloadHours, unit: "h" },
        workingWindowDays: { value: params.workingWindowDays, unit: "days" },
        dailyHours: { value: dailyHours, unit: "h/day" },
        availability: { value: availability, unit: "ratio" },
        requiredUnits: { value: fleetRequiredUnits, unit: "units" },
        availableUnits: { value: params.fleetAvailableUnits, unit: "units" },
        deficitUnits: { value: fleetDeficitUnits, unit: "units" },
        unitPriceUSD: { value: unitPrice, unit: "USD" },
        capexUSD: { value: totalAcquisitionCapexUSD, unit: "USD" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      category: params.category,
      description: params.description,
      totalWorkloadHours: params.totalWorkloadHours,
      workingWindowDays: params.workingWindowDays,
      dailyOperatingHours: dailyHours,
      mechanicalAvailabilityRatio: availability,
      fleetRequiredUnits,
      fleetAvailableUnits: params.fleetAvailableUnits,
      fleetDeficitUnits,
      unitAcquisitionPriceUSD: unitPrice,
      totalAcquisitionCapexUSD,
      trace,
    };
  }

  /**
   * Consolidates the fleet balance items into an overall Machinery Fleet Plan.
   * Source: ODS Sheet 'EQUIPAos_RESUMO', 'res equip EAC'
   */
  public static consolidateFleetPlan(params: {
    tenantId: string;
    campaignId: string;
    balanceItems: MachineryFleetBalanceItem[];
  }): MachineryFleetPlan {
    const totalFleetRequired = params.balanceItems.reduce(
      (sum, item) => sum + item.fleetRequiredUnits,
      0
    );
    const totalFleetAvailable = params.balanceItems.reduce(
      (sum, item) => sum + item.fleetAvailableUnits,
      0
    );
    const totalFleetDeficit = params.balanceItems.reduce(
      (sum, item) => sum + item.fleetDeficitUnits,
      0
    );
    const totalAcquisitionCapexUSD = Number(
      params.balanceItems.reduce((sum, item) => sum + item.totalAcquisitionCapexUSD, 0).toFixed(2)
    );

    const trace: CalculationTrace = {
      formula:
        "TotalCapex = Sum(ItemCapex); TotalDeficit = Sum(ItemDeficit); TotalRequired = Sum(ItemRequired)",
      sourceSheet: "EQUIPAos_RESUMO",
      sourceCells: "EQUIPAos_RESUMO!C3:J15",
      inputs: {
        totalRequired: { value: totalFleetRequired, unit: "units" },
        totalAvailable: { value: totalFleetAvailable, unit: "units" },
        totalDeficit: { value: totalFleetDeficit, unit: "units" },
        totalCapexUSD: { value: totalAcquisitionCapexUSD, unit: "USD" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      balanceItems: params.balanceItems,
      totalFleetRequired,
      totalFleetAvailable,
      totalFleetDeficit,
      totalAcquisitionCapexUSD,
      trace,
    };
  }

  /**
   * Calculates the full logistics cycle for Cane Cutting, Loading and Transport (CCT).
   * Determines the required road truck fleet to guarantee the daily mill grinding rate.
   * 
   * Deterministic formula:
   *   TransitTime = (Distance / SpeedEmpty) + (Distance / SpeedLoaded)
   *   TotalCycleTime = TransitTime + InFieldLoad + MillUnload + Queues
   *   TripsPerDay = (24 * OperatingFactor) / TotalCycleTime
   *   DailyCapacityPerTruck = TripsPerDay * PayloadTons
   *   RequiredTrucks = Ceil( DailyHarvestDemandTons / DailyCapacityPerTruck )
   * 
   * Source: ODS Sheets 'COLHEITA', 'CCT_pessoas'
   */
  public static calculateTransportCycle(params: {
    roundTripDistanceKm: number;
    dailyHarvestDemandTons: number;
    averageSpeedEmptyKmH?: number;       // default 45 km/h
    averageSpeedLoadedKmH?: number;      // default 32 km/h
    loadingInFieldTimeHours?: number;    // default 0.45 h (27 min)
    unloadingAtMillTimeHours?: number;   // default 0.35 h (21 min)
    fieldQueueTimeHours?: number;        // default 0.15 h
    millWeighbridgeQueueTimeHours?: number; // default 0.20 h
    payloadTonsPerTruck?: number;        // default 45.0 t (Bi-tren cañero)
    dailyUtilizationFactor?: number;     // default 0.80 (80% 24h utilization = 19.2 operating hours)
  }): CctTransportCycleCalculation {
    const speedEmpty =
      params.averageSpeedEmptyKmH ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_SPEED_EMPTY_KM_H", 45.0);
    const speedLoaded =
      params.averageSpeedLoadedKmH ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_SPEED_LOADED_KM_H", 32.0);
    const loadTime =
      params.loadingInFieldTimeHours ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_LOADING_IN_FIELD_HOURS", 0.45);
    const unloadTime =
      params.unloadingAtMillTimeHours ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_UNLOADING_AT_MILL_HOURS", 0.35);
    const fieldQueue =
      params.fieldQueueTimeHours ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_FIELD_QUEUE_HOURS", 0.15);
    const millQueue =
      params.millWeighbridgeQueueTimeHours ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_MILL_QUEUE_HOURS", 0.20);
    const payload =
      params.payloadTonsPerTruck ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_TRUCK_PAYLOAD_TONS", 45.0);
    const utilization =
      params.dailyUtilizationFactor ??
      AgriculturalParameterRegistry.getParameterValue<number>("CCT_UTILIZATION_FACTOR", 0.80);

    // One-way distance is roundTrip / 2
    const oneWayDistance = params.roundTripDistanceKm / 2.0;
    const emptyTransit = oneWayDistance / speedEmpty;
    const loadedTransit = oneWayDistance / speedLoaded;
    const transitTimeHours = Number((emptyTransit + loadedTransit).toFixed(3));

    const totalCycleTimeHours = Number(
      (transitTimeHours + loadTime + unloadTime + fieldQueue + millQueue).toFixed(2)
    );

    const effectiveOperatingHoursPerDay = 24.0 * utilization;
    const effectiveTripsPerTruckDay = Number(
      (effectiveOperatingHoursPerDay / totalCycleTimeHours).toFixed(2)
    );

    const dailyCapacityPerTruckTons = Number(
      (effectiveTripsPerTruckDay * payload).toFixed(2)
    );

    const trucksRequiredForDailyDemand =
      dailyCapacityPerTruckTons > 0
        ? Math.ceil(params.dailyHarvestDemandTons / dailyCapacityPerTruckTons)
        : 1;

    const trace: CalculationTrace = {
      formula:
        "Transit = (Dist/SpeedEmpty) + (Dist/SpeedLoaded); Cycle = Transit + Load + Unload + Queues; Capacity = (24*Util/Cycle) * Payload; Trucks = Ceil(DailyDemand / Capacity)",
      sourceSheet: "COLHEITA / CCT_pessoas",
      sourceCells: "COLHEITA!C6:J30, CCT_pessoas!D4:H18",
      inputs: {
        roundTripDistanceKm: { value: params.roundTripDistanceKm, unit: "km" },
        speedEmptyKmH: { value: speedEmpty, unit: "km/h" },
        speedLoadedKmH: { value: speedLoaded, unit: "km/h" },
        transitTimeHours: { value: transitTimeHours, unit: "h" },
        totalCycleTimeHours: { value: totalCycleTimeHours, unit: "h" },
        tripsPerDay: { value: effectiveTripsPerTruckDay, unit: "trips/day" },
        payloadTons: { value: payload, unit: "t" },
        dailyCapacityPerTruckTons: { value: dailyCapacityPerTruckTons, unit: "t/day" },
        dailyHarvestDemandTons: { value: params.dailyHarvestDemandTons, unit: "t/day" },
        trucksRequired: { value: trucksRequiredForDailyDemand, unit: "trucks" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      roundTripDistanceKm: params.roundTripDistanceKm,
      averageSpeedEmptyKmH: speedEmpty,
      averageSpeedLoadedKmH: speedLoaded,
      transitTimeHours,
      loadingInFieldTimeHours: loadTime,
      unloadingAtMillTimeHours: unloadTime,
      fieldQueueTimeHours: fieldQueue,
      millWeighbridgeQueueTimeHours: millQueue,
      totalCycleTimeHours,
      effectiveTripsPerTruckDay,
      payloadTonsPerTruck: payload,
      dailyCapacityPerTruckTons,
      trucksRequiredForDailyDemand,
      trace,
    };
  }
}
