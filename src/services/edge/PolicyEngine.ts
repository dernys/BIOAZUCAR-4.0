import {
  OperationalPermission,
  UserRole,
  NetworkZoneType,
  IEC62443SecurityLevel,
} from "../../types";

export interface PolicyCheckRequest {
  actor: {
    userId: string;
    userName: string;
    role: UserRole;
    operationalPermissions: OperationalPermission[];
    isAiAgent?: boolean;
    tenantId: string;
  };
  target: {
    tenantId: string;
    siteId?: string;
    areaId: string;
    assetId: string;
    tag: string;
    targetZone?: NetworkZoneType;
    requiredLevel?: IEC62443SecurityLevel;
    accessMode: "READ" | "READ_WRITE" | "CONTROL";
    engMin?: number;
    engMax?: number;
  };
  operation: {
    actionType: "READ_TELEMETRY" | "ACKNOWLEDGE_ALARM" | "CHANGE_SETPOINT" | "EMERGENCY_STOP" | "ADMIN_RECONFIG";
    requestedValue?: number | string | boolean;
    currentValue?: number | string | boolean;
  };
}

export interface PolicyCheckResponse {
  allowed: boolean;
  reason?: string;
  violationCode?:
    | "TENANT_MISMATCH"
    | "AI_UNAUTHORIZED_MUTATION"
    | "INSUFFICIENT_OPERATIONAL_PERMISSION"
    | "TAG_IS_READ_ONLY"
    | "OUT_OF_ENGINEERING_RANGE"
    | "RATE_OF_CHANGE_EXCEEDED"
    | "ZONE_CONDUIT_BLOCKED";
  requiredPermission?: OperationalPermission;
  zoneAllowed: boolean;
}

export class PolicyEngine {
  private static instance: PolicyEngine;

  public static getInstance(): PolicyEngine {
    if (!PolicyEngine.instance) {
      PolicyEngine.instance = new PolicyEngine();
    }
    return PolicyEngine.instance;
  }

