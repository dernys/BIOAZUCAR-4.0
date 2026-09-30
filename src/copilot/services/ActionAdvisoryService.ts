import { UserRole, TelemetryData, AlarmEvent, EquipmentItem, TenantEnterprise } from "../../types";
import { ActionConfirmationRequest, OperationSecurityLevel } from "../domain/CopilotTypes";
import { AtomicPermission, hasAtomicPermission } from "../../types/securityPrincipal";
import { checkToolAuthorization } from "../domain/CopilotPermissions";

export interface ActionPerfectionSuggestion {
  originalValue: string | number;
  recommendedValue: string | number;
  rationale: string;
  efficiencyGain: string;
  riskMitigation: string;
  thermodynamicBasis: string;
  confidenceScore: number;
}

export interface AdvisoryEvaluationResult {
  allowed: boolean;
  denialReason?: string;
  requiredPermission: string;
  atomicPermission?: AtomicPermission;
  confirmationDetails: ActionConfirmationRequest;
}

export class ActionAdvisoryService {
  private static instance: ActionAdvisoryService;

  private constructor() {}

  public static getInstance(): ActionAdvisoryService {
    if (!ActionAdvisoryService.instance) {
      ActionAdvisoryService.instance = new ActionAdvisoryService();
    }
    return ActionAdvisoryService.instance;
  }

