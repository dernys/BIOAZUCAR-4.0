/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Engine
 * AgriculturalPlanningService: Soil preparation, planting, and cultural treatment planning.
 * 
 * Sources:
 * - ODS Sheet: 'Áreas PS e PL'
 * - ODS Sheet: 'Áreas PS_operações'
 * - ODS Sheet: 'PLANTIO'
 * - ODS Sheet: 'TRATOS PLANTA'
 * - ODS Sheet: 'TRATOS SOCAeRETONOS'
 * - ODS Sheet: 'TRATOSequipos'
 */

import {
  AgroOperationMaster,
  SoilPreparationPlan,
  SoilPreparationWorkloadItem,
  PlantingPlan,
  CulturalTreatmentPlan,
  CulturalTreatmentWorkloadItem,
  CalculationTrace,
} from "../../types/agriculture";
import { MODEL_REVISION } from "./YieldCalculationService";

/**
 * Standard agricultural operations catalog for cane production.
 * Source: ODS Sheets 'Áreas PS_operações', 'TRATOSequipos', 'PLANTIO'
 */
export const STANDARD_AGRO_OPERATIONS: AgroOperationMaster[] = [
  {
    id: "OP-PS-01",
    category: "PREPARO_SOLO",
    name: "Subsolado Profundo (50 cm)",
    standardTractorPowerHp: 210,
    standardImplement: "Subsolador 5 Astes Descompactador",
    effectiveCapacityHaPerHour: 0.48,
    fuelConsumptionLitersPerHour: 24.5,
    targetCycle: "PRE_PLANTIO",
    operatorCount: 1,
  },
  {
    id: "OP-PS-02",
    category: "PREPARO_SOLO",
    name: "Arado / Gradaje Pesado de Roturación",
    standardTractorPowerHp: 180,
    standardImplement: "Grada de Discos Pesada 28x32",
    effectiveCapacityHaPerHour: 0.65,
    fuelConsumptionLitersPerHour: 21.0,
    targetCycle: "PRE_PLANTIO",
    operatorCount: 1,
  },
  {
    id: "OP-PS-03",
    category: "PREPARO_SOLO",
    name: "Grada Niveladora / Afinamiento",
    standardTractorPowerHp: 140,
    standardImplement: "Grada Niveladora 42 Discos",
    effectiveCapacityHaPerHour: 1.25,
    fuelConsumptionLitersPerHour: 16.0,
    targetCycle: "PRE_PLANTIO",
    operatorCount: 1,
  },
  {
    id: "OP-PS-04",
    category: "PREPARO_SOLO",
    name: "Encalado / Corrección de Acidez",
    standardTractorPowerHp: 110,
    standardImplement: "Distribuidor Centrífugo de Caliza 5t",
    effectiveCapacityHaPerHour: 1.80,
    fuelConsumptionLitersPerHour: 12.5,
    targetCycle: "PRE_PLANTIO",
    operatorCount: 1,
  },
  {
    id: "OP-PS-05",
    category: "PREPARO_SOLO",
    name: "Surcado con Fertilización de Fondo",
    standardTractorPowerHp: 140,
    standardImplement: "Surcador Bicanal con Dosificador NPK",
    effectiveCapacityHaPerHour: 0.85,
    fuelConsumptionLitersPerHour: 15.0,
    targetCycle: "PRE_PLANTIO",
    operatorCount: 1,
  },
  {
    id: "OP-PL-01",
    category: "PLANTIO",
    name: "Plantío Mecanizado de Caña Picada",
    standardTractorPowerHp: 180,
    standardImplement: "Plantadora Picadora 2 Líneas",
    effectiveCapacityHaPerHour: 0.75,
    fuelConsumptionLitersPerHour: 20.0,
    targetCycle: "PLANTA",
    operatorCount: 2,
  },
  {
    id: "OP-TR-01",
    category: "TRATOS_CULTURAIS",
    name: "Deshierbe Químico Pre-emergente",
    standardTractorPowerHp: 110,
    standardImplement: "Barra Pulverizadora 18m con GPS",
    effectiveCapacityHaPerHour: 1.90,
    fuelConsumptionLitersPerHour: 11.0,
    targetCycle: "ALL",
    operatorCount: 1,
  },
  {
    id: "OP-TR-02",
    category: "TRATOS_CULTURAIS",
    name: "Quebra-Lombo y Aporque Mecánico",
    standardTractorPowerHp: 110,
    standardImplement: "Cultivador Aporcador de Discos",
    effectiveCapacityHaPerHour: 1.15,
    fuelConsumptionLitersPerHour: 12.0,
    targetCycle: "PLANTA",
    operatorCount: 1,
  },
  {
    id: "OP-TR-03",
    category: "TRATOS_CULTURAIS",
    name: "Cultivo y Descompactación Entre Líneas",
    standardTractorPowerHp: 120,
    standardImplement: "Cultivador Aliviador con Fertilizador",
    effectiveCapacityHaPerHour: 1.05,
    fuelConsumptionLitersPerHour: 14.0,
    targetCycle: "SOCA_RETONO",
    operatorCount: 1,
  },
  {
    id: "OP-TR-04",
    category: "TRATOS_CULTURAIS",
    name: "Aplicación de Vinaza Fabril Enriquecida",
    standardTractorPowerHp: 140,
    standardImplement: "Cisterna de Esparcimiento 12.000 L",
    effectiveCapacityHaPerHour: 0.90,
    fuelConsumptionLitersPerHour: 17.5,
    targetCycle: "SOCA_RETONO",
    operatorCount: 1,
  },
];

