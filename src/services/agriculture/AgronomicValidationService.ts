/**
 * BioAzúcar 4.0 — Agronomic Data Governance & Validation Pipeline (ISA-95 Level 4)
 * 
 * Enforces the mandatory 11-step flow:
 * INPUT → NORMALIZE → TYPE VALIDATION → REQUIRED FIELD VALIDATION → UNIT VALIDATION 
 * → RANGE VALIDATION → REFERENCE VALIDATION → DUPLICATE VALIDATION → BUSINESS RULE VALIDATION 
 * → DATA QUALITY STATUS → PERSISTENCE → AUDIT
 * 
 * Autonomous and strict: rejects missing inputs, invented numbers, and dimensional mismatches.
 */

import {
  AgriculturalCampaign,
  FieldPlot,
  AgriculturalParameter,
  CaneVarietyYieldMaster,
  AgroOperationMaster,
  AgriculturalEquipmentAsset,
  AgriculturalInputMaster,
  AgriculturalScenario,
  FieldPlotStatus,
  AgroWorkRequirement,
  HarvestOrder,
  HarvestExecutionEvent,
  CaneDispatch,
  FactoryWeighingAndReception,
  DataQuality,
  DataClassification,
  DataOrigin,
  CaneGrowthStage,
  SoilType,
  CaneLaboratorySample,
  CaneLabValidationOptions,
  BateyWeighbridgeReconciliation,
} from "../../types/agriculture";
import { WorkOrder, WorkOrderStatus, CaneBatchStatus } from "../../types";
import { createHash } from "../../utils/cryptoUtils";

export interface AgronomicValidationError {
  field: string;
  value: any;
  rule: string;
  expectedUnit?: string;
  allowedRange?: string;
  actionRequired: string;
}

export interface AgronomicValidationResult<T> {
  isValid: boolean;
  dataQuality: DataQuality;
  normalizedData: T;
  errors: AgronomicValidationError[];
  warnings: AgronomicValidationError[];
}

export class AgronomicValidationService {
  /**
   * 1. CAMPAIGN VALIDATION
   */
  public static validateAgriculturalCampaign(
    raw: any,
    existingCampaigns: AgriculturalCampaign[] = []
  ): AgronomicValidationResult<AgriculturalCampaign> {
    return AgronomicValidationService.validateCampaign(raw, existingCampaigns);
  }

