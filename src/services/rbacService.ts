import { UserRole, RbacRoleDefinition } from "../types";

export type RbacAction =
  | "ADD_CANE_BATCH"
  | "UPDATE_CANE_BATCH"
  | "DELETE_CANE_BATCH"
  | "ADD_WORK_ORDER"
  | "UPDATE_WORK_ORDER"
  | "DELETE_WORK_ORDER"
  | "APPROVE_WORK_ORDER"
  | "ACKNOWLEDGE_ALARM"
  | "CLEAR_ALARM"
  | "SHELVE_ALARM"
  | "CHANGE_DISPATCH_MW"
  | "MODIFY_SETPOINTS"
  | "RESET_DATABASE"
  | "EXPORT_HISTORIAN"
  | "MANAGE_TENANTS"
  | "MANAGE_USERS"
  | "MODIFY_PLANT_PARAMS";

export interface RbacRule {
  allowedRoles: UserRole[];
  description: string;
  minClearance: number; // 1 (Operador), 2 (Mantenimiento), 3 (Supervisor), 4 (Admin), 5 (Superadmin)
  module: string;
}

export const DEFAULT_ROLES: RbacRoleDefinition[] = [
  {
    id: "role-superadmin",
    role: "superadmin",
    title: "Super Administrador Global",
    description: "Acceso total irrestricto a todas las empresas (Multi-Tenant), creación de nuevos ingenios, gestión de usuarios raíz y configuración del núcleo SCADA.",
    badgeColor: "bg-amber-400/20 text-amber-300 border-amber-400/50",
    securityClearanceLevel: 5,
    canWriteSetpoints: true,
    canAcknowledgeAlarms: true,
    canShelveAlarms: true,
    canCreateWorkOrders: true,
    canApproveWorkOrders: true,
    canChangeDispatchMW: true,
    canExportHistorian: true,
    canAddCaneBatches: true,
    canModifyPlantParams: true,
    canAccessAiCenter: true,
    canManageTenants: true,
    canManageUsers: true,
    isSystem: true,
    tenantId: "GLOBAL",
  },
  {
    id: "role-administrador",
    role: "administrador",
    title: "Administrador de Planta (Gerencia)",
    description: "Gestión total de la planta asignada, aprobación de órdenes CMMS, auditorías, modificación de parámetros de planta y gestión de personal.",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    securityClearanceLevel: 4,
    canWriteSetpoints: true,
    canAcknowledgeAlarms: true,
    canShelveAlarms: true,
    canCreateWorkOrders: true,
    canApproveWorkOrders: true,
    canChangeDispatchMW: true,
    canExportHistorian: true,
    canAddCaneBatches: true,
    canModifyPlantParams: true,
    canAccessAiCenter: true,
    canManageTenants: false,
    canManageUsers: true,
    isSystem: true,
    tenantId: "GLOBAL",
  },
  {
    id: "role-supervisor",
    role: "supervisor",
    title: "Supervisor de Turno / Operaciones",
    description: "Supervisión de tándem de molienda, calderas y cogeneración. Ajuste de consignas en vivo, control de despacho MW y aprobación de órdenes.",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    securityClearanceLevel: 3,
    canWriteSetpoints: true,
    canAcknowledgeAlarms: true,
    canShelveAlarms: true,
    canCreateWorkOrders: true,
    canApproveWorkOrders: true,
    canChangeDispatchMW: true,
    canExportHistorian: true,
    canAddCaneBatches: true,
    canModifyPlantParams: true,
    canAccessAiCenter: true,
    canManageTenants: false,
    canManageUsers: false,
    isSystem: true,
    tenantId: "GLOBAL",
  },
  {
    id: "role-operador",
    role: "operador",
    title: "Operador de Sala DCS / Recepción",
    description: "Monitoreo continuo de pantallas SCADA, reconocimiento de alarmas de proceso, registro de báscula de caña y solicitudes de mantenimiento.",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    securityClearanceLevel: 2,
    canWriteSetpoints: false,
    canAcknowledgeAlarms: true,
    canShelveAlarms: false,
    canCreateWorkOrders: true,
    canApproveWorkOrders: false,
    canChangeDispatchMW: false,
    canExportHistorian: false,
    canAddCaneBatches: true,
    canModifyPlantParams: false,
    canAccessAiCenter: false,
    canManageTenants: false,
    canManageUsers: false,
    isSystem: true,
    tenantId: "GLOBAL",
  },
  {
    id: "role-mantenimiento",
    role: "mantenimiento",
    title: "Técnico de Mantenimiento & Confiabilidad",
    description: "Inspección predictiva CBM (vibraciones ISO 10816, termografía), actualización de tareas en órdenes CMMS y descarga de series temporales.",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    securityClearanceLevel: 2,
    canWriteSetpoints: false,
    canAcknowledgeAlarms: true,
    canShelveAlarms: false,
    canCreateWorkOrders: true,
    canApproveWorkOrders: false,
    canChangeDispatchMW: false,
    canExportHistorian: true,
    canAddCaneBatches: false,
    canModifyPlantParams: false,
    canAccessAiCenter: true,
    canManageTenants: false,
    canManageUsers: false,
    isSystem: true,
    tenantId: "GLOBAL",
  },
];