  /**
   * Evaluates an operational request against IEC 62443 principles and multi-tenant isolation.
   */
  public evaluate(request: PolicyCheckRequest): PolicyCheckResponse {
    const { actor, target, operation } = request;

    // 1. RULE: Multi-tenant isolation (strict tenant match unless superadmin with cross-tenant context)
    if (
      actor.tenantId !== "GLOBAL" &&
      target.tenantId &&
      actor.tenantId !== target.tenantId
    ) {
      return {
        allowed: false,
        reason: `Violación de aislamiento multitenant: El usuario pertenece a [${actor.tenantId}] y no puede interactuar con activos de [${target.tenantId}].`,
        violationCode: "TENANT_MISMATCH",
        zoneAllowed: false,
      };
    }

    // 2. RULE: AI Safety — "Una IA nunca puede concederse permisos ni escribir directamente a OT"
    if (actor.isAiAgent) {
      if (
        operation.actionType === "CHANGE_SETPOINT" ||
        operation.actionType === "EMERGENCY_STOP" ||
        operation.actionType === "ADMIN_RECONFIG"
      ) {
        return {
          allowed: false,
          reason: "Principio de Ciberseguridad Industrial: BioAzúcar Copilot no puede ejecutar mutaciones directas en controladores físicos sin la debida delegación, confirmación explícita y credenciales de un operador humano calificado.",
          violationCode: "AI_UNAUTHORIZED_MUTATION",
          zoneAllowed: false,
        };
      }
    }

    // 3. RULE: Tag / Asset Access Mode check
    if (
      (operation.actionType === "CHANGE_SETPOINT" || operation.actionType === "EMERGENCY_STOP") &&
      target.accessMode === "READ"
    ) {
      return {
        allowed: false,
        reason: `El tag o equipo [${target.tag}] está configurado en modo solo lectura (READ). No se admiten comandos ni consignas de control remoto.`,
        violationCode: "TAG_IS_READ_ONLY",
        zoneAllowed: true,
      };
    }

    // 4. RULE: Operational Permissions mapping
    let requiredPerm: OperationalPermission = "READ";
    switch (operation.actionType) {
      case "READ_TELEMETRY":
        requiredPerm = "READ";
        break;
      case "ACKNOWLEDGE_ALARM":
        requiredPerm = "ACKNOWLEDGE";
        break;
      case "CHANGE_SETPOINT":
        requiredPerm = "OPERATE";
        break;
      case "EMERGENCY_STOP":
        requiredPerm = "CONTROL";
        break;
      case "ADMIN_RECONFIG":
        requiredPerm = "ADMIN";
        break;
    }

    const hasPermission =
      actor.operationalPermissions.includes(requiredPerm) ||
      actor.operationalPermissions.includes("ADMIN") ||
      (requiredPerm === "OPERATE" && actor.operationalPermissions.includes("CONTROL"));

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `Permiso operacional insuficiente. La acción requiere [${requiredPerm}], pero el operador cuenta únicamente con [${actor.operationalPermissions.join(", ")}].`,
        violationCode: "INSUFFICIENT_OPERATIONAL_PERMISSION",
        requiredPermission: requiredPerm,
        zoneAllowed: true,
      };
    }

    // 5. RULE: Engineering Limits Validation (if numeric value is requested)
    if (
      operation.actionType === "CHANGE_SETPOINT" &&
      typeof operation.requestedValue === "number"
    ) {
      const val = operation.requestedValue;
      if (target.engMin !== undefined && val < target.engMin) {
        return {
          allowed: false,
          reason: `Valor de consigna fuera de rango: ${val} es menor al límite de ingeniería inferior (${target.engMin}).`,
          violationCode: "OUT_OF_ENGINEERING_RANGE",
          zoneAllowed: true,
        };
      }
      if (target.engMax !== undefined && val > target.engMax) {
        return {
          allowed: false,
          reason: `Valor de consigna fuera de rango: ${val} es superior al límite de ingeniería superior (${target.engMax}).`,
          violationCode: "OUT_OF_ENGINEERING_RANGE",
          zoneAllowed: true,
        };
      }

      // Max single-step rate of change sanity check (> 50% jump requires engineering approval)
      if (
        typeof operation.currentValue === "number" &&
        target.engMax !== undefined &&
        target.engMin !== undefined
      ) {
        const fullSpan = target.engMax - target.engMin;
        const stepDelta = Math.abs(val - operation.currentValue);
        if (fullSpan > 0 && stepDelta / fullSpan > 0.6) {
          return {
            allowed: false,
            reason: `Salto brusco de consigna detectado (${stepDelta.toFixed(1)} en rango ${fullSpan}). Supone más del 60% del span completo de proceso. Requiere escalonamiento progresivo.`,
            violationCode: "RATE_OF_CHANGE_EXCEEDED",
            zoneAllowed: true,
          };
        }
      }
    }

    return {
      allowed: true,
      zoneAllowed: true,
    };
  }

  /**
   * Helper to derive default operational permissions from application RBAC roles
   */
  public getDefaultOperationalPermissions(role: UserRole): OperationalPermission[] {
    switch (role) {
      case "superadmin":
        return ["READ", "ANALYZE", "ACKNOWLEDGE", "OPERATE", "CONTROL", "ADMIN"];
      case "administrador":
        return ["READ", "ANALYZE", "ACKNOWLEDGE", "OPERATE", "CONTROL", "ADMIN"];
      case "supervisor":
        return ["READ", "ANALYZE", "ACKNOWLEDGE", "OPERATE", "CONTROL"];
      case "operador":
        return ["READ", "ANALYZE", "ACKNOWLEDGE", "OPERATE"];
      case "mantenimiento":
        return ["READ", "ANALYZE", "ACKNOWLEDGE"];
      case "laboratorio":
      case "auditor":
      default:
        return ["READ", "ANALYZE"];
    }
  }
}

export const policyEngine = PolicyEngine.getInstance();
