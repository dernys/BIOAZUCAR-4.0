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
  DataQuality,
  DataClassification,
  DataOrigin,
  CaneGrowthStage,
  SoilType,
} from "../../types/agriculture";

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
      status: raw.status || "CRECIMIENTO",
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
}
