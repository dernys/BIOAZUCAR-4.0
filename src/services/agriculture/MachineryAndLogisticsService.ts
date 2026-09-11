/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Engine
 * MachineryAndLogisticsService: Machinery dimensioning, fleet balance and CCT logistics.
 * 
 * 100% Autonomous from spreadsheet runtime dependencies.
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
  TRACTOR_LIGERO: 85000.0,
  COSECHADORA_COMBINADA: 450000.0,
  TRACTOR_TRANSBORDO: 165000.0,
  CAMION_CANERO_RODOVIARIO: 210000.0,
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
   */
  public static calculateFleetBalanceItem(params: {
    category: EquipmentCategory;
    description: string;
    totalWorkloadHours: number;
    workingWindowDays: number;
    dailyOperatingHours?: number;
    mechanicalAvailabilityRatio?: number;
    fleetAvailableUnits: number;
    customUnitPriceUSD?: number;
  }): MachineryFleetBalanceItem {
    const dailyHours =
      params.dailyOperatingHours ??
      AgriculturalParameterRegistry.getNumberValue("HOURS_PER_DAY_SOIL_PREP", 16.0);
    const availability =
      params.mechanicalAvailabilityRatio ??
      AgriculturalParameterRegistry.getNumberValue("EQUIPMENT_AVAILABILITY_SOIL_PREP", 0.85);
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
      formulaId: "FLOTA_REQUERIDA_V1",
      formulaName: "Dimensionamiento de Flota Requerida de Maquinaria",
      formulaExpression: "RequiredUnits = Ceil( WorkloadHours / (CalendarDays * DailyHours * Avail) ); Deficit = Max(0, Req - Avail)",
      modelType: "PDA_VALIDATED",
      modelVersion: "1.0.0",
      campaignId: "ZAFRA-2026-2027",
      scenario: "Plan de Mecanización",
      user: "jefatura_maquinaria",
      calculatedAt: new Date().toISOString(),
      inputs: {
        category: { value: params.category, unit: "categoría", description: "Tipo de activo mecánico" },
        workloadHours: { value: params.totalWorkloadHours, unit: "h", description: "Horas de labor necesarias" },
        workingWindowDays: { value: params.workingWindowDays, unit: "días", description: "Ventana temporal de preparación" },
        dailyHours: { value: dailyHours, unit: "h/día", description: "Jornada operativa diaria", parameterKey: "HOURS_PER_DAY_SOIL_PREP" },
        availability: { value: availability, unit: "ratio", description: "Disponibilidad mecánica", parameterKey: "EQUIPMENT_AVAILABILITY_SOIL_PREP" },
        requiredUnits: { value: fleetRequiredUnits, unit: "unidades", description: "Flota teórica necesaria" },
        availableUnits: { value: params.fleetAvailableUnits, unit: "unidades", description: "Parque existente" },
        deficitUnits: { value: fleetDeficitUnits, unit: "unidades", description: "Déficit neto a adquirir" },
        unitPriceUSD: { value: unitPrice, unit: "USD", description: "Precio benchmark de compra" },
        capexUSD: { value: totalAcquisitionCapexUSD, unit: "USD", description: "Inversión CAPEX estimada" },
      },
      result: { value: fleetRequiredUnits, unit: "unidades" },
      provenance: {
        documentSource: "Módulo de Maquinaria y Tracción BioAzúcar 4.0",
        historicReference: "Dimensionamiento Teórico de Flota",
      },
      formula: "Required = Ceil(Hours / (Days * DailyHours * Avail)); Deficit = Max(0, Req - Avail); Capex = Deficit * Price",
      sourceSheet: "Módulo de Maquinaria",
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
      formulaId: "DEFICIT_FLOTA_V1",
      formulaName: "Consolidación de Plan de Flota y CAPEX",
      formulaExpression: "TotalCapex = Sum(ItemCapex); TotalDeficit = Sum(ItemDeficit); TotalRequired = Sum(ItemRequired)",
      modelType: "PDA_VALIDATED",
      modelVersion: "1.0.0",
      campaignId: params.campaignId,
      scenario: "Consolidación CAPEX",
      user: "jefatura_maquinaria",
      calculatedAt: new Date().toISOString(),
      inputs: {
        totalRequired: { value: totalFleetRequired, unit: "unidades", description: "Flota total necesaria" },
        totalAvailable: { value: totalFleetAvailable, unit: "unidades", description: "Flota propia disponible" },
        totalDeficit: { value: totalFleetDeficit, unit: "unidades", description: "Déficit consolidado" },
        totalCapexUSD: { value: totalAcquisitionCapexUSD, unit: "USD", description: "Inversión total requerida" },
      },
      result: { value: totalAcquisitionCapexUSD, unit: "USD" },
      provenance: {
        documentSource: "Módulo de Flota y Activos de Capital BioAzúcar 4.0",
        historicReference: "Consolidación de Parque Mecanizado",
      },
      formula: "TotalCapex = Sum(ItemCapex); TotalDeficit = Sum(ItemDeficit); TotalRequired = Sum(ItemRequired)",
      sourceSheet: "Módulo de Maquinaria",
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
   */
  public static calculateTransportCycle(params: {
    roundTripDistanceKm: number;
    dailyHarvestDemandTons: number;
    averageSpeedEmptyKmH?: number;
    averageSpeedLoadedKmH?: number;
    loadingInFieldTimeHours?: number;
    unloadingAtMillTimeHours?: number;
    fieldQueueTimeHours?: number;
    millWeighbridgeQueueTimeHours?: number;
    payloadTonsPerTruck?: number;
    dailyUtilizationFactor?: number;
  }): CctTransportCycleCalculation {
    const speedEmpty =
      params.averageSpeedEmptyKmH ??
      AgriculturalParameterRegistry.getNumberValue("CCT_SPEED_EMPTY_KM_H", 45.0);
    const speedLoaded =
      params.averageSpeedLoadedKmH ??
      AgriculturalParameterRegistry.getNumberValue("CCT_SPEED_LOADED_KM_H", 32.0);
    const loadTime =
      params.loadingInFieldTimeHours ??
      AgriculturalParameterRegistry.getNumberValue("CCT_LOADING_IN_FIELD_HOURS", 0.45);
    const unloadTime =
      params.unloadingAtMillTimeHours ??
      AgriculturalParameterRegistry.getNumberValue("CCT_UNLOADING_AT_MILL_HOURS", 0.35);
    const fieldQueue =
      params.fieldQueueTimeHours ??
      AgriculturalParameterRegistry.getNumberValue("CCT_FIELD_QUEUE_HOURS", 0.15);
    const millQueue =
      params.millWeighbridgeQueueTimeHours ??
      AgriculturalParameterRegistry.getNumberValue("CCT_WEIGHBRIDGE_QUEUE_HOURS", 0.20);
    const payload =
      params.payloadTonsPerTruck ??
      AgriculturalParameterRegistry.getNumberValue("CCT_TRUCK_PAYLOAD_TONS", 45.0);
    const utilization =
      params.dailyUtilizationFactor ??
      AgriculturalParameterRegistry.getNumberValue("CCT_UTILIZATION_FACTOR", 0.80);

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
      formulaId: "FLOTA_CAMIONES_V1",
      formulaName: "Flota Requerida de Camiones Cañeros (CCT)",
      formulaExpression: "Transit = (Dist/SpeedEmpty) + (Dist/SpeedLoaded); Cycle = Transit + Load + Unload + Queues; Capacity = (24*Util/Cycle) * Payload; Trucks = Ceil(DailyDemand / Capacity)",
      modelType: "PDA_VALIDATED",
      modelVersion: "1.0.0",
      campaignId: "ZAFRA-2026-2027",
      scenario: "Ciclo Logístico CCT",
      user: "superintendencia_cct",
      calculatedAt: new Date().toISOString(),
      inputs: {
        roundTripDistanceKm: { value: params.roundTripDistanceKm, unit: "km", description: "Distancia redonda campo-fábrica" },
        speedEmptyKmH: { value: speedEmpty, unit: "km/h", description: "Velocidad retorno vacío", parameterKey: "CCT_SPEED_EMPTY_KM_H" },
        speedLoadedKmH: { value: speedLoaded, unit: "km/h", description: "Velocidad con carga", parameterKey: "CCT_SPEED_LOADED_KM_H" },
        transitTimeHours: { value: transitTimeHours, unit: "h", description: "Tiempo rodoviario neto" },
        loadingTime: { value: loadTime, unit: "h", description: "Tiempo de alce en campo", parameterKey: "CCT_LOADING_IN_FIELD_HOURS" },
        unloadingTime: { value: unloadTime, unit: "h", description: "Tiempo descarga en mesa", parameterKey: "CCT_UNLOADING_AT_MILL_HOURS" },
        totalCycleTimeHours: { value: totalCycleTimeHours, unit: "h", description: "Duración de ciclo completo" },
        tripsPerDay: { value: effectiveTripsPerTruckDay, unit: "viajes/día", description: "Viajes diarios por camión" },
        payloadTons: { value: payload, unit: "t", description: "Capacidad útil por viaje", parameterKey: "CCT_TRUCK_PAYLOAD_TONS" },
        dailyCapacityPerTruckTons: { value: dailyCapacityPerTruckTons, unit: "t/día", description: "Capacidad diaria por unidad" },
        dailyHarvestDemandTons: { value: params.dailyHarvestDemandTons, unit: "t/día", description: "Demanda de molienda fábrica" },
        trucksRequired: { value: trucksRequiredForDailyDemand, unit: "camiones", description: "Camiones bi-tren requeridos" },
      },
      result: { value: trucksRequiredForDailyDemand, unit: "camiones" },
      provenance: {
        documentSource: "Módulo Logístico CCT BioAzúcar 4.0",
        historicReference: "Ciclo Cinemático CCT",
      },
      formula: "Transit = (Dist/SpeedEmpty) + (Dist/SpeedLoaded); Cycle = Transit + Load + Unload + Queues; Capacity = (24*Util/Cycle) * Payload; Trucks = Ceil(DailyDemand / Capacity)",
      sourceSheet: "Módulo CCT Logística",
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