export class AgriculturalPlanningService {
  /**
   * Plans the soil preparation workload for renovated cane areas.
   * Calculates machine-hours, diesel volume and required machines.
   * 
   * Source: ODS Sheets 'Áreas PS e PL', 'Áreas PS_operações'
   */
  public static planSoilPreparation(params: {
    tenantId: string;
    campaignId: string;
    targetPreparationAreaHa: number;
    availableCalendarDays: number;
    dailyEffectiveHours?: number;       // default 16 hours (2 shifts of 8h)
    mechanicalAvailability?: number;    // default 0.85 (85% availability)
    customOperations?: AgroOperationMaster[];
  }): SoilPreparationPlan {
    const dailyHours = params.dailyEffectiveHours ?? 16;
    const availability = params.mechanicalAvailability ?? 0.85;
    const effectiveHoursPerDay = dailyHours * availability;

    const operations =
      params.customOperations ??
      STANDARD_AGRO_OPERATIONS.filter((op) => op.category === "PREPARO_SOLO");

    let totalMachineHours = 0;
    let totalDieselLiters = 0;
    let estimatedLaborDays = 0;

    const workloadItems: SoilPreparationWorkloadItem[] = operations.map((operation) => {
      const requiredHours = Number(
        (params.targetPreparationAreaHa / operation.effectiveCapacityHaPerHour).toFixed(2)
      );
      const diesel = Number((requiredHours * operation.fuelConsumptionLitersPerHour).toFixed(2));
      const workDays = Number((requiredHours / effectiveHoursPerDay).toFixed(2));
      const requiredMachines = Math.max(
        1,
        Math.ceil(workDays / Math.max(1, params.availableCalendarDays))
      );

      totalMachineHours += requiredHours;
      totalDieselLiters += diesel;
      estimatedLaborDays += workDays * operation.operatorCount;

      const trace: CalculationTrace = {
        formula:
          "Hours = AreaHa / EffectiveCapacityHaPerHour; Diesel = Hours * FuelRateLitersPerHour; Machines = Ceil(WorkDays / CalendarDays)",
        sourceSheet: "Áreas PS_operações",
        sourceCells: "Áreas PS_operações!B4:H20",
        inputs: {
          areaHa: { value: params.targetPreparationAreaHa, unit: "ha" },
          operationName: { value: operation.name, unit: "text" },
          effectiveCapacity: { value: operation.effectiveCapacityHaPerHour, unit: "ha/h" },
          fuelRate: { value: operation.fuelConsumptionLitersPerHour, unit: "L/h" },
          requiredHours: { value: requiredHours, unit: "h" },
          dieselLiters: { value: diesel, unit: "L" },
          machinesCount: { value: requiredMachines, unit: "units" },
        },
        calculatedAt: new Date().toISOString(),
        modelRevision: MODEL_REVISION,
      };

      return {
        operation,
        targetAreaHectares: params.targetPreparationAreaHa,
        requiredMachineHours: requiredHours,
        requiredDieselLiters: diesel,
        requiredWorkDays: workDays,
        requiredMachines,
        trace,
      };
    });

    const planTrace: CalculationTrace = {
      formula: "TotalMachineHours = Sum(OpHours); TotalDiesel = Sum(OpDiesel)",
      sourceSheet: "Áreas PS e PL",
      sourceCells: "Áreas PS e PL!C3:J15",
      inputs: {
        totalAreaHa: { value: params.targetPreparationAreaHa, unit: "ha" },
        totalHours: { value: Number(totalMachineHours.toFixed(2)), unit: "h" },
        totalDiesel: { value: Number(totalDieselLiters.toFixed(2)), unit: "L" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      totalPreparationAreaHa: params.targetPreparationAreaHa,
      workloadItems,
      totalMachineHours: Number(totalMachineHours.toFixed(2)),
      totalDieselLiters: Number(totalDieselLiters.toFixed(2)),
      estimatedLaborDays: Number(estimatedLaborDays.toFixed(1)),
      trace: planTrace,
    };
  }

  /**
   * Plans the mechanized planting schedule and nursery seed cane consumption.
   * 
   * Source: ODS Sheet 'PLANTIO'
   */
  public static planPlanting(params: {
    tenantId: string;
    campaignId: string;
    targetPlantingAreaHa: number;
    seedCaneRateTonsPerHa?: number;     // default 13.5 t/ha
    nurseryCaneAverageTch?: number;     // default 90.0 t/ha
    effectiveCapacityHaPerHour?: number;// default 0.75 ha/h
    fuelConsumptionLitersPerHour?: number; // default 20.0 L/h
    basalFertilizerKgPerHa?: number;    // default 400 kg/ha N-P-K
  }): PlantingPlan {
    const seedRate = params.seedCaneRateTonsPerHa ?? 13.5;
    const nurseryTch = params.nurseryCaneAverageTch ?? 90.0;
    const capacity = params.effectiveCapacityHaPerHour ?? 0.75;
    const fuelRate = params.fuelConsumptionLitersPerHour ?? 20.0;
    const fertilizerDose = params.basalFertilizerKgPerHa ?? 400.0;

    const totalSeedCaneTons = Number((params.targetPlantingAreaHa * seedRate).toFixed(2));
    const dedicatedSeedAreaHa = Number((totalSeedCaneTons / nurseryTch).toFixed(2));
    const requiredHours = Number((params.targetPlantingAreaHa / capacity).toFixed(2));
    const requiredDiesel = Number((requiredHours * fuelRate).toFixed(2));
    const totalFertilizerTons = Number(
      ((params.targetPlantingAreaHa * fertilizerDose) / 1000.0).toFixed(2)
    );

    const trace: CalculationTrace = {
      formula:
        "SeedTons = AreaHa * SeedRate; NurseryArea = SeedTons / NurseryTch; Diesel = (AreaHa / Cap) * FuelRate; FertTons = AreaHa * FertDose / 1000",
      sourceSheet: "PLANTIO",
      sourceCells: "PLANTIO!B3:F25",
      inputs: {
        plantingAreaHa: { value: params.targetPlantingAreaHa, unit: "ha" },
        seedRateTonsPerHa: { value: seedRate, unit: "t/ha" },
        totalSeedTons: { value: totalSeedCaneTons, unit: "t" },
        dedicatedNurseryAreaHa: { value: dedicatedSeedAreaHa, unit: "ha" },
        fertilizerDoseKgPerHa: { value: fertilizerDose, unit: "kg/ha" },
        totalFertilizerTons: { value: totalFertilizerTons, unit: "t" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      targetPlantingAreaHa: params.targetPlantingAreaHa,
      seedCaneRateTonsPerHa: seedRate,
      totalSeedCaneRequiredTons: totalSeedCaneTons,
      dedicatedSeedCaneAreaHa: dedicatedSeedAreaHa,
      effectivePlantingCapacityHaPerHour: capacity,
      requiredMachineHours: requiredHours,
      requiredDieselLiters: requiredDiesel,
      fertilizerAtFurrowKgPerHa: fertilizerDose,
      totalBasalFertilizerTons: totalFertilizerTons,
      trace,
    };
  }

  /**
   * Plans the cultural treatments differentiated for Caña Planta and Socas/Retoños.
   * Integrates the recycling of industrial by-products (factory vinasse and filter cake / cachaza).
   * 
   * Source: ODS Sheets 'TRATOS PLANTA', 'TRATOS SOCAeRETONOS'
   */
  public static planCulturalTreatments(params: {
    tenantId: string;
    campaignId: string;
    plantCaneAreaHa: number;
    ratoonCaneAreaHa: number;
    vinasseApplicationRateM3PerHa?: number; // default 150 m3/ha
    filterCakeApplicationRateTonsPerHa?: number; // default 30 t/ha
    vinasseEligiblePercent?: number;        // default 40% of ratoon within mill radius
  }): CulturalTreatmentPlan {
    const vinasseRate = params.vinasseApplicationRateM3PerHa ?? 150.0;
    const filterCakeRate = params.filterCakeApplicationRateTonsPerHa ?? 30.0;
    const vinasseArea = Number(
      (params.ratoonCaneAreaHa * (params.vinasseEligiblePercent ?? 0.4)).toFixed(2)
    );

    const treatmentItems: CulturalTreatmentWorkloadItem[] = [
      // 1. Planta: Deshierbe Pre-emergente
      {
        targetStage: "PLANTA",
        operationName: "Deshierbe Químico Pre-emergente",
        targetAreaHa: params.plantCaneAreaHa,
        effectiveCapacityHaPerHour: 1.90,
        requiredMachineHours: Number((params.plantCaneAreaHa / 1.90).toFixed(2)),
        fuelConsumptionLitersPerHour: 11.0,
        requiredDieselLiters: Number(((params.plantCaneAreaHa / 1.90) * 11.0).toFixed(2)),
        inputProduct: "Herbicida Combinado Pre-emergente",
        inputDosagePerHa: 3.5,
        inputUnit: "L/ha",
        totalInputQuantity: Number((params.plantCaneAreaHa * 3.5).toFixed(2)),
        usesIndustrialSubproduct: false,
      },
      // 2. Planta: Quebra-Lombo y Aporque
      {
        targetStage: "PLANTA",
        operationName: "Quebra-Lombo y Aporque Mecánico",
        targetAreaHa: params.plantCaneAreaHa,
        effectiveCapacityHaPerHour: 1.15,
        requiredMachineHours: Number((params.plantCaneAreaHa / 1.15).toFixed(2)),
        fuelConsumptionLitersPerHour: 12.0,
        requiredDieselLiters: Number(((params.plantCaneAreaHa / 1.15) * 12.0).toFixed(2)),
        usesIndustrialSubproduct: false,
      },
      // 3. Soca: Cultivo y Descompactación Entre Líneas con NPK
      {
        targetStage: "SOCA_RETONO",
        operationName: "Cultivo y Descompactación con Abonamiento NPK",
        targetAreaHa: params.ratoonCaneAreaHa,
        effectiveCapacityHaPerHour: 1.05,
        requiredMachineHours: Number((params.ratoonCaneAreaHa / 1.05).toFixed(2)),
        fuelConsumptionLitersPerHour: 14.0,
        requiredDieselLiters: Number(((params.ratoonCaneAreaHa / 1.05) * 14.0).toFixed(2)),
        inputProduct: "Fertilizante Cobertura N-P-K (20-05-20)",
        inputDosagePerHa: 350.0,
        inputUnit: "kg/ha",
        totalInputQuantity: Number(((params.ratoonCaneAreaHa * 350.0) / 1000.0).toFixed(2)),
        usesIndustrialSubproduct: false,
      },
      // 4. Soca: Reciclaje de Vinaza Fabril en Campo
      {
        targetStage: "SOCA_RETONO",
        operationName: "Fertirrigación con Vinaza Fabril",
        targetAreaHa: vinasseArea,
        effectiveCapacityHaPerHour: 0.90,
        requiredMachineHours: Number((vinasseArea / 0.90).toFixed(2)),
        fuelConsumptionLitersPerHour: 17.5,
        requiredDieselLiters: Number(((vinasseArea / 0.90) * 17.5).toFixed(2)),
        inputProduct: "Vinaza Industrial de Destilería",
        inputDosagePerHa: vinasseRate,
        inputUnit: "m3/ha",
        totalInputQuantity: Number((vinasseArea * vinasseRate).toFixed(2)),
        usesIndustrialSubproduct: true,
      },
    ];

    const totalMachineHours = Number(
      treatmentItems.reduce((sum, item) => sum + item.requiredMachineHours, 0).toFixed(2)
    );
    const totalDieselLiters = Number(
      treatmentItems.reduce((sum, item) => sum + item.requiredDieselLiters, 0).toFixed(2)
    );
    const totalVinasseM3 = Number((vinasseArea * vinasseRate).toFixed(2));
    const totalFilterCakeTons = Number(
      (params.plantCaneAreaHa * 0.3 * filterCakeRate).toFixed(2)
    ); // Applied on 30% of plant cane area

    const trace: CalculationTrace = {
      formula:
        "Hours = Area / EffCap; Diesel = Hours * FuelRate; VinasseM3 = EligibleSocaArea * 150 m3/ha",
      sourceSheet: "TRATOS PLANTA / TRATOS SOCAeRETONOS",
      sourceCells: "TRATOS PLANTA!C4:H20, TRATOS SOCAeRETONOS!B3:G25",
      inputs: {
        plantCaneAreaHa: { value: params.plantCaneAreaHa, unit: "ha" },
        ratoonCaneAreaHa: { value: params.ratoonCaneAreaHa, unit: "ha" },
        vinasseAreaHa: { value: vinasseArea, unit: "ha" },
        vinasseAppliedM3: { value: totalVinasseM3, unit: "m3" },
        filterCakeAppliedTons: { value: totalFilterCakeTons, unit: "t" },
      },
      calculatedAt: new Date().toISOString(),
      modelRevision: MODEL_REVISION,
    };

    return {
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      plantCaneAreaHa: params.plantCaneAreaHa,
      ratoonCaneAreaHa: params.ratoonCaneAreaHa,
      treatmentItems,
      totalMachineHours,
      totalDieselLiters,
      vinasseAppliedM3: totalVinasseM3,
      filterCakeAppliedTons: totalFilterCakeTons,
      trace,
    };
  }
}