  public static validateCampaign(
    raw: any,
    existingCampaigns: AgriculturalCampaign[] = []
  ): AgronomicValidationResult<AgriculturalCampaign> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as AgriculturalCampaign,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de campaña requerido",
          actionRequired: "Proporcione un objeto de configuración de campaña válido.",
        }],
        warnings: [],
      };
    }

    // Required Strings
    const name = String(raw.name || "").trim();
    if (!name) {
      errors.push({
        field: "name",
        value: raw.name,
        rule: "El nombre de la campaña o zafra es obligatorio",
        actionRequired: "Especifique un nombre descriptivo de zafra (ej: Zafra 2026/2027).",
      });
    }

    const tenantId = String(raw.tenantId || "TENANT_AZUCAR_01").trim();

    // Numerical Fields & Ranges
    const calendarDays = Number(raw.calendarDays);
    if (isNaN(calendarDays) || calendarDays <= 0 || calendarDays > 365) {
      errors.push({
        field: "calendarDays",
        value: raw.calendarDays,
        rule: "Días calendario de zafra debe ser un entero entre 1 y 365",
        expectedUnit: "días",
        allowedRange: "1 - 365 días",
        actionRequired: "Ingrese la duración total del calendario de zafra.",
      });
    }

    const effectiveHarvestDays = Number(raw.effectiveHarvestDays);
    if (isNaN(effectiveHarvestDays) || effectiveHarvestDays <= 0) {
      errors.push({
        field: "effectiveHarvestDays",
        value: raw.effectiveHarvestDays,
        rule: "Días efectivos de cosecha debe ser mayor que 0",
        expectedUnit: "días",
        allowedRange: "1 - 365 días",
        actionRequired: "Defina los días efectivos netos previstos de molienda.",
      });
    } else if (!isNaN(calendarDays) && effectiveHarvestDays > calendarDays) {
      errors.push({
        field: "effectiveHarvestDays",
        value: effectiveHarvestDays,
        rule: "Los días efectivos de zafra no pueden superar los días calendario",
        expectedUnit: "días",
        allowedRange: `<= ${calendarDays} días`,
        actionRequired: "Ajuste los días efectivos para que sean menores o iguales a los días calendario.",
      });
    }

    const targetMillingTons = Number(raw.targetMillingTons ?? raw.projectedTotalCaneTons);
    if (isNaN(targetMillingTons) || targetMillingTons <= 0) {
      errors.push({
        field: "targetMillingTons",
        value: targetMillingTons,
        rule: "La meta de molienda de caña debe ser mayor a 0",
        expectedUnit: "t",
        allowedRange: "> 0 t",
        actionRequired: "Especifique el tonelaje total presupuestado a moler.",
      });
    }

    const targetSugarTons = Number(raw.targetSugarTons ?? raw.sugarTargetTons);
    if (isNaN(targetSugarTons) || targetSugarTons <= 0) {
      errors.push({
        field: "targetSugarTons",
        value: targetSugarTons,
        rule: "La meta de azúcar debe ser mayor a 0",
        expectedUnit: "t",
        allowedRange: "> 0 t",
        actionRequired: "Especifique la producción de azúcar prevista.",
      });
    } else if (!isNaN(targetMillingTons) && targetMillingTons > 0 && targetSugarTons > targetMillingTons * 0.25) {
      errors.push({
        field: "targetSugarTons",
        value: targetSugarTons,
        rule: "Rendimiento agroindustrial implícito imposible (> 25% de azúcar sobre caña)",
        expectedUnit: "t",
        allowedRange: `0.05 - 0.16 * ${targetMillingTons} t`,
        actionRequired: "Verifique la meta de azúcar respecto al volumen de caña.",
      });
    }

    const plannedRenovationRatePercent = Number(raw.plannedRenovationRatePercent ?? raw.renewalTargetPercent);
    if (isNaN(plannedRenovationRatePercent) || plannedRenovationRatePercent < 0 || plannedRenovationRatePercent > 50) {
      errors.push({
        field: "plannedRenovationRatePercent",
        value: plannedRenovationRatePercent,
        rule: "La tasa de renovación debe estar entre 0% y 50%",
        expectedUnit: "%",
        allowedRange: "0 - 50%",
        actionRequired: "Ajuste el porcentaje anual de renovación de cepas.",
      });
    }

    const totalAreaHectares = Number(raw.totalAreaHectares);
    if (isNaN(totalAreaHectares) || totalAreaHectares <= 0) {
      errors.push({
        field: "totalAreaHectares",
        value: raw.totalAreaHectares,
        rule: "El área total de la campaña debe ser mayor a 0 hectáreas",
        expectedUnit: "ha",
        allowedRange: "> 0 ha",
        actionRequired: "Ingrese la superficie arable total administrada.",
      });
    }

    // Duplicates check
    const currentId = raw.id;
    const isDuplicateName = existingCampaigns.some(
      (c) => c.id !== currentId && c.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicateName) {
      errors.push({
        field: "name",
        value: name,
        rule: "Ya existe otra campaña con el mismo nombre en este tenant",
        actionRequired: "Asigne un nombre de campaña o zafra único.",
      });
    }

    // Determine Data Quality
    let dataQuality: DataQuality = "COMPLETE";
    if (errors.length > 0) {
      dataQuality = "INCOMPLETE";
    } else if (warnings.length > 0) {
      dataQuality = "UNVERIFIED";
    } else {
      dataQuality = "VALIDATED";
    }

    const harvestDays = Math.max(1, effectiveHarvestDays || 1);
    const dailyDemand = targetMillingTons > 0 ? Number((targetMillingTons / harvestDays).toFixed(1)) : 0;
    const tchAvg = totalAreaHectares > 0 && targetMillingTons > 0 ? Number((targetMillingTons / totalAreaHectares).toFixed(2)) : 0;

    const normalizedData: AgriculturalCampaign = {
      id: String(raw.id || `camp-${Date.now()}`),
      tenantId,
      name,
      calendarDays: isNaN(calendarDays) ? 0 : calendarDays,
      effectiveHarvestDays: isNaN(effectiveHarvestDays) ? 0 : effectiveHarvestDays,
      totalAreaHectares: isNaN(totalAreaHectares) ? 0 : totalAreaHectares,
      renewalTargetPercent: isNaN(plannedRenovationRatePercent) ? 0 : plannedRenovationRatePercent,
      projectedTotalCaneTons: isNaN(targetMillingTons) ? 0 : targetMillingTons,
      dailyHarvestRequirementTons: dailyDemand,
      averageTchCampaign: tchAvg,
      sugarTargetTons: isNaN(targetSugarTons) ? 0 : targetSugarTons,
      status: raw.status || "ACTIVE",
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startDate: raw.startDate || "",
      endDate: raw.endDate || "",
      description: raw.description || "",
      targetMillingTons: isNaN(targetMillingTons) ? 0 : targetMillingTons,
      targetSugarTons: isNaN(targetSugarTons) ? 0 : targetSugarTons,
      plannedRenovationRatePercent: isNaN(plannedRenovationRatePercent) ? 0 : plannedRenovationRatePercent,
      areaUnit: "ha",
      millingUnit: "t",
      sugarUnit: "t",
      dataClassification: "CONFIGURATION",
      dataOrigin: raw.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw.syncStatus || "LOCAL_DRAFT",
      syncError: errors.length > 0 ? errors.map(e => e.rule).join("; ") : undefined,
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 2. FIELD PLOT VALIDATION
   */
  public static validateFieldPlot(
    raw: any,
    context: {
      varietiesCatalog?: CaneVarietyYieldMaster[];
      existingPlots?: FieldPlot[];
    } = {}
  ): AgronomicValidationResult<FieldPlot> {
    return this.validatePlot(raw, context);
  }

  public static validatePlot(
    raw: any,
    context: {
      varietiesCatalog?: CaneVarietyYieldMaster[];
      existingPlots?: FieldPlot[];
    } = {}
  ): AgronomicValidationResult<FieldPlot> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as FieldPlot,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de parcela requerido",
          actionRequired: "Proporcione datos completos de la parcela.",
        }],
        warnings: [],
      };
    }

    const code = String(raw.code || "").trim().toUpperCase();
    if (!code) {
      errors.push({
        field: "code",
        value: raw.code,
        rule: "El código de lote o campo es obligatorio",
        actionRequired: "Ingrese un código de identificación (ej: LOTE-N01).",
      });
    }

    const uebName = String(raw.uebName || "").trim();
    if (!uebName) {
      errors.push({
        field: "uebName",
        value: raw.uebName,
        rule: "La UEB o división agronómica es obligatoria",
        actionRequired: "Asigne la UEB responsable del lote.",
      });
    }

    const areaHectares = Number(raw.areaHectares);
    if (isNaN(areaHectares) || areaHectares <= 0 || areaHectares > 5000) {
      errors.push({
        field: "areaHectares",
        value: raw.areaHectares,
        rule: "El área de la parcela debe estar entre 0.1 y 5000 ha",
        expectedUnit: "ha",
        allowedRange: "0.1 - 5000 ha",
        actionRequired: "Ingrese la superficie física medida en hectáreas.",
      });
    }

    const validStages: CaneGrowthStage[] = [
      "PLANTA",
      "SOCA",
      "RETONO_Q2",
      "RETONO_Q3",
      "RETONO_Q4",
      "RETONO_Q5",
      "RETONO_Q6",
      "RETONO_Q7_PLUS",
      "DEMOLICION",
    ];
    if (!validStages.includes(raw.currentStage)) {
      errors.push({
        field: "currentStage",
        value: raw.currentStage,
        rule: "Etapa de cultivo no válida",
        allowedRange: validStages.join(", "),
        actionRequired: "Seleccione un ciclo fisiológico válido (Planta, Soca, Retoño, etc.).",
      });
    }

    const validSoils: SoilType[] = ["FRANCO", "ARCILLOSO", "ARENOSO"];
    if (!validSoils.includes(raw.soilType)) {
      errors.push({
        field: "soilType",
        value: raw.soilType,
        rule: "Tipo de suelo edafológico no válido",
        allowedRange: "FRANCO, ARCILLOSO, ARENOSO",
        actionRequired: "Seleccione la textura predominante del lote.",
      });
    }

    // Variety Reference Validation
    const varietyCode = String(raw.varietyCode || "").trim().toUpperCase();
    if (!varietyCode) {
      errors.push({
        field: "varietyCode",
        value: raw.varietyCode,
        rule: "El cultivar o variedad es obligatorio",
        actionRequired: "Seleccione una variedad registrada del catálogo.",
      });
    } else if (context.varietiesCatalog && context.varietiesCatalog.length > 0) {
      const match = context.varietiesCatalog.find(
        (v) => v.varietyCode.toUpperCase() === varietyCode
      );
      if (!match) {
        errors.push({
          field: "varietyCode",
          value: varietyCode,
          rule: `La variedad '${varietyCode}' no existe en el catálogo agronómico activo`,
          actionRequired: "Registre previamente la variedad o seleccione una existente.",
        });
      }
    }

    const distanceToMillKm = Number(raw.distanceToMillKm);
    if (isNaN(distanceToMillKm) || distanceToMillKm < 0 || distanceToMillKm > 200) {
      errors.push({
        field: "distanceToMillKm",
        value: raw.distanceToMillKm,
        rule: "La distancia al ingenio debe estar entre 0 y 200 km",
        expectedUnit: "km",
        allowedRange: "0 - 200 km",
        actionRequired: "Ingrese la distancia rodoviaria real hacia la báscula de fábrica.",
      });
    }

    const historicalAverageTch = Number(raw.historicalAverageTch);
    if (isNaN(historicalAverageTch) || historicalAverageTch < 0 || historicalAverageTch > 250) {
      errors.push({
        field: "historicalAverageTch",
        value: raw.historicalAverageTch,
        rule: "El TCH histórico debe estar entre 0 y 250 t/ha",
        expectedUnit: "t/ha",
        allowedRange: "0 - 250 t/ha",
        actionRequired: "Ingrese el historial agronómico ponderado de rendimiento.",
      });
    }

    // Duplicate plot code check
    if (context.existingPlots && context.existingPlots.length > 0) {
      const currentId = raw.id;
      const isDuplicate = context.existingPlots.some(
        (p) => p.id !== currentId && p.code.toUpperCase() === code
      );
      if (isDuplicate) {
        errors.push({
          field: "code",
          value: code,
          rule: `Ya existe una parcela registrada con el código '${code}'`,
          actionRequired: "Asigne un código de lote único.",
        });
      }
    }

    let dataQuality: DataQuality = "COMPLETE";
    if (errors.length > 0) {
      dataQuality = "INCOMPLETE";
    } else if (warnings.length > 0) {
      dataQuality = "UNVERIFIED";
    } else {
      dataQuality = "VALIDATED";
    }

    const normalizedData: FieldPlot = {
      id: String(raw.id || `plot-${Date.now()}`),
      tenantId: String(raw.tenantId || "TENANT_AZUCAR_01"),
      campaignId: raw.campaignId || (context as any)?.campaignId || undefined,
      version: raw.version || "1.0.0",
      code,
      uebName,
      areaHectares: isNaN(areaHectares) ? 0 : areaHectares,
      areaUnit: "ha",
      varietyCode,
      currentStage: raw.currentStage || "PLANTA",
      ratoonAgeYears: Number(raw.ratoonAgeYears) || 0,
      soilType: raw.soilType || "FRANCO",
      distanceToMillKm: isNaN(distanceToMillKm) ? 0 : distanceToMillKm,
      distanceUnit: "km",
      historicalAverageTch: isNaN(historicalAverageTch) ? 0 : historicalAverageTch,
      projectedTch: Number(raw.projectedTch) || 0,
      tchUnit: "t/ha",
      projectedTotalCaneTons: Number(raw.projectedTotalCaneTons) || 0,
      tonsUnit: "t",
      scheduledHarvestMonth: Number(raw.scheduledHarvestMonth) || 1,
      status: raw.status || "REGISTERED",
      agronomicModel: raw.agronomicModel || "BIOAZUCAR_MODEL",
      trace: raw.trace,
      dataClassification: "OPERATIONAL_DATA",
      dataOrigin: raw.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw.syncStatus || "LOCAL_DRAFT",
      syncError: errors.length > 0 ? errors.map(e => e.rule).join("; ") : undefined,
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 3. AGRICULTURAL PARAMETER VALIDATION
   */
  public static validateParameter(
    raw: any,
    existingParams: AgriculturalParameter[] = []
  ): AgronomicValidationResult<AgriculturalParameter> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as AgriculturalParameter,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de parámetro requerido",
          actionRequired: "Proporcione datos completos del parámetro.",
        }],
        warnings: [],
      };
    }

    const key = String(raw.key || "").trim().toUpperCase();
    if (!key) {
      errors.push({
        field: "key",
        value: raw.key,
        rule: "La clave del parámetro es obligatoria (formato KEY_NAME)",
        actionRequired: "Defina una clave única en mayúsculas con guiones bajos.",
      });
    }

    const name = String(raw.name || "").trim();
    if (!name) {
      errors.push({
        field: "name",
        value: raw.name,
        rule: "El nombre descriptivo del parámetro es obligatorio",
        actionRequired: "Ingrese un nombre claro para el parámetro agronómico.",
      });
    }

    if (raw.value === undefined || raw.value === null || raw.value === "") {
      errors.push({
        field: "value",
        value: raw.value,
        rule: "El valor del parámetro no puede estar vacío ni ser nulo",
        actionRequired: "Asigne un valor válido según el tipo de parámetro.",
      });
    }

    const unit = String(raw.unit || "").trim();
    if (!unit) {
      errors.push({
        field: "unit",
        value: raw.unit,
        rule: "La unidad de medida es obligatoria (ej: ha, t, t/ha, %, USD)",
        actionRequired: "Indique la unidad de ingeniería agronómica.",
      });
    }

    const version = String(raw.version || "").trim();
    if (!version || !/^\d+\.\d+(\.\d+)?$/.test(version)) {
      errors.push({
        field: "version",
        value: raw.version,
        rule: "La versión debe seguir formato semántico (ej: 1.0.0)",
        actionRequired: "Especifique versión semántica válida.",
      });
    }

    // Check conflicting active version
    const currentId = raw.id;
    const sameKeyConflict = existingParams.find(
      (p) => p.id !== currentId && p.key === key && (!p.effectiveTo || new Date(p.effectiveTo) > new Date())
    );
    if (sameKeyConflict && !raw.effectiveFrom) {
      warnings.push({
        field: "key",
        value: key,
        rule: `Ya existe una versión activa para la clave '${key}'. Se requerirá archivar la versión previa.`,
        actionRequired: "Confirme la fecha de vigencia para sobreescribir la versión activa.",
      });
    }

    let dataQuality: DataQuality = "COMPLETE";
    if (errors.length > 0) {
      dataQuality = "INCOMPLETE";
    } else if (warnings.length > 0) {
      dataQuality = "UNVERIFIED";
    } else {
      dataQuality = "VALIDATED";
    }

    const normalizedData: AgriculturalParameter = {
      id: String(raw.id || `param-${Date.now()}`),
      tenantId: String(raw.tenantId || "TENANT_AZUCAR_01"),
      category: raw.category || "VARIEDAD",
      name,
      key,
      value: raw.value,
      unit,
      type: raw.type || (typeof raw.value === "number" ? "numeric" : "text"),
      description: raw.description || "",
      version,
      status: raw.status || "CONFIRMADO",
      effectiveFrom: raw.effectiveFrom || new Date().toISOString(),
      effectiveTo: raw.effectiveTo,
      provenanceDoc: raw.provenanceDoc || "Registro Interno BioAzúcar 4.0",
      historicReference: raw.historicReference,
      createdBy: raw.createdBy || "agronomo_master",
      updatedBy: raw.updatedBy || "sistema",
      updatedAt: new Date().toISOString(),
      changeReason: raw.changeReason || "Actualización de parámetro",
      dataClassification: "CONFIGURATION",
      dataOrigin: raw.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw.syncStatus || "LOCAL_DRAFT",
      syncError: errors.length > 0 ? errors.map(e => e.rule).join("; ") : undefined,
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 4. VARIETY VALIDATION
   */
  public static validateVariety(
    raw: any,
    existingVarieties: CaneVarietyYieldMaster[] = []
  ): AgronomicValidationResult<CaneVarietyYieldMaster> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as CaneVarietyYieldMaster,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de variedad requerido",
          actionRequired: "Proporcione datos completos del cultivar.",
        }],
        warnings: [],
      };
    }

    const varietyCode = String(raw.varietyCode || "").trim().toUpperCase();
    if (!varietyCode) {
      errors.push({
        field: "varietyCode",
        value: raw.varietyCode,
        rule: "El código de variedad es obligatorio (ej: RB86-7515)",
        actionRequired: "Asigne el código genético comercial.",
      });
    }

    const name = String(raw.name || "").trim();
    if (!name) {
      errors.push({
        field: "name",
        value: raw.name,
        rule: "El nombre completo del cultivar es obligatorio",
        actionRequired: "Ingrese el nombre de la variedad.",
      });
    }

    const baseYieldTch = Number(raw.baseYieldTch);
    if (isNaN(baseYieldTch) || baseYieldTch < 40 || baseYieldTch > 220) {
      errors.push({
        field: "baseYieldTch",
        value: raw.baseYieldTch,
        rule: "El TCH base en Planta debe estar entre 40 y 220 t/ha",
        expectedUnit: "t/ha",
        allowedRange: "40 - 220 t/ha",
        actionRequired: "Verifique el potencial productivo base del cultivar.",
      });
    }

    const polPercent = Number(raw.polPercent);
    if (isNaN(polPercent) || polPercent < 6 || polPercent > 22) {
      errors.push({
        field: "polPercent",
        value: raw.polPercent,
        rule: "El contenido de Pol % caña debe estar entre 6% y 22%",
        expectedUnit: "%",
        allowedRange: "6 - 22%",
        actionRequired: "Ingrese la sacarosa aparente analizada.",
      });
    }

    const fiberPercent = Number(raw.fiberPercent);
    if (isNaN(fiberPercent) || fiberPercent < 8 || fiberPercent > 22) {
      errors.push({
        field: "fiberPercent",
        value: raw.fiberPercent,
        rule: "El contenido de fibra % caña debe estar entre 8% y 22%",
        expectedUnit: "%",
        allowedRange: "8 - 22%",
        actionRequired: "Ingrese el porcentaje de fibra.",
      });
    }

    const purityPercent = Number(raw.purityPercent);
    if (isNaN(purityPercent) || purityPercent < 60 || purityPercent > 98) {
      errors.push({
        field: "purityPercent",
        value: raw.purityPercent,
        rule: "La pureza del jugo debe estar entre 60% y 98%",
        expectedUnit: "%",
        allowedRange: "60 - 98%",
        actionRequired: "Ingrese la pureza promedio de maduración.",
      });
    }

    // Ratoon decay factors verification
    const decay = raw.ratoonDecayFactors || {};
    if (decay.PLANTA !== undefined && Number(decay.PLANTA) !== 1.0) {
      errors.push({
        field: "ratoonDecayFactors.PLANTA",
        value: decay.PLANTA,
        rule: "El factor de retención para caña Planta debe ser estrictamente 1.00 (referencia)",
        expectedUnit: "ratio",
        allowedRange: "1.00",
        actionRequired: "Ajuste el factor de Planta a 1.00.",
      });
    }

    let dataQuality: DataQuality = "COMPLETE";
    if (errors.length > 0) {
      dataQuality = "INCOMPLETE";
    } else {
      dataQuality = "VALIDATED";
    }

    const normalizedData: CaneVarietyYieldMaster = {
      varietyCode,
      name,
      cycleLengthMonths: Number(raw.cycleLengthMonths) || 12,
      baseYieldTch: isNaN(baseYieldTch) ? 0 : baseYieldTch,
      polPercent: isNaN(polPercent) ? 0 : polPercent,
      fiberPercent: isNaN(fiberPercent) ? 0 : fiberPercent,
      purityPercent: isNaN(purityPercent) ? 0 : purityPercent,
      maturity: raw.maturity || "MEDIA",
      ratoonDecayFactors: {
        PLANTA: 1.0,
        SOCA: Number(decay.SOCA) || 0.90,
        RETONO_Q2: Number(decay.RETONO_Q2) || 0.83,
        RETONO_Q3: Number(decay.RETONO_Q3) || 0.76,
        RETONO_Q4: Number(decay.RETONO_Q4) || 0.70,
        RETONO_Q5: Number(decay.RETONO_Q5) || 0.63,
        RETONO_Q6: Number(decay.RETONO_Q6) || 0.58,
        RETONO_Q7_PLUS: Number(decay.RETONO_Q7_PLUS) || 0.52,
        DEMOLICION: 0.00,
      },
      dataClassification: "MASTER_DATA",
      dataOrigin: raw.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw.syncStatus || "LOCAL_DRAFT",
      syncError: errors.length > 0 ? errors.map(e => e.rule).join("; ") : undefined,
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 5. OPERATION VALIDATION
   */
  public static validateOperation(
    raw: any,
    existingOperations: AgroOperationMaster[] = []
  ): AgronomicValidationResult<AgroOperationMaster> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    const name = String(raw?.name || "").trim();
    if (!name) {
      errors.push({
        field: "name",
        value: raw?.name,
        rule: "El nombre de la labor agrícola es obligatorio",
        actionRequired: "Especifique el nombre de la operación mecanizada.",
      });
    }

    const powerHp = Number(raw?.standardTractorPowerHp);
    if (isNaN(powerHp) || powerHp < 20 || powerHp > 700) {
      errors.push({
        field: "standardTractorPowerHp",
        value: raw?.standardTractorPowerHp,
        rule: "La potencia del tractor debe estar entre 20 y 700 HP",
        expectedUnit: "HP",
        allowedRange: "20 - 700 HP",
        actionRequired: "Ingrese la potencia estándar del equipo tractor.",
      });
    }

    const capacity = Number(raw?.effectiveCapacityHaPerHour);
    if (isNaN(capacity) || capacity <= 0 || capacity > 15) {
      errors.push({
        field: "effectiveCapacityHaPerHour",
        value: raw?.effectiveCapacityHaPerHour,
        rule: "El rendimiento de campo debe ser entre 0.05 y 15 ha/h",
        expectedUnit: "ha/h",
        allowedRange: "0.05 - 15 ha/h",
        actionRequired: "Defina la capacidad operativa en hectáreas por hora.",
      });
    }

    const fuel = Number(raw?.fuelConsumptionLitersPerHour);
    if (isNaN(fuel) || fuel < 0 || fuel > 80) {
      errors.push({
        field: "fuelConsumptionLitersPerHour",
        value: raw?.fuelConsumptionLitersPerHour,
        rule: "El consumo de combustible debe estar entre 0 y 80 L/h",
        expectedUnit: "L/h",
        allowedRange: "0 - 80 L/h",
        actionRequired: "Ingrese el consumo específico de diésel por hora.",
      });
    }

    let dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : "VALIDATED";

    const normalizedData: AgroOperationMaster = {
      id: String(raw?.id || `op-${Date.now()}`),
      tenantId: String(raw?.tenantId || "TENANT_AZUCAR_01"),
      category: raw?.category || "PREPARACION_SUELO",
      name,
      standardTractorPowerHp: isNaN(powerHp) ? 0 : powerHp,
      standardImplement: String(raw?.standardImplement || "Implemento estándar"),
      effectiveCapacityHaPerHour: isNaN(capacity) ? 0 : capacity,
      fuelConsumptionLitersPerHour: isNaN(fuel) ? 0 : fuel,
      targetCycle: raw?.targetCycle || "ALL",
      operatorCount: Number(raw?.operatorCount) || 1,
      status: raw?.status || "ACTIVO",
      description: raw?.description || "",
      dataClassification: "MASTER_DATA",
      dataOrigin: raw?.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw?.syncStatus || "LOCAL_DRAFT",
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 6. EQUIPMENT VALIDATION
   */
  public static validateEquipment(
    raw: any,
    existingEquipment: AgriculturalEquipmentAsset[] = []
  ): AgronomicValidationResult<AgriculturalEquipmentAsset> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    const code = String(raw?.code || "").trim().toUpperCase();
    if (!code) {
      errors.push({
        field: "code",
        value: raw?.code,
        rule: "El código de activo de maquinaria es obligatorio (ej: TR-210-01)",
        actionRequired: "Ingrese el código de ficha del equipo.",
      });
    }

    const name = String(raw?.name || "").trim();
    if (!name) {
      errors.push({
        field: "name",
        value: raw?.name,
        rule: "La denominación del equipo es obligatoria",
        actionRequired: "Ingrese el nombre comercial o denominación de la máquina.",
      });
    }

    const avail = Number(raw?.mechanicalAvailabilityPercent ?? (Number(raw?.mechanicalAvailability) * 100));
    if (isNaN(avail) || avail < 10 || avail > 100) {
      errors.push({
        field: "mechanicalAvailabilityPercent",
        value: avail,
        rule: "La disponibilidad mecánica debe estar entre 10% y 100%",
        expectedUnit: "%",
        allowedRange: "10 - 100%",
        actionRequired: "Ajuste el factor de disponibilidad mecánica esperada.",
      });
    }

    let dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : "VALIDATED";

    const normalizedData: AgriculturalEquipmentAsset = {
      id: String(raw?.id || `eq-${Date.now()}`),
      tenantId: String(raw?.tenantId || "TENANT_AZUCAR_01"),
      code,
      name,
      category: raw?.category || "TRACTOR_PESADO",
      model: raw?.model || "",
      modelYear: Number(raw?.modelYear) || new Date().getFullYear(),
      engineHp: Number(raw?.engineHp ?? raw?.powerHp) || 200,
      powerHp: Number(raw?.powerHp ?? raw?.engineHp) || 200,
      payloadCapacityTons: Number(raw?.payloadCapacityTons) || 0,
      mechanicalAvailability: (isNaN(avail) ? 85 : avail) / 100,
      mechanicalAvailabilityPercent: isNaN(avail) ? 85 : avail,
      hourlyFuelConsumptionLiters: Number(raw?.hourlyFuelConsumptionLiters ?? raw?.fuelConsumptionLitersPerHour) || 0,
      accumulatedHours: Number(raw?.accumulatedHours ?? raw?.accumulatedEngineHours) || 0,
      hourlyOperatingCostUSD: Number(raw?.hourlyOperatingCostUSD) || 0,
      status: raw?.status || "OPERATIONAL",
      description: raw?.description || "",
      updatedAt: new Date().toISOString(),
      dataClassification: "MASTER_DATA",
      dataOrigin: raw?.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw?.syncStatus || "LOCAL_DRAFT",
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 7. INPUT VALIDATION
   */
  public static validateInput(
    raw: any,
    existingInputs: AgriculturalInputMaster[] = []
  ): AgronomicValidationResult<AgriculturalInputMaster> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    const code = String(raw?.code || "").trim().toUpperCase();
    if (!code) {
      errors.push({
        field: "code",
        value: raw?.code,
        rule: "El código de insumo es obligatorio",
        actionRequired: "Asigne un código de catálogo de insumo.",
      });
    }

    const name = String(raw?.name || "").trim();
    if (!name) {
      errors.push({
        field: "name",
        value: raw?.name,
        rule: "El nombre del insumo o agroquímico es obligatorio",
        actionRequired: "Ingrese el nombre comercial o genérico del producto.",
      });
    }

    const standardDosePerHa = Number(raw?.standardDosePerHa);
    if (isNaN(standardDosePerHa) || standardDosePerHa < 0) {
      errors.push({
        field: "standardDosePerHa",
        value: raw?.standardDosePerHa,
        rule: "La dosis agronómica estándar debe ser un valor positivo",
        actionRequired: "Especifique la dosis recomendada por hectárea.",
      });
    }

    const unitCostUSD = Number(raw?.unitCostUSD);
    if (isNaN(unitCostUSD) || unitCostUSD < 0) {
      errors.push({
        field: "unitCostUSD",
        value: raw?.unitCostUSD,
        rule: "El costo unitario en USD debe ser igual o mayor a cero",
        expectedUnit: "USD",
        allowedRange: ">= 0 USD",
        actionRequired: "Ingrese el precio de adquisición por unidad.",
      });
    }

    let dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : "VALIDATED";

    const normalizedData: AgriculturalInputMaster = {
      id: String(raw?.id || `input-${Date.now()}`),
      tenantId: String(raw?.tenantId || "TENANT_AZUCAR_01"),
      code,
      name,
      category: raw?.category || "FERTILIZANTE",
      standardDosePerHa: isNaN(standardDosePerHa) ? 0 : standardDosePerHa,
      unit: raw?.unit || "kg/ha",
      unitCostUSD: isNaN(unitCostUSD) ? 0 : unitCostUSD,
      targetCycle: raw?.targetCycle || "GENERAL",
      status: raw?.status || "ACTIVO",
      description: raw?.description || "",
      supplier: raw?.supplier || "",
      activeIngredient: raw?.activeIngredient || "",
      updatedAt: new Date().toISOString(),
      dataClassification: "MASTER_DATA",
      dataOrigin: raw?.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw?.syncStatus || "LOCAL_DRAFT",
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 8. SCENARIO VALIDATION
   */
  public static validateScenario(
    raw: any,
    existingScenarios: AgriculturalScenario[] = []
  ): AgronomicValidationResult<AgriculturalScenario> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    const name = String(raw?.name || "").trim();
    if (!name) {
      errors.push({
        field: "name",
        value: raw?.name,
        rule: "La denominación del escenario what-if es obligatoria",
        actionRequired: "Asigne un nombre descriptivo al escenario de simulación.",
      });
    }

    const climate = Number(raw?.climateFactor);
    if (isNaN(climate) || climate < 0.5 || climate > 1.5) {
      errors.push({
        field: "climateFactor",
        value: raw?.climateFactor,
        rule: "El factor climático debe estar entre 0.50 (sequía severa) y 1.50 (óptimo)",
        expectedUnit: "ratio",
        allowedRange: "0.50 - 1.50",
        actionRequired: "Ajuste el índice pluviométrico / bioclimático.",
      });
    }

    const diesel = Number(raw?.dieselPriceUSD);
    if (isNaN(diesel) || diesel <= 0 || diesel > 15) {
      errors.push({
        field: "dieselPriceUSD",
        value: raw?.dieselPriceUSD,
        rule: "El precio del diésel debe estar entre 0.10 y 15.00 USD/L",
        expectedUnit: "USD/L",
        allowedRange: "0.10 - 15.00 USD/L",
        actionRequired: "Ingrese el costo proyectado del combustible.",
      });
    }

    let dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : "VALIDATED";

    const normalizedData: AgriculturalScenario = {
      id: String(raw?.id || `scen-${Date.now()}`),
      tenantId: String(raw?.tenantId || "TENANT_AZUCAR_01"),
      campaignId: String(raw?.campaignId || "ZAFRA-ACTIVA"),
      name,
      description: raw?.description || "",
      climateFactor: isNaN(climate) ? 1.0 : climate,
      dieselPriceUSD: isNaN(diesel) ? 1.05 : diesel,
      sugarPriceUSDPerTon: Number(raw?.sugarPriceUSDPerTon) || 450,
      avgTransportDistanceKm: Number(raw?.avgTransportDistanceKm) || 22.5,
      millingCapacityTcd: Number(raw?.millingCapacityTcd) || 7500,
      isBaseline: Boolean(raw?.isBaseline),
      status: raw?.status || "ACTIVO",
      createdAt: raw?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataClassification: "CONFIGURATION",
      dataOrigin: raw?.dataOrigin || "USER_ENTRY",
      dataQuality,
      syncStatus: raw?.syncStatus || "LOCAL_DRAFT",
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 8. PLOT LIFECYCLE STATE MACHINE VALIDATOR
   * Enforces strict operational progression:
   * REGISTERED → VALIDATED → PLANNED → READY_FOR_HARVEST → HARVESTING → HARVESTED → DISPATCHED → RECEIVED → PROCESSED → CLOSED
   * Rejects impossible transitions (e.g., direct jump from REGISTERED to DISPATCHED or CLOSED to HARVESTING).
   */
  public static validatePlotLifecycleTransition(
    currentStatus: FieldPlotStatus,
    targetStatus: FieldPlotStatus
  ): { allowed: boolean; reason?: string } {
    if (currentStatus === targetStatus) {
      return { allowed: true };
    }

    const validTransitions: Partial<Record<FieldPlotStatus, FieldPlotStatus[]>> = {
      REGISTERED: ["VALIDATED", "EN_PREPARACION", "PREPARACION_SUELO", "PLANTADO", "PLANIFICADO"],
      VALIDATED: ["PLANNED", "PLANIFICADO", "EN_PREPARACION", "PREPARACION_SUELO", "PLANTADO", "REGISTERED", "VEGETACION"],
      PLANNED: ["READY_FOR_HARVEST", "EN_PREPARACION", "PREPARACION_SUELO", "VALIDATED", "VEGETACION", "MADURACION", "EN_CORTE"],
      PLANIFICADO: ["PREPARACION_SUELO", "EN_PREPARACION", "VALIDATED", "SIEMBRA", "PLANNED", "VEGETACION", "MADURACION", "READY_FOR_HARVEST"],
      PREPARACION_SUELO: ["SIEMBRA", "PLANTADO", "CRECIMIENTO_VEGETATIVO", "VEGETACION", "VALIDATED", "PLANIFICADO"],
      SIEMBRA: ["CRECIMIENTO_VEGETATIVO", "VEGETACION", "PLANIFICADO"],
      CRECIMIENTO_VEGETATIVO: ["MADURACION", "ESTIMACION_RENDIMIENTO", "PLANIFICADO"],
      ESTIMACION_RENDIMIENTO: ["PROGRAMADO_COSECHA", "READY_FOR_HARVEST", "MADURACION"],
      PROGRAMADO_COSECHA: ["EN_CORTE", "HARVESTING", "READY_FOR_HARVEST"],
      EN_CORTE: ["COSECHADO", "HARVESTED", "SOCA_REBROTE"],
      READY_FOR_HARVEST: ["HARVESTING", "COSECHADO", "HARVESTED", "EN_CORTE", "PLANNED", "MADURACION"],
      HARVESTING: ["HARVESTED", "COSECHADO", "READY_FOR_HARVEST"],
      HARVESTED: ["DISPATCHED", "COSECHADO", "SOCA_REBROTE"],
      COSECHADO: ["DISPATCHED", "SOCA_REBROTE", "PREPARACION_SUELO"],
      SOCA_REBROTE: ["CRECIMIENTO_VEGETATIVO", "VEGETACION", "PREPARACION_SUELO"],
      DISPATCHED: ["RECEIVED", "COSECHADO"],
      RECEIVED: ["PROCESSED"],
      PROCESSED: ["CLOSED"],
      CLOSED: ["REGISTERED", "PLANIFICADO"],
      // Legacy phenological mappings
      VEGETACION: ["MADURACION", "READY_FOR_HARVEST", "PLANNED", "VALIDATED"],
      MADURACION: ["READY_FOR_HARVEST", "HARVESTING", "COSECHADO", "PLANNED"],
      EN_PREPARACION: ["PLANTADO", "VALIDATED", "PLANNED", "PREPARACION_SUELO"],
      PLANTADO: ["VEGETACION", "VALIDATED", "PLANNED", "CRECIMIENTO_VEGETATIVO"],
      CRECIMIENTO: ["VEGETACION", "MADURACION", "PLANNED", "VALIDATED", "CRECIMIENTO_VEGETATIVO"],
    };

    const allowedTargets = validTransitions[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      return {
        allowed: false,
        reason: `Transición de estado prohibida en parcela: no es posible pasar de '${currentStatus}' a '${targetStatus}'. Estados válidos: [${allowedTargets.join(", ")}].`,
      };
    }

    return { allowed: true };
  }

  /**
   * 9. WORK ORDER (CMMS) LIFECYCLE STATE MACHINE VALIDATOR
   * Enforces:
   * DRAFT → PLANNED → APPROVED → ASSIGNED → DISPATCHED → IN_PROGRESS → COMPLETED → VERIFIED → CLOSED
   * Strictly forbids closing orders that were never executed.
   */
  public static validateWorkOrderLifecycleTransition(
    currentStatus: WorkOrderStatus,
    targetStatus: WorkOrderStatus
  ): { allowed: boolean; reason?: string } {
    if (currentStatus === targetStatus) {
      return { allowed: true };
    }

    // Unexecuted statuses can NEVER transition directly to CLOSED
    const unexecutedStatuses: WorkOrderStatus[] = [
      "DRAFT",
      "PLANNED",
      "APPROVED",
      "ASSIGNED",
      "DISPATCHED",
      "PENDIENTE",
    ];

    if (unexecutedStatuses.includes(currentStatus) && targetStatus === "CLOSED") {
      return {
        allowed: false,
        reason: `Violación de gobernanza CMMS: No se puede cerrar la orden de trabajo '${currentStatus}' sin previa ejecución, completado y verificación técnica.`,
      };
    }

    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      DRAFT: ["PLANNED", "CANCELADA"],
      PLANNED: ["APPROVED", "DRAFT", "CANCELADA"],
      APPROVED: ["ASSIGNED", "PLANNED", "CANCELADA"],
      ASSIGNED: ["DISPATCHED", "APPROVED", "CANCELADA"],
      DISPATCHED: ["IN_PROGRESS", "EN_PROCESO", "CANCELADA"],
      IN_PROGRESS: ["COMPLETED", "COMPLETADA", "CANCELADA"],
      COMPLETED: ["VERIFIED", "IN_PROGRESS", "CLOSED"],
      VERIFIED: ["CLOSED"],
      CLOSED: [], // Terminal state
      // Legacy Spanish aliases
      PENDIENTE: ["EN_PROCESO", "ASSIGNED", "CANCELADA"],
      EN_PROCESO: ["COMPLETADA", "COMPLETED", "CANCELADA"],
      COMPLETADA: ["VERIFIED", "CLOSED"],
      CANCELADA: [],
    };

    const allowedTargets = validTransitions[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      return {
        allowed: false,
        reason: `Transición inválida en orden de trabajo: de '${currentStatus}' a '${targetStatus}'. Permitidos: [${allowedTargets.join(", ")}].`,
      };
    }

    return { allowed: true };
  }

  /**
   * 10. HARVEST ORDER VALIDATION
   * Validates scheduled field cutting orders against campaign & plot baselines
   */
  public static validateHarvestOrder(
    raw: any,
    campaign?: AgriculturalCampaign,
    plot?: FieldPlot
  ): AgronomicValidationResult<HarvestOrder> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as HarvestOrder,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de orden de cosecha requerido",
          actionRequired: "Proporcione datos completos de la orden de cosecha.",
        }],
        warnings: [],
      };
    }

    if (campaign && campaign.status && campaign.status !== "ACTIVE") {
      errors.push({
        field: "campaignId",
        value: raw.campaignId,
        rule: `La campaña '${campaign.name}' está en estado '${campaign.status}'. Solo zafras en estado 'ACTIVE' permiten emisión de órdenes de cosecha.`,
        actionRequired: "Active la campaña o seleccione una campaña vigente.",
      });
    }

    const plotId = String(raw.plotId || plot?.id || "").trim();
    if (!plotId) {
      errors.push({
        field: "plotId",
        value: raw.plotId,
        rule: "El identificador de parcela es obligatorio",
        actionRequired: "Vincule la orden a una parcela catastrada.",
      });
    }

    const targetTons = Number(raw.targetHarvestTons ?? plot?.projectedTotalCaneTons);
    if (isNaN(targetTons) || targetTons <= 0) {
      errors.push({
        field: "targetHarvestTons",
        value: targetTons,
        rule: "El tonelaje objetivo de cosecha debe ser un número positivo",
        expectedUnit: "t",
        actionRequired: "Calcule o asigne las toneladas estimadas a cosechar.",
      });
    }

    const scheduledDate = String(raw.scheduledHarvestDate || new Date().toISOString().slice(0, 10)).trim();

    let dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : "VALIDATED";

    const normalizedData: HarvestOrder = {
      id: String(raw.id || `ho-${Date.now()}`),
      tenantId: String(raw.tenantId || campaign?.tenantId || plot?.tenantId || "TENANT_AZUCAR_01"),
      campaignId: String(raw.campaignId || campaign?.id || plot?.campaignId || "CAMPAIGN_CURRENT"),
      plotId,
      plotCode: String(raw.plotCode || plot?.code || "LOTE_DESCONOCIDO"),
      varietyCode: String(raw.varietyCode || plot?.varietyCode || "VARIEDAD_GENERAL"),
      targetHarvestTons: isNaN(targetTons) ? 0 : targetTons,
      scheduledHarvestDate: scheduledDate,
      harvestFrontId: raw.harvestFrontId,
      status: raw.status || "PLANNED",
      dataClassification: "OPERATIONAL_DATA",
      dataOrigin: "CALCULATED",
      dataQuality,
      syncStatus: raw.syncStatus || "LOCAL_DRAFT",
      createdAt: raw.createdAt || new Date().toISOString(),
      version: raw.version || "1.0.0",
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 11. CANE ROAD DISPATCH (CCT) VALIDATION
   * Validates road transport ticket without inventing truck plates, drivers or weights
   */
  public static validateCaneDispatch(
    raw: any
  ): AgronomicValidationResult<CaneDispatch> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as CaneDispatch,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de despacho de caña requerido",
          actionRequired: "Proporcione datos completos de despacho de transporte.",
        }],
        warnings: [],
      };
    }

    const truckPlate = String(raw.truckPlate || "").trim().toUpperCase();
    if (!truckPlate || truckPlate === "PENDING_ASSIGNMENT") {
      warnings.push({
        field: "truckPlate",
        value: raw.truckPlate,
        rule: "Placa de camión no asignada",
        actionRequired: "Asigne una unidad de transporte real registrada.",
      });
    }

    const estimatedNetTons = Number(raw.estimatedNetTons);
    if (isNaN(estimatedNetTons) || estimatedNetTons <= 0 || estimatedNetTons > 120) {
      errors.push({
        field: "estimatedNetTons",
        value: raw.estimatedNetTons,
        rule: "Las toneladas netas estimadas de carga deben estar entre 1 y 120 t",
        expectedUnit: "t",
        allowedRange: "1 - 120 t",
        actionRequired: "Ingrese una carga válida de transporte vial.",
      });
    }

    let dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : warnings.length > 0 ? "UNVERIFIED" : "VALIDATED";

    const normalizedData: CaneDispatch = {
      id: String(raw.id || `disp-${Date.now()}`),
      tenantId: String(raw.tenantId || "TENANT_AZUCAR_01"),
      campaignId: String(raw.campaignId || "CAMPAIGN_CURRENT"),
      plotId: String(raw.plotId || "PLOT_UNKNOWN"),
      harvestOrderId: String(raw.harvestOrderId || "HO_UNKNOWN"),
      harvestEventId: raw.harvestEventId,
      dispatchNumber: String(raw.dispatchNumber || `GUIA-${Date.now().toString().slice(-6)}`),
      truckId: String(raw.truckId || "PENDING_ASSIGNMENT"),
      truckPlate: truckPlate || "PENDING_ASSIGNMENT",
      driverName: raw.driverName ? String(raw.driverName).trim() : undefined,
      origin: String(raw.origin || "CAMPO_ORIGEN"),
      dispatchTimestamp: raw.dispatchTimestamp || new Date().toISOString(),
      estimatedNetTons: isNaN(estimatedNetTons) ? 0 : estimatedNetTons,
      status: raw.status || "DISPATCHED",
      dataClassification: "OPERATIONAL_DATA",
      dataOrigin: "USER_ENTRY",
      dataQuality,
      syncStatus: raw.syncStatus || "LOCAL_DRAFT",
      createdAt: raw.createdAt || new Date().toISOString(),
      version: raw.version || "1.0.0",
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 12. FACTORY WEIGHING & RECEPTION VALIDATION
   * Validates weighbridge scale weights: gross - tare = net
   */
  public static validateFactoryWeighingAndReception(
    raw: any
  ): AgronomicValidationResult<FactoryWeighingAndReception> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as FactoryWeighingAndReception,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de pesaje y recepción de fábrica requerido",
          actionRequired: "Proporcione datos completos de la báscula de ingenio.",
        }],
        warnings: [],
      };
    }

    const gross = Number(raw.grossWeightTons);
    const tare = Number(raw.tareWeightTons);

    if (isNaN(gross) || gross <= 0) {
      errors.push({
        field: "grossWeightTons",
        value: raw.grossWeightTons,
        rule: "El peso bruto debe ser un valor numérico positivo medido en báscula",
        expectedUnit: "t",
        actionRequired: "Realice la pesada de entrada en báscula.",
      });
    }

    if (isNaN(tare) || tare < 0) {
      errors.push({
        field: "tareWeightTons",
        value: raw.tareWeightTons,
        rule: "El peso tara debe ser un valor numérico mayor o igual a cero",
        expectedUnit: "t",
        actionRequired: "Realice la pesada de tara de salida en báscula.",
      });
    }

    if (!isNaN(gross) && !isNaN(tare) && gross <= tare) {
      errors.push({
        field: "netWeightTons",
        value: gross - tare,
        rule: "El peso bruto debe ser estrictamente mayor que el peso tara",
        actionRequired: "Verifique la calibración de la báscula y el pesaje del camión.",
      });
    }

    // Physiological and lab quality validations if lab measurements are provided
    if (raw.labBrix !== undefined) {
      const brixVal = Number(raw.labBrix);
      if (isNaN(brixVal) || brixVal < 8.0 || brixVal > 28.0) {
        errors.push({
          field: "labBrix",
          value: raw.labBrix,
          rule: `Grados Brix (${raw.labBrix}) fuera de límites fisiológicos de caña de azúcar (8.0°Bx - 28.0°Bx)`,
          expectedUnit: "°Bx",
          actionRequired: "Verifique la calibración del refractómetro.",
        });
      }
    }

    if (raw.labPol !== undefined) {
      const polVal = Number(raw.labPol);
      if (isNaN(polVal) || polVal < 5.0 || polVal > 24.0) {
        errors.push({
          field: "labPol",
          value: raw.labPol,
          rule: `Porcentaje de Pol (${raw.labPol}%) fuera de límites fisiológicos de caña de azúcar (5.0% - 24.0%)`,
          expectedUnit: "%",
          actionRequired: "Verifique la lectura polarimétrica.",
        });
      }

      if (raw.labBrix !== undefined && Number(raw.labPol) > Number(raw.labBrix)) {
        errors.push({
          field: "labPol",
          value: raw.labPol,
          rule: `Imposibilidad física/polarimétrica: Pol (${raw.labPol}%) no puede exceder a Brix (${raw.labBrix}°Bx)`,
          expectedUnit: "% <= °Bx",
          actionRequired: "La sacarosa disuelta no puede superar los sólidos solubles totales.",
        });
      }
    }

    if (raw.labFiber !== undefined) {
      const fiberVal = Number(raw.labFiber);
      if (isNaN(fiberVal) || fiberVal < 8.0 || fiberVal > 22.0) {
        errors.push({
          field: "labFiber",
          value: raw.labFiber,
          rule: `Fibra en caña (${raw.labFiber}%) fuera de rango fisiológico (8.0% - 22.0%)`,
          expectedUnit: "%",
          actionRequired: "Verifique el análisis de fibra.",
        });
      }
    }

    if (raw.trashPercent !== undefined) {
      const trashVal = Number(raw.trashPercent);
      if (isNaN(trashVal) || trashVal < 0 || trashVal > 30.0) {
        errors.push({
          field: "trashPercent",
          value: raw.trashPercent,
          rule: `Porcentaje de materia extraña / trash (${raw.trashPercent}%) fuera de límites admisibles (0% - 30%)`,
          expectedUnit: "%",
          actionRequired: "Verifique el muestreo de materia extraña en báscula.",
        });
      }
    }

    const net = !isNaN(gross) && !isNaN(tare) ? Number((gross - tare).toFixed(2)) : 0;

    let dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : "VALIDATED";

    const normalizedData: FactoryWeighingAndReception = {
      id: String(raw.id || `rec-${Date.now()}`),
      tenantId: String(raw.tenantId || "TENANT_AZUCAR_01"),
      campaignId: String(raw.campaignId || "CAMPAIGN_CURRENT"),
      dispatchId: String(raw.dispatchId || "DISP_UNKNOWN"),
      harvestOrderId: String(raw.harvestOrderId || "HO_UNKNOWN"),
      plotId: String(raw.plotId || "PLOT_UNKNOWN"),
      weighingTicketNumber: String(raw.weighingTicketNumber || `TICKET-${Date.now().toString().slice(-6)}`),
      truckPlate: String(raw.truckPlate || "PENDING_ASSIGNMENT").trim().toUpperCase(),
      grossWeightTons: isNaN(gross) ? 0 : gross,
      tareWeightTons: isNaN(tare) ? 0 : tare,
      netWeightTons: net,
      labBrix: raw.labBrix !== undefined ? Number(raw.labBrix) : undefined,
      labPol: raw.labPol !== undefined ? Number(raw.labPol) : undefined,
      labPurity: raw.labPurity !== undefined ? Number(raw.labPurity) : undefined,
      labFiber: raw.labFiber !== undefined ? Number(raw.labFiber) : undefined,
      trashPercent: raw.trashPercent !== undefined ? Number(raw.trashPercent) : undefined,
      weighingTimestamp: raw.weighingTimestamp || new Date().toISOString(),
      scaleOperator: String(raw.scaleOperator || "OPERADOR_BASCULA"),
      weighbridgeId: String(raw.weighbridgeId || "BASCULA_01"),
      status: raw.status || "RECEIVED",
      caneBatchId: raw.caneBatchId,
      dataClassification: "OPERATIONAL_DATA",
      dataOrigin: "SCADA",
      dataQuality,
      syncStatus: raw.syncStatus || "LOCAL_DRAFT",
      createdAt: raw.createdAt || new Date().toISOString(),
      version: raw.version || "1.0.0",
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * 13. CANEBATCH INDUSTRIAL LIFECYCLE STATE MACHINE VALIDATOR
   * Enforces:
   * EN_PATIO → EN_MUESTREO | EN_MOLIENDA | RECHAZADO
   * EN_MUESTREO → EN_PATIO | EN_MOLIENDA | RECHAZADO
   * EN_MOLIENDA → PROCESADO | RECHAZADO
   * PROCESADO → Terminal state (no further transitions)
   * RECHAZADO → Terminal state (no further transitions)
   */
  public static validateCaneBatchLifecycleTransition(
    currentStatus: CaneBatchStatus,
    targetStatus: CaneBatchStatus
  ): { allowed: boolean; reason?: string } {
    if (currentStatus === targetStatus) {
      return { allowed: true };
    }

    if (currentStatus === "PROCESADO" || currentStatus === "RECHAZADO") {
      return {
        allowed: false,
        reason: `Violación de trazabilidad industrial: El lote de caña está en estado terminal '${currentStatus}' y no puede ser modificado a '${targetStatus}'.`,
      };
    }

    const validTransitions: Record<CaneBatchStatus, CaneBatchStatus[]> = {
      RECEPCIONADO: ["EN_BASCULA", "EN_PATIO", "RECHAZADO"],
      EN_BASCULA: ["EN_PATIO", "EN_MUESTREO", "RECHAZADO"],
      EN_PATIO: ["EN_MUESTREO", "EN_MOLIENDA", "RECHAZADO"],
      EN_MUESTREO: ["EN_PATIO", "EN_MOLIENDA", "RECHAZADO"],
      EN_MOLIENDA: ["PROCESADO", "RECHAZADO"],
      PROCESADO: [],
      RECHAZADO: [],
    };

    const allowedTargets = validTransitions[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      return {
        allowed: false,
        reason: `Transición de estado prohibida en lote de caña: no es posible pasar de '${currentStatus}' a '${targetStatus}'. Estados válidos: [${allowedTargets.join(", ")}].`,
      };
    }

    return { allowed: true };
  }

  /**
   * 14. CANE LABORATORY SAMPLE GOVERNANCE VALIDATOR (Iteration 37 — ISA-95 L3/L4 & IEC 62443 SL3)
   * Enforces physiological boundaries of Saccharum officinarum:
   * - Brix: 8.0 - 28.0 °Bx
   * - Pol: 5.0 - 24.0 %
   * - Cardinal Rule: Pol <= Brix (apparent purity <= 100%)
   * - Apparent Purity: 50.0% - 100.0%
   * - Fiber: 8.0% - 22.0%
   * - Reducing Sugars: 0.1% - 5.0%
   * - Trash: 0.0% - 25.0%
   * - Analyst & Signature validation
   * - Computes SHA-256 cryptographic hash for tamper resistance
   */
  public static validateCaneLaboratorySample(
    raw: any,
    options: CaneLabValidationOptions = {}
  ): AgronomicValidationResult<CaneLaboratorySample> {
    const errors: AgronomicValidationError[] = [];
    const warnings: AgronomicValidationError[] = [];

    if (!raw || typeof raw !== "object") {
      return {
        isValid: false,
        dataQuality: "INCOMPLETE",
        normalizedData: raw as CaneLaboratorySample,
        errors: [{
          field: "root",
          value: raw,
          rule: "Objeto de muestra de laboratorio de caña requerido",
          actionRequired: "Proporcione el registro analítico de laboratorio de campo o batey.",
        }],
        warnings: [],
      };
    }

    const sampleId = String(raw.sampleId || raw.id || `lab-sample-${Date.now()}`);
    const sampleCode = String(raw.sampleCode || `LAB-MUESTRA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`);
    const tenantId = String(raw.tenantId || "").trim();
    if (!tenantId) {
      errors.push({
        field: "tenantId",
        value: raw.tenantId,
        rule: "Identificador de tenant obligatorio para aislamiento de gobernanza",
        actionRequired: "Especifique el tenantId del ingenio conforme a IEC 62443.",
      });
    }

    const campaignId = String(raw.campaignId || "CAMPAIGN_CURRENT").trim();
    const plotId = String(raw.plotId || "").trim();
    if (!plotId) {
      errors.push({
        field: "plotId",
        value: raw.plotId,
        rule: "Identificador de parcela (plotId) obligatorio para trazabilidad agronómica",
        actionRequired: "Asocie la muestra al lote o parcela cañera de procedencia.",
      });
    }

    // Analyst validation (IEC 62443 Identity & Accountability)
    const analystId = String(raw.analystId || "").trim();
    const analystName = String(raw.analystName || "").trim();
    if (!analystId) {
      errors.push({
        field: "analystId",
        value: raw.analystId,
        rule: "Identificador de analista de laboratorio obligatorio",
        actionRequired: "Indique la identidad del técnico o químico de laboratorio responsable.",
      });
    }

    const brix = Number(raw.brixDegrees !== undefined ? raw.brixDegrees : raw.labBrix);
    const pol = Number(raw.polPercent !== undefined ? raw.polPercent : raw.labPol);
    const fiber = Number(raw.fiberPercent !== undefined ? raw.fiberPercent : (raw.labFiber ?? 12.5));
    const trash = Number(raw.trashPercent !== undefined ? raw.trashPercent : (raw.trash ?? 5.0));
    const reducingSugars = raw.reducingSugarsPercent !== undefined ? Number(raw.reducingSugarsPercent) : undefined;
    const dextranPpm = raw.dextranPpm !== undefined ? Number(raw.dextranPpm) : undefined;
    const hoursCutToMilling = raw.hoursCutToMilling !== undefined ? Number(raw.hoursCutToMilling) : undefined;

    // Physiological Brix Validation
    if (isNaN(brix)) {
      errors.push({
        field: "brixDegrees",
        value: raw.brixDegrees,
        rule: "Los grados Brix deben ser un valor numérico refractométrico",
        expectedUnit: "°Bx",
        actionRequired: "Registre la lectura refractométrica calibrada a 20°C.",
      });
    } else if (brix < 8.0 || brix > 28.0) {
      errors.push({
        field: "brixDegrees",
        value: brix,
        rule: "Grados Brix fuera de límites fisiológicos de Saccharum officinarum (8.0°Bx - 28.0°Bx)",
        expectedUnit: "°Bx",
        allowedRange: "8.0 - 28.0",
        actionRequired: "Verifique la calibración del refractómetro o posibles diluciones con agua en la muestra.",
      });
    }

    // Physiological Pol Validation
    if (isNaN(pol)) {
      errors.push({
        field: "polPercent",
        value: raw.polPercent,
        rule: "El porcentaje de Pol en jugo/caña debe ser un valor numérico polarimétrico",
        expectedUnit: "%",
        actionRequired: "Registre la lectura polarimétrica de sacarosa aparente.",
      });
    } else if (pol < 5.0 || pol > 24.0) {
      errors.push({
        field: "polPercent",
        value: pol,
        rule: "Porcentaje de Pol fuera de límites fisiológicos de caña de azúcar (5.0% - 24.0%)",
        expectedUnit: "%",
        allowedRange: "5.0 - 24.0",
        actionRequired: "Verifique la clarificación de la muestra (extracto con subacetato de plomo u octapol) y la lectura en tubo polarimétrico.",
      });
    }

    // Cardinal Rule: Pol MUST NOT exceed Brix
    if (!isNaN(brix) && !isNaN(pol)) {
      if (pol > brix) {
        errors.push({
          field: "polPercent",
          value: pol,
          rule: `Imposibilidad física/polarimétrica: El porcentaje de Pol (${pol.toFixed(2)}%) no puede exceder los grados Brix (${brix.toFixed(2)}°Bx), ya que la sacarosa es una fracción de los sólidos solubles totales.`,
          expectedUnit: "% <= °Bx",
          actionRequired: "Reanalice la muestra de jugo. Los sólidos solubles totales (Brix) deben ser siempre superiores a la sacarosa disuelta (Pol).",
        });
      }
    }

    // Fiber Validation
    if (isNaN(fiber)) {
      errors.push({
        field: "fiberPercent",
        value: raw.fiberPercent,
        rule: "El porcentaje de fibra en caña debe ser numérico",
        expectedUnit: "%",
        actionRequired: "Registre el porcentaje de fibra obtenido por secado o desintegración húmeda.",
      });
    } else if (fiber < 8.0 || fiber > 22.0) {
      errors.push({
        field: "fiberPercent",
        value: fiber,
        rule: "Porcentaje de fibra fuera de límites fisiológicos de Saccharum officinarum (8.0% - 22.0%)",
        expectedUnit: "%",
        allowedRange: "8.0 - 22.0",
        actionRequired: "Verifique el método de determinación de fibra en digestor o prensa hidráulica.",
      });
    }

    // Trash Validation
    if (isNaN(trash)) {
      errors.push({
        field: "trashPercent",
        value: raw.trashPercent,
        rule: "El porcentaje de materia extraña (trash) debe ser numérico",
        expectedUnit: "%",
        actionRequired: "Registre el porcentaje de cogollo, hojas secas y tierra determinado en la muestra.",
      });
    } else if (trash < 0.0 || trash > 25.0) {
      errors.push({
        field: "trashPercent",
        value: trash,
        rule: "Porcentaje de materia extraña fuera de límites admisibles (0.0% - 25.0%)",
        expectedUnit: "%",
        allowedRange: "0.0 - 25.0",
        actionRequired: "Si el camión presenta más de 25% de materia extraña, active protocolo de penalización en báscula.",
      });
    }

    // Reducing sugars (if supplied)
    if (reducingSugars !== undefined && !isNaN(reducingSugars)) {
      if (reducingSugars < 0.1 || reducingSugars > 5.0) {
        warnings.push({
          field: "reducingSugarsPercent",
          value: reducingSugars,
          rule: "Azúcares reductores fuera de rango agronómico típico (0.1% - 5.0%)",
          expectedUnit: "%",
          actionRequired: "Un valor elevado de azúcares reductores puede indicar caña inmadura o inversión por tiempo excesivo post-corte.",
        });
      }
    }

    // Dextran (if supplied)
    if (dextranPpm !== undefined && !isNaN(dextranPpm)) {
      if (dextranPpm > 500) {
        warnings.push({
          field: "dextranPpm",
          value: dextranPpm,
          rule: `Nivel crítico de dextrano (${dextranPpm} ppm > 500 ppm límite preventivo)`,
          expectedUnit: "ppm",
          actionRequired: "Alerta de degradación microbiana post-corte (Leuconostoc). Priorice la molienda inmediata para evitar viscosidad en evaporadores.",
        });
      }
    }

    // Apparent Purity Calculation: (Pol / Brix) * 100
    const apparentPurity = (!isNaN(brix) && brix > 0 && !isNaN(pol))
      ? Number(((pol / brix) * 100).toFixed(2))
      : 0;

    if (apparentPurity > 100.0) {
      errors.push({
        field: "apparentPurity",
        value: apparentPurity,
        rule: "La pureza aparente de jugo de caña no puede superar el 100%",
        expectedUnit: "%",
        actionRequired: "Corrija los valores de Pol o Brix medidos en laboratorio.",
      });
    } else if (apparentPurity > 0 && apparentPurity < 50.0) {
      warnings.push({
        field: "apparentPurity",
        value: apparentPurity,
        rule: `Pureza aparente anormalmente baja (${apparentPurity}% < 50%). Indicativo de caña severamente deteriorada o helada.`,
        expectedUnit: "%",
        actionRequired: "Verifique el estado sanitario de la caña y consulte con jefatura de fábrica.",
      });
    }

    // Commercial Sugar Yield Calculation (Estimated Recoverable Sugar / SJM / Hugot simplified)
    const commercialSugarYieldEstimated = (!isNaN(pol) && !isNaN(apparentPurity) && !isNaN(fiber) && apparentPurity > 0)
      ? AgronomicValidationService.computeCommercialSugarYield(pol, apparentPurity, fiber, trash)
      : 0;

    // Signature verification if required
    const analystSignature = String(raw.analystSignature || "").trim();
    if (options.requireAnalystSignature && !analystSignature) {
      errors.push({
        field: "analystSignature",
        value: raw.analystSignature,
        rule: "Firma digital o sello criptográfico del analista requerida para aprobación de laboratorio",
        actionRequired: "Firme la muestra con las credenciales criptográficas del analista responsable.",
      });
    }

    const timestamp = raw.samplingDateTime || raw.createdAt || new Date().toISOString();
    const dataQuality: DataQuality = errors.length > 0 ? "INCOMPLETE" : "VALIDATED";
    const validationStatus = errors.length === 0 ? "APPROVED" : "REJECTED";

    // Build canonical object before hash computation
    const partialSample: Omit<CaneLaboratorySample, "cryptographicHash"> = {
      sampleId,
      sampleCode,
      tenantId: tenantId || "TENANT_AZUCAR_01",
      campaignId,
      plotId,
      varietyCode: raw.varietyCode,
      growthStage: raw.growthStage,
      weighingTicketNumber: raw.weighingTicketNumber,
      receptionId: raw.receptionId,
      dispatchId: raw.dispatchId,
      caneBatchId: raw.caneBatchId,
      samplingStage: raw.samplingStage || "CORE_SAMPLER_BATEY",
      samplingDateTime: timestamp,
      analystId: analystId || "ANALYST_UNASSIGNED",
      analystName: analystName || "Analista de Laboratorio",
      laboratoryId: String(raw.laboratoryId || "LAB_CENTRAL_01"),
      brixDegrees: isNaN(brix) ? 0 : brix,
      polPercent: isNaN(pol) ? 0 : pol,
      apparentPurity,
      fiberPercent: isNaN(fiber) ? 0 : fiber,
      reducingSugarsPercent: reducingSugars,
      trashPercent: isNaN(trash) ? 0 : trash,
      dextranPpm,
      hoursCutToMilling,
      commercialSugarYieldEstimated,
      lineageHash: raw.lineageHash,
      analystSignature: analystSignature || `SIG-ANALYST-${analystId || "UNKNOWN"}-${Date.now()}`,
      validationStatus,
      rejectionReason: errors.length > 0 ? errors.map(e => e.rule).join("; ") : undefined,
      dataClassification: "OBSERVED_DATA",
      dataOrigin: "LIMS",
      dataQuality,
      createdAt: timestamp,
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
    };

    const cryptographicHash = AgronomicValidationService.generateCaneSampleHash(partialSample);
    const normalizedData: CaneLaboratorySample = {
      ...partialSample,
      cryptographicHash,
    };

    return {
      isValid: errors.length === 0,
      dataQuality,
      normalizedData,
      errors,
      warnings,
    };
  }

  /**
   * Computes apparent purity percentage: (Pol / Brix) * 100
   */
  public static computeSugarcanePurity(polPercent: number, brixDegrees: number): number {
    if (brixDegrees <= 0) return 0;
    return Number(((polPercent / brixDegrees) * 100).toFixed(2));
  }

  /**
   * Computes Estimated Commercial Sugar Yield (Rendimiento Industrial Probable %):
   * Spencer-Meade / Hugot standard formula:
   * Rendimiento (%) = [Pol × (1.4 - 40 / Pureza)] × (1 - Fibra/100) × (1 - Trash/100)
   */
  public static computeCommercialSugarYield(
    polPercent: number,
    purityPercent: number,
    fiberPercent: number,
    trashPercent: number = 0
  ): number {
    if (polPercent <= 0 || purityPercent <= 40 || fiberPercent <= 0) return 0;
    const factorSJM = 1.4 - (40 / purityPercent);
    const extractionFactor = 1 - (fiberPercent / 100);
    const cleanCaneFactor = 1 - (Math.min(trashPercent, 30) / 100);
    const yieldValue = polPercent * factorSJM * extractionFactor * cleanCaneFactor;
    return Number(Math.max(0, yieldValue).toFixed(2));
  }

  /**
   * 15. BATEY WEIGHBRIDGE RECONCILIATION & DISCREPANCY DETECTOR
   * Compares estimated field yield vs weighed scale net weight:
   * Emits warnings if deviation exceeds tolerance (default ±20%).
   */
  public static validateBateyWeighbridgeReconciliation(params: {
    estimatedFieldTons: number;
    grossWeightTons: number;
    tareWeightTons: number;
    ticketNumber: string;
    plotCode: string;
    varietyCode: string;
    tenantId: string;
    tolerancePercent?: number;
  }): BateyWeighbridgeReconciliation {
    const tolerance = params.tolerancePercent ?? 20.0;
    const netWeightTons = Number((params.grossWeightTons - params.tareWeightTons).toFixed(2));
    const varianceTons = Number((netWeightTons - params.estimatedFieldTons).toFixed(2));
    const variancePercent = params.estimatedFieldTons > 0
      ? Number(((varianceTons / params.estimatedFieldTons) * 100).toFixed(2))
      : 0;

    const toleranceExceeded = Math.abs(variancePercent) > tolerance;
    let status: "NORMAL" | "WARNING_DESVIACION" | "RECHAZO_BASCULA" = "NORMAL";
    if (netWeightTons <= 0 || params.grossWeightTons <= params.tareWeightTons) {
      status = "RECHAZO_BASCULA";
    } else if (toleranceExceeded) {
      status = "WARNING_DESVIACION";
    }

    return {
      ticketNumber: params.ticketNumber,
      plotCode: params.plotCode,
      varietyCode: params.varietyCode,
      tenantId: params.tenantId,
      estimatedFieldTons: params.estimatedFieldTons,
      grossWeightTons: params.grossWeightTons,
      tareWeightTons: params.tareWeightTons,
      netWeightTons,
      varianceTons,
      variancePercent,
      toleranceExceeded,
      status,
      reconciliationTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Deterministic SHA-256 hash generator for Cane Laboratory Samples
   */
  public static generateCaneSampleHash(
    payload: Omit<CaneLaboratorySample, "cryptographicHash"> | CaneLaboratorySample
  ): string {
    const preimage = [
      payload.sampleCode,
      payload.tenantId,
      payload.campaignId,
      payload.plotId,
      payload.samplingStage,
      payload.samplingDateTime,
      Number(payload.brixDegrees).toFixed(2),
      Number(payload.polPercent).toFixed(2),
      Number(payload.apparentPurity).toFixed(2),
      Number(payload.fiberPercent).toFixed(2),
      Number(payload.trashPercent).toFixed(2),
      payload.analystId,
    ].join("|");

    return createHash("sha256").update(preimage).digest("hex");
  }

  /**
   * Verifies the tamper-proof cryptographic integrity of a Cane Laboratory Sample
   */
  public static verifyCaneSampleIntegrity(sample: CaneLaboratorySample): {
    isValid: boolean;
    computedHash: string;
    matchesRecorded: boolean;
    reason?: string;
  } {
    if (!sample || !sample.cryptographicHash) {
      return {
        isValid: false,
        computedHash: "",
        matchesRecorded: false,
        reason: "Muestra de laboratorio sin sello criptográfico SHA-256.",
      };
    }

    const computedHash = AgronomicValidationService.generateCaneSampleHash(sample);
    const matchesRecorded = computedHash === sample.cryptographicHash;

    return {
      isValid: matchesRecorded,
      computedHash,
      matchesRecorded,
      reason: matchesRecorded
        ? undefined
        : `Violación de integridad de datos agronómicos: El hash SHA-256 calculado (${computedHash.slice(0, 12)}...) no coincide con el sello registrado (${sample.cryptographicHash.slice(0, 12)}...). Registro presuntamente alterado.`,
    };
  }
}