export const RBAC_RULES: Record<RbacAction, RbacRule> = {
  ADD_CANE_BATCH: {
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador"],
    description: "Registrar camiones y muestras de caña en Báscula & Core Sampler",
    minClearance: 1,
    module: "LIMS & Recepción de Caña",
  },
  UPDATE_CANE_BATCH: {
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Modificar análisis de laboratorio LIMS, Brix/Pol o liquidación ARE",
    minClearance: 3,
    module: "LIMS & Recepción de Caña",
  },
  DELETE_CANE_BATCH: {
    allowedRoles: ["superadmin", "administrador"],
    description: "Eliminar registros de lotes de caña de la base de datos",
    minClearance: 4,
    module: "LIMS & Recepción de Caña",
  },
  ADD_WORK_ORDER: {
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento"],
    description: "Crear solicitudes u órdenes de trabajo en el sistema CMMS",
    minClearance: 1,
    module: "Mantenimiento CMMS",
  },
  UPDATE_WORK_ORDER: {
    allowedRoles: ["superadmin", "administrador", "supervisor", "mantenimiento"],
    description: "Actualizar diagnósticos, horas hombre y tareas ejecutadas en OT",
    minClearance: 2,
    module: "Mantenimiento CMMS",
  },
  DELETE_WORK_ORDER: {
    allowedRoles: ["superadmin", "administrador"],
    description: "Eliminar órdenes de trabajo del histórico CMMS",
    minClearance: 4,
    module: "Mantenimiento CMMS",
  },
  APPROVE_WORK_ORDER: {
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Aprobar, validar o cerrar formalmente órdenes de mantenimiento",
    minClearance: 3,
    module: "Mantenimiento CMMS",
  },
  ACKNOWLEDGE_ALARM: {
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento"],
    description: "Reconocer (ACK) alarmas activas de proceso según ISA-18.2",
    minClearance: 1,
    module: "Centro de Alarmas",
  },
  CLEAR_ALARM: {
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Limpiar o restablecer alarmas enclavadas de seguridad",
    minClearance: 3,
    module: "Centro de Alarmas",
  },
  SHELVE_ALARM: {
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Silenciar o inhibir temporalmente alarmas de proceso (Shelve)",
    minClearance: 3,
    module: "Centro de Alarmas",
  },
  CHANGE_DISPATCH_MW: {
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Modificar consigna de exportación de potencia eléctrica PPA al SEN",
    minClearance: 3,
    module: "Cogeneración Eléctrica",
  },
  MODIFY_SETPOINTS: {
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Ajustar consignas críticas de proceso SCADA / Lazos PID",
    minClearance: 3,
    module: "Sinóptico SCADA / UNS",
  },
  MODIFY_PLANT_PARAMS: {
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Gestionar parámetros operacionales y configuraciones del sistema (CRUD)",
    minClearance: 3,
    module: "Configuración & Diagnóstico",
  },
  MANAGE_TENANTS: {
    allowedRoles: ["superadmin"],
    description: "Crear, editar o administrar empresas en la arquitectura multi-inquilino",
    minClearance: 5,
    module: "Directorio Multi-Tenant",
  },
  MANAGE_USERS: {
    allowedRoles: ["superadmin", "administrador"],
    description: "Gestionar usuarios, roles y matriz de permisos (CRUD)",
    minClearance: 4,
    module: "Seguridad & Usuarios",
  },
  RESET_DATABASE: {
    allowedRoles: ["superadmin", "administrador"],
    description: "Restablecer colecciones de Cloud Firestore al estado de fábrica",
    minClearance: 4,
    module: "Administración de Sistema",
  },
  EXPORT_HISTORIAN: {
    allowedRoles: ["superadmin", "administrador", "supervisor", "mantenimiento"],
    description: "Descargar series temporales y auditorías en CSV/JSON",
    minClearance: 2,
    module: "Historiador de Planta",
  },
};