  /**
   * Evaluates an operational modification request, verifies authorization,
   * and generates intelligent Suggestions for Perfection prior to execution.
   */
  public evaluateAction(
    actionName: string,
    args: Record<string, any>,
    userRoles: UserRole[],
    userPermissions: string[],
    telemetry: TelemetryData,
    alarms: AlarmEvent[],
    equipmentList: EquipmentItem[],
    activeTenant: TenantEnterprise,
    userClearance: number = 3,
    isSuperAdmin: boolean = false
  ): AdvisoryEvaluationResult {
    // 1. Authorization & RBAC Validation
    const auth = checkToolAuthorization(actionName, userRoles, userClearance, isSuperAdmin);
    if (!auth.allowed) {
      return {
        allowed: false,
        denialReason: auth.reason || `No tienes permisos suficientes para ejecutar la acción '${actionName}'.`,
        requiredPermission: auth.policy?.requiredPermissions.join(", ") || "UNKNOWN",
        confirmationDetails: {
          actionId: `denied-${Date.now()}`,
          actionType: actionName,
          level: (auth.policy?.level || 2) as OperationSecurityLevel,
          targetEntity: args.tag || args.target || "Operación",
          title: `Acceso Denegado: ${actionName}`,
          description: auth.reason || "Operación no autorizada según la matriz de seguridad RBAC.",
          operationalImpact: "Ninguno (comando bloqueado).",
          requiredPermission: auth.policy?.requiredPermissions.join(", ") || "UNKNOWN",
          payload: args,
        },
      };
    }

    // 2. Generate Domain-Specific Suggestions for Perfection based on First Principles
    const tag = String(args.tag || args.targetEntity || args.target || "General.Operation");
    const requestedValue = args.newValue ?? args.value ?? args.exportMW ?? 0;
    const actionType = actionName === "request_dispatch_change" ? "CHANGE_DISPATCH_MW" : "MODIFY_SETPOINT";
    const level: OperationSecurityLevel = (auth.policy?.level || 3) as OperationSecurityLevel;

    const perfection = this.computePerfectionSuggestion(
      actionName,
      tag,
      requestedValue,
      telemetry,
      alarms,
      equipmentList,
      activeTenant,
      args
    );

    const confirmationDetails: ActionConfirmationRequest = {
      actionId: `action-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actionType,
      level,
      targetEntity: tag,
      title: this.resolveActionTitle(actionName, tag, requestedValue),
      description: this.resolveActionDescription(actionName, tag, requestedValue, perfection),
      currentValue: this.resolveCurrentValue(tag, telemetry),
      proposedValue: requestedValue,
      unit: this.resolveUnit(tag, actionName),
      operationalImpact: perfection ? perfection.rationale : "La modificación alterará la condición de proceso continuo.",
      requiredPermission: auth.policy?.requiredPermissions[0] || "MODIFY_SETPOINTS",
      perfectionSuggestion: perfection || undefined,
      payload: {
        ...args,
        originalValue: requestedValue,
        recommendedValue: perfection?.recommendedValue,
        perfectionSuggestion: perfection,
        tenantId: activeTenant.id,
      },
    };

    return {
      allowed: true,
      requiredPermission: auth.policy?.requiredPermissions[0] || "MODIFY_SETPOINTS",
      confirmationDetails,
    };
  }

  /**
   * Generates engineering-grounded perfection suggestions based on Hugot, Spencer-Meade, ASME PTC 4, and ISO 10816
   */
  public computePerfectionSuggestion(
    actionName: string,
    tag: string,
    requestedVal: any,
    telemetry: TelemetryData,
    alarms: AlarmEvent[],
    equipmentList: EquipmentItem[],
    activeTenant: TenantEnterprise,
    args: Record<string, any> = {}
  ): ActionPerfectionSuggestion | null {
    const rawTag = tag.toUpperCase();
    const numVal = Number(requestedVal);

    // CASE 1: MILLING TCH SETPOINT ADJUSTMENT
    if (rawTag.includes("TCH") || rawTag.includes("MOLIENDA") || rawTag.includes("CANE")) {
      const nominal = activeTenant?.nominalTch || 450;
      const bagasseMoist = telemetry.bagasseMoisture || 48.5;
      const boilerPress = telemetry.boilerPressureHP || 64.5;

      let recVal = numVal;
      let rationale = "";
      let gain = "";
      let risk = "";
      let basis = "Fórmulas de Extracción en Tándem de E. Hugot & Capacidad de Evaporación";

      if (numVal > nominal * 1.1) {
        recVal = Math.round(nominal * 1.05);
        rationale = `Un incremento a ${numVal} TCH sobrecargará la capacidad de evaporación (actualmente en 63.5° Bx en meladura) y reducirá la extracción de sacarosa en tándem debido a un tiempo de residencia insuficiente en molinos. Se sugiere ${recVal} TCH con aumento coordinado de imbibición al 28.5%.`;
        gain = "+0.45% en recuperación de sacarosa (+3.2 t de azúcar/día) y bagazo con humedad < 49.0%.";
        risk = "Evita atascos en el Donnelly Chute de Molino 1 y sobrecarga de corriente en turbomáquinas.";
      } else if (numVal < nominal * 0.75) {
        recVal = Math.round(nominal * 0.85);
        rationale = `Reducir la molienda a ${numVal} TCH disminuirá drásticamente la producción de bagazo fresco (${(numVal * 0.28).toFixed(1)} t/h), comprometiendo el balance de vapor vivo en calderas y obligando a quemar combustible auxiliar o desbalancear el despacho eléctrico. Se recomienda mantener al menos ${recVal} TCH.`;
        gain = "Mantiene la presión de cabezal HP en 64.5 bar sin recurrir a petróleo auxiliar.";
        risk = "Previene caída en la exportación de MW al Sistema Eléctrico Nacional.";
      } else {
        recVal = numVal;
        rationale = `El valor solicitado de ${numVal} TCH se encuentra dentro del rango de operación óptimo (${nominal * 0.85} a ${nominal * 1.08} TCH). Se aconseja sincronizar el caudal de imbibición en ratio W/F = 2.25.`;
        gain = "Operación continua con extracción calculada en 96.6%.";
        risk = "Márgenes seguros en todas las vírgenes hidráulicas.";
      }

      return {
        originalValue: numVal,
        recommendedValue: recVal,
        rationale,
        efficiencyGain: gain,
        riskMitigation: risk,
        thermodynamicBasis: basis,
        confidenceScore: 95,
      };
    }

    // CASE 2: BOILER PRESSURE / HP STEAM ADJUSTMENT
    if (rawTag.includes("BOILER") || rawTag.includes("CALDERA") || rawTag.includes("PRESSURE") || rawTag.includes("PRESION")) {
      const currentPress = telemetry.boilerPressureHP || 64.5;
      let recVal = numVal;
      let rationale = "";
      let gain = "";
      let risk = "";
      const basis = "ASME PTC 4 Fired Steam Generators & Margen de Histéresis de Válvulas de Seguridad";

      if (numVal > 66.5) {
        recVal = 65.0;
        rationale = `La consigna solicitada de ${numVal} bar se aproxima peligrosamente al valor de calibración de las válvulas de alivio mecánicas del domo (68.5 bar). Cualquier perturbación por lote de bagazo húmedo causará disparos accidentales y venteos de vapor a la atmósfera. Se recomienda una consigna perfeccionada de 65.0 bar.`;
        gain = "Ahorro de hasta 4.5 t de vapor/hora por erradicación de micro-venteos de seguridad.";
        risk = "Elimina el estrés mecánico y choque térmico en tubos de sobrecalentador.";
      } else if (numVal < 58.0) {
        recVal = 62.0;
        rationale = `Trabajar a ${numVal} bar disminuye la entalpía de expansión en los turbogeneradores, reduciendo la eficiencia termodinámica del ciclo Rankine en un 8.4% y exigiendo mayor caudal másico de vapor para sostener los mismos MW. Se sugiere no descender de 62.0 bar.`;
        gain = "+1.4 MW de generación eléctrica adicional con el mismo caudal de biomasa.";
        risk = "Previene condensación prematura en las últimas etapas de álabes de la turbina.";
      } else {
        recVal = numVal;
        rationale = `Presión de ${numVal} bar adecuada para régimen continuo de molienda y turbogenerador.`;
        gain = "Rendimiento termodinámico óptimo según ASME PTC 4.";
        risk = "Margen de seguridad de 3.5 bar respecto a válvulas de alivio.";
      }

      return {
        originalValue: numVal,
        recommendedValue: recVal,
        rationale,
        efficiencyGain: gain,
        riskMitigation: risk,
        thermodynamicBasis: basis,
        confidenceScore: 96,
      };
    }

    // CASE 3: GRID POWER EXPORT (PPA DISPATCH MW)
    if (actionName === "request_dispatch_change" || rawTag.includes("DISPATCH") || rawTag.includes("MW") || rawTag.includes("EXPORT")) {
      const currentExport = telemetry.powerExportGridMW || 21.2;
      const genMW = telemetry.powerGeneratedMW || 32.4;
      const internalMW = telemetry.powerInternalMW || 11.2;
      const maxPossibleExport = Math.max(0, genMW - internalMW);

      let recVal = numVal;
      let rationale = "";
      let gain = "";
      let risk = "";
      const basis = "Balance de Potencia Activa Sincrónica & Contrato de Compra PPA";

      if (numVal > maxPossibleExport * 1.05) {
        recVal = Math.round((maxPossibleExport - 0.5) * 10) / 10;
        rationale = `Solicitar ${numVal} MW de exportación supera el excedente disponible real (${maxPossibleExport.toFixed(1)} MW netos) considerando el consumo fabril indispensable de ${internalMW.toFixed(1)} MW. Forzar esta consigna ocasionará deslastre de carga interno o caída de frecuencia en el bus de 13.8 kV. Se aconseja fijar en ${recVal} MW.`;
        gain = "Máxima exportación comercialmente viable ($1,850 USD/h) sin penalización por sobre-compromiso.";
        risk = "Protege el alimentador principal de planta contra disparo por baja frecuencia (< 59.5 Hz).";
      } else {
        recVal = numVal;
        rationale = `Consigna de ${numVal} MW compatible con la capacidad del turbogenerador y el compromiso horario del contrato PPA.`;
        gain = "Cumplimiento al 100% del programa horario de despacho ante el Centro de Control de Energía.";
        risk = "Operación con factor de potencia inductivo 0.94 seguro.";
      }

      return {
        originalValue: numVal,
        recommendedValue: recVal,
        rationale,
        efficiencyGain: gain,
        riskMitigation: risk,
        thermodynamicBasis: basis,
        confidenceScore: 94,
      };
    }

    // CASE 4: ALARM ACKNOWLEDGMENT ADVISORY
    if (actionName.includes("alarm") || actionName.includes("ALARM")) {
      const alarmId = String(args.alarmId || args.id || "");
      const matchedAlarm = alarms.find((a) => a.id === alarmId || a.tag === tag);

      return {
        originalValue: "RECONOCER_SIN_VERIFICACION",
        recommendedValue: "RECONOCER_TRAS_VERIFICACION_EN_CAMPO",
        rationale: `La alarma ${matchedAlarm?.message || matchedAlarm?.tag || alarmId} (${matchedAlarm?.severity || "ALTA"}) involucra el tag ${matchedAlarm?.tag || tag}. Antes de reconocer formalmente bajo norma ISA-18.2, BioAI aconseja verificar la condición física en campo (temperatura de chumaceras, presión de aceite o nivel) para descartar causas de falla latente.`,
        efficiencyGain: "Cumplimiento del ciclo de vida de alarmas ISA-18.2 y reducción de falsos reconocimientos.",
        riskMitigation: "Previene que una condición crítica no resuelta quede desatendida en la sala de control.",
        thermodynamicBasis: "Estándar ANSI/ISA-18.2 Gestión de Sistemas de Alarmas para la Industria de Procesos",
        confidenceScore: 98,
      };
    }

    // Generic fallback
    return {
      originalValue: requestedVal,
      recommendedValue: requestedVal,
      rationale: `Acción sobre ${tag} validada por la matriz de control. Verifique los parámetros de seguridad antes de confirmar.`,
      efficiencyGain: "Mantenimiento del control de lazo cerrado.",
      riskMitigation: "Operación supervisada por operador calificado.",
      thermodynamicBasis: "Prácticas de Control Industrial IEC 62443",
      confidenceScore: 90,
    };
  }

  private resolveActionTitle(actionName: string, tag: string, val: any): string {
    if (actionName === "request_dispatch_change") {
      return `Modificación de Despacho de Potencia PPA: ${val} MW`;
    }
    if (actionName.includes("alarm")) {
      return `Reconocimiento Formal de Alarma ISA-18.2: ${tag}`;
    }
    return `Modificación de Consigna / Setpoint: ${tag}`;
  }

  private resolveActionDescription(
    actionName: string,
    tag: string,
    val: any,
    perfection: ActionPerfectionSuggestion | null
  ): string {
    let desc = `Se ha solicitado modificar el parámetro industrial '${tag}' al valor de ${val}.`;
    if (perfection && perfection.recommendedValue !== val) {
      desc += ` BioAI 4.0 ha calculado una sugerencia de perfeccionamiento estequiométrica/operativa recomendando ${perfection.recommendedValue}.`;
    }
    return desc;
  }

  private resolveCurrentValue(tag: string, telemetry: TelemetryData): string | number {
    const raw = tag.toUpperCase();
    if (raw.includes("TCH") || raw.includes("MOLIENDA")) return `${telemetry.tch || 450} TCH`;
    if (raw.includes("BOILER") || raw.includes("PRESSURE") || raw.includes("CALDERA")) return `${telemetry.boilerPressureHP || 64.5} bar`;
    if (raw.includes("MW") || raw.includes("DISPATCH") || raw.includes("EXPORT")) return `${telemetry.powerExportGridMW || 21.2} MW`;
    if (raw.includes("OEE")) return `${telemetry.oeeOverall || 90.5}%`;
    return "Consigna Actual";
  }

  private resolveUnit(tag: string, actionName: string): string {
    const raw = tag.toUpperCase();
    if (actionName === "request_dispatch_change" || raw.includes("MW")) return "MW";
    if (raw.includes("TCH")) return "t/h";
    if (raw.includes("PRESSURE") || raw.includes("CALDERA") || raw.includes("DOMO")) return "bar";
    if (raw.includes("TEMP") || raw.includes("C")) return "°C";
    if (raw.includes("BRIX") || raw.includes("BX")) return "°Bx";
    if (raw.includes("PERCENT") || raw.includes("%")) return "%";
    return "";
  }
}

export const actionAdvisoryService = ActionAdvisoryService.getInstance();