export function checkRbacPermission(
  role: UserRole,
  action: RbacAction,
  customRoles?: RbacRoleDefinition[]
): { allowed: boolean; reason?: string; rule: RbacRule } {
  const rule = RBAC_RULES[action];
  if (!rule) {
    return {
      allowed: false,
      reason: `Acción '${action}' no reconocida en la matriz RBAC.`,
      rule: {
        allowedRoles: ["superadmin", "administrador"],
        description: "Acción no clasificada",
        minClearance: 4,
        module: "Sistema",
      },
    };
  }

  // Superadmin has absolute global access across all modules and actions
  if (role === "superadmin") {
    return { allowed: true, rule };
  }

  // Check custom roles list if provided
  if (customRoles) {
    const foundRole = customRoles.find((r) => r.role === role);
    if (foundRole) {
      if (foundRole.securityClearanceLevel >= rule.minClearance) {
        return { allowed: true, rule };
      }
      // Check explicit capability mappings
      if (action === "ADD_CANE_BATCH" && foundRole.canAddCaneBatches) return { allowed: true, rule };
      if (action === "UPDATE_CANE_BATCH" && foundRole.canAddCaneBatches && foundRole.securityClearanceLevel >= 3) return { allowed: true, rule };
      if (action === "ADD_WORK_ORDER" && foundRole.canCreateWorkOrders) return { allowed: true, rule };
      if (action === "APPROVE_WORK_ORDER" && foundRole.canApproveWorkOrders) return { allowed: true, rule };
      if (action === "ACKNOWLEDGE_ALARM" && foundRole.canAcknowledgeAlarms) return { allowed: true, rule };
      if (action === "SHELVE_ALARM" && foundRole.canShelveAlarms) return { allowed: true, rule };
      if (action === "CHANGE_DISPATCH_MW" && foundRole.canChangeDispatchMW) return { allowed: true, rule };
      if (action === "MODIFY_SETPOINTS" && foundRole.canWriteSetpoints) return { allowed: true, rule };
      if (action === "MODIFY_PLANT_PARAMS" && foundRole.canModifyPlantParams) return { allowed: true, rule };
      if (action === "MANAGE_TENANTS" && foundRole.canManageTenants) return { allowed: true, rule };
      if (action === "MANAGE_USERS" && foundRole.canManageUsers) return { allowed: true, rule };
      if (action === "EXPORT_HISTORIAN" && foundRole.canExportHistorian) return { allowed: true, rule };
    }
  }

  const isAllowed = rule.allowedRoles.includes(role);
  if (!isAllowed) {
    return {
      allowed: false,
      reason: `El rol actual '${String(role).toUpperCase()}' no tiene permisos para '${rule.description}'. Se requiere nivel ${rule.allowedRoles.join(" o ")}.`,
      rule,
    };
  }

  return { allowed: true, rule };
}

export function isSuperAdminUser(user?: { role?: string; isSuperAdmin?: boolean } | null): boolean {
  if (!user) return false;
  return user.role === "superadmin" || Boolean(user.isSuperAdmin);
}

export function getRoleBadgeInfo(role: UserRole) {
  switch (role) {
    case "superadmin":
      return {
        label: "Super Admin",
        clearance: "Nivel 5 (Root Global)",
        color: "bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-amber-400/10",
        badgeBg: "bg-gradient-to-r from-amber-500 to-yellow-500",
      };
    case "administrador":
      return {
        label: "Administrador",
        clearance: "Nivel 4 (Gerencia)",
        color: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        badgeBg: "bg-purple-500",
      };
    case "supervisor":
      return {
        label: "Supervisor",
        clearance: "Nivel 3 (Operaciones)",
        color: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        badgeBg: "bg-amber-500",
      };
    case "operador":
      return {
        label: "Operador DCS",
        clearance: "Nivel 2 (Monitoreo & Báscula)",
        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        badgeBg: "bg-emerald-500",
      };
    case "mantenimiento":
      return {
        label: "Mantenimiento",
        clearance: "Nivel 2 (CBM & CMMS)",
        color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        badgeBg: "bg-cyan-500",
      };
    default:
      return {
        label: String(role || "Usuario"),
        clearance: "Nivel Personalizado",
        color: "bg-slate-700/40 text-slate-300 border-slate-600",
        badgeBg: "bg-slate-600",
      };
  }
}


