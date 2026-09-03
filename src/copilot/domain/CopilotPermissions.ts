import { UserRole } from "../../types";
import { OperationSecurityLevel } from "./CopilotTypes";

// ============================================================================
// BIOAZÚCAR COPILOT — TOOL PERMISSION DECLARATIONS & RBAC POLICY MATRIX
// ============================================================================

export interface ToolSecurityPolicy {
  toolName: string;
  level: OperationSecurityLevel;
  requiredPermissions: string[];
  minimumClearanceLevel: number; // 1 to 5
  allowedRoles: UserRole[];
  description: string;
  auditRequired: boolean;
}

export const COPILOT_TOOL_POLICIES: Record<string, ToolSecurityPolicy> = {
  // --------------------------------------------------------------------------
  // DATA TOOLS (LEVEL 1 - READ)
  // --------------------------------------------------------------------------
  get_current_process_state: {
    toolName: "get_current_process_state",
    level: 1,
    requiredPermissions: ["VIEW_TELEMETRY"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta estado instantáneo de molienda, vapor, generación y OEE",
    auditRequired: false,
  },
  get_tag_value: {
    toolName: "get_tag_value",
    level: 1,
    requiredPermissions: ["VIEW_TAGS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta valor, calidad y timestamp de un tag específico",
    auditRequired: false,
  },
  get_tags: {
    toolName: "get_tags",
    level: 1,
    requiredPermissions: ["VIEW_TAGS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Lista catálogo de tags de proceso del ingenio",
    auditRequired: false,
  },
  get_tag_history: {
    toolName: "get_tag_history",
    level: 1,
    requiredPermissions: ["VIEW_HISTORIAN"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta serie temporal histórica de variables industriales",
    auditRequired: false,
  },
  get_tag_quality: {
    toolName: "get_tag_quality",
    level: 1,
    requiredPermissions: ["VIEW_TAGS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta estado de calidad (GOOD, UNCERTAIN, BAD, SIMULATED)",
    auditRequired: false,
  },
  get_equipment_status: {
    toolName: "get_equipment_status",
    level: 1,
    requiredPermissions: ["VIEW_EQUIPMENT"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta salud, vibración y condición de un equipo",
    auditRequired: false,
  },
  get_area_status: {
    toolName: "get_area_status",
    level: 1,
    requiredPermissions: ["VIEW_TELEMETRY"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta resumen consolidado de un área fabril",
    auditRequired: false,
  },
  get_provider_status: {
    toolName: "get_provider_status",
    level: 1,
    requiredPermissions: ["VIEW_OT_CONFIG"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta estado de enlace del proveedor industrial activo",
    auditRequired: false,
  },
  get_data_lineage: {
    toolName: "get_data_lineage",
    level: 1,
    requiredPermissions: ["VIEW_LINEAGE"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Calcula y explica la trazabilidad y procedencia de cualquier KPI o tag",
    auditRequired: false,
  },

  // --------------------------------------------------------------------------
  // KPI TOOLS (LEVEL 1 - READ)
  // --------------------------------------------------------------------------
  get_kpi: {
    toolName: "get_kpi",
    level: 1,
    requiredPermissions: ["VIEW_KPIS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta valor y meta de un KPI canónico",
    auditRequired: false,
  },
  calculate_kpi: {
    toolName: "calculate_kpi",
    level: 1,
    requiredPermissions: ["VIEW_KPIS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Calcula un KPI en tiempo real a partir de sus tags de entrada",
    auditRequired: false,
  },
  get_kpi_history: {
    toolName: "get_kpi_history",
    level: 1,
    requiredPermissions: ["VIEW_HISTORIAN"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta tendencias históricas de KPIs",
    auditRequired: false,
  },
  get_kpi_trend: {
    toolName: "get_kpi_trend",
    level: 1,
    requiredPermissions: ["VIEW_KPIS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Evalúa pendiente y tendencia reciente de un KPI",
    auditRequired: false,
  },
  compare_kpi_periods: {
    toolName: "compare_kpi_periods",
    level: 1,
    requiredPermissions: ["VIEW_KPIS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Compara desempeño de KPIs entre dos turnos o zafras",
    auditRequired: false,
  },
  calculate_oee: {
    toolName: "calculate_oee",
    level: 1,
    requiredPermissions: ["VIEW_KPIS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Desglosa cálculo ISO 22400 (Disponibilidad × Rendimiento × Calidad)",
    auditRequired: false,
  },
  calculate_extraction: {
    toolName: "calculate_extraction",
    level: 1,
    requiredPermissions: ["VIEW_KPIS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Calcula balance de sacarosa en molienda",
    auditRequired: false,
  },
  calculate_energy_balance: {
    toolName: "calculate_energy_balance",
    level: 1,
    requiredPermissions: ["VIEW_KPIS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Calcula balance de masa de bagazo, vapor vivo y MW exportados",
    auditRequired: false,
  },

  // --------------------------------------------------------------------------
  // STATISTICS & ANOMALY TOOLS (LEVEL 1 - READ)
  // --------------------------------------------------------------------------
  calculate_statistics: {
    toolName: "calculate_statistics",
    level: 1,
    requiredPermissions: ["VIEW_HISTORIAN"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Calcula media, min, max, desviación estándar y percentiles",
    auditRequired: false,
  },
  detect_anomalies: {
    toolName: "detect_anomalies",
    level: 1,
    requiredPermissions: ["VIEW_TELEMETRY"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Detecta variaciones anormales respecto a límites estadísticos y de ingeniería",
    auditRequired: false,
  },

  // --------------------------------------------------------------------------
  // ALARM TOOLS (LEVEL 1 READ & LEVEL 2 CONTROLLED WRITE)
  // --------------------------------------------------------------------------
  get_active_alarms: {
    toolName: "get_active_alarms",
    level: 1,
    requiredPermissions: ["VIEW_ALARMS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta alarmas activas y no reconocidas bajo ISA-18.2",
    auditRequired: false,
  },
  get_alarm_history: {
    toolName: "get_alarm_history",
    level: 1,
    requiredPermissions: ["VIEW_ALARMS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta secuencia de eventos (SOE) histórica de alarmas",
    auditRequired: false,
  },
  request_acknowledge_alarm: {
    toolName: "request_acknowledge_alarm",
    level: 2,
    requiredPermissions: ["ACKNOWLEDGE_ALARM"],
    minimumClearanceLevel: 2,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador"],
    description: "Solicita reconocimiento formal de alarma (requiere confirmación del usuario)",
    auditRequired: true,
  },

  // --------------------------------------------------------------------------
  // EQUIPMENT & CMMS TOOLS
  // --------------------------------------------------------------------------
  get_equipment: {
    toolName: "get_equipment",
    level: 1,
    requiredPermissions: ["VIEW_EQUIPMENT"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta detalles mecánicos, OTs y FFT de vibración de equipo",
    auditRequired: false,
  },
  get_equipment_health: {
    toolName: "get_equipment_health",
    level: 1,
    requiredPermissions: ["VIEW_EQUIPMENT"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta índice de condición y estado de rodamientos",
    auditRequired: false,
  },

  // --------------------------------------------------------------------------
  // KNOWLEDGE & SYSTEM TOOLS (LEVEL 1)
  // --------------------------------------------------------------------------
  search_system_knowledge: {
    toolName: "search_system_knowledge",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta documentación técnica, manuales y normativas ISA de BioAzúcar",
    auditRequired: false,
  },
  get_process_explanation: {
    toolName: "get_process_explanation",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Explica fundamentos fisicoquímicos y de control de un área",
    auditRequired: false,
  },
  get_module_help: {
    toolName: "get_module_help",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Explica el funcionamiento y capacidades de un módulo de la interfaz",
    auditRequired: false,
  },
  explain_capabilities: {
    toolName: "explain_capabilities",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Presenta las capacidades reales de BioAzúcar Copilot sin sesgo de procesos",
    auditRequired: false,
  },
  get_system_info: {
    toolName: "get_system_info",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta arquitectura, versión y estándares de BioAzúcar 4.0",
    auditRequired: false,
  },
  get_user_permissions: {
    toolName: "get_user_permissions",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta los roles, nivel IEC 62443 y permisos del usuario autenticado",
    auditRequired: false,
  },
  search_glossary: {
    toolName: "search_glossary",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta términos técnicos, acrónimos e indicadores en el glosario industrial",
    auditRequired: false,
  },
  get_contextual_help: {
    toolName: "get_contextual_help",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Proporciona ayuda y guía contextual sobre la pantalla y módulo actualmente visibles",
    auditRequired: false,
  },
  get_procedure: {
    toolName: "get_procedure",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta procedimientos operativos estándar (SOP) paso a paso con condiciones de seguridad",
    auditRequired: false,
  },
  query_knowledge_graph: {
    toolName: "query_knowledge_graph",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Consulta relaciones entre activos, tags, alarmas, KPIs y procedimientos en el grafo de conocimiento",
    auditRequired: false,
  },
  get_tutorial_step: {
    toolName: "get_tutorial_step",
    level: 1,
    requiredPermissions: ["VIEW_DOCS"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Obtiene los pasos guiados del tutorial y tour de onboarding de BioAzúcar 4.0",
    auditRequired: false,
  },

  // --------------------------------------------------------------------------
  // UI & NAVIGATION TOOLS (LEVEL 1)
  // --------------------------------------------------------------------------
  navigate_to: {
    toolName: "navigate_to",
    level: 1,
    requiredPermissions: ["NAVIGATE_APP"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Navega a un módulo de la aplicación",
    auditRequired: false,
  },
  open_equipment: {
    toolName: "open_equipment",
    level: 1,
    requiredPermissions: ["VIEW_EQUIPMENT"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Abre la vista de mantenimiento de un equipo específico",
    auditRequired: false,
  },
  open_lineage: {
    toolName: "open_lineage",
    level: 1,
    requiredPermissions: ["VIEW_LINEAGE"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Abre el modal de linaje de datos de una variable",
    auditRequired: false,
  },
  show_chart: {
    toolName: "show_chart",
    level: 1,
    requiredPermissions: ["VIEW_HISTORIAN"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Genera e incrusta un gráfico interactivo en la conversación",
    auditRequired: false,
  },
  show_table: {
    toolName: "show_table",
    level: 1,
    requiredPermissions: ["VIEW_TELEMETRY"],
    minimumClearanceLevel: 1,
    allowedRoles: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"],
    description: "Genera e incrusta una tabla estructurada en la conversación",
    auditRequired: false,
  },

  // --------------------------------------------------------------------------
  // CRITICAL WRITE TOOLS (LEVEL 3 - CRITICAL)
  // --------------------------------------------------------------------------
  request_setpoint_change: {
    toolName: "request_setpoint_change",
    level: 3,
    requiredPermissions: ["MODIFY_SETPOINTS"],
    minimumClearanceLevel: 4, // Administrador o Superadmin
    allowedRoles: ["superadmin", "administrador"],
    description: "Solicita modificación de setpoint o límite operacional (requiere confirmación y doble autorización)",
    auditRequired: true,
  },
  request_dispatch_change: {
    toolName: "request_dispatch_change",
    level: 3,
    requiredPermissions: ["CHANGE_DISPATCH_MW"],
    minimumClearanceLevel: 3, // Supervisor, Admin, Superadmin
    allowedRoles: ["superadmin", "administrador", "supervisor"],
    description: "Solicita modificación de consigna de despacho PPA en MW hacia el SEN",
    auditRequired: true,
  },
};

export function checkToolAuthorization(
  toolName: string,
  userRoles: UserRole[],
  userClearance: number,
  isSuperAdmin = false
): { allowed: boolean; reason?: string; policy?: ToolSecurityPolicy } {
  const policy = COPILOT_TOOL_POLICIES[toolName];
  if (!policy) {
    return {
      allowed: false,
      reason: `La herramienta '${toolName}' no está registrada en la matriz de seguridad.`,
    };
  }

  if (isSuperAdmin || userRoles.includes("superadmin")) {
    return { allowed: true, policy };
  }

  // Role check
  const hasRole = userRoles.some((role) => policy.allowedRoles.includes(role));
  if (!hasRole) {
    return {
      allowed: false,
      reason: `Tu rol actual (${userRoles.join(", ")}) no tiene autorización para ejecutar '${policy.toolName}'.`,
      policy,
    };
  }

  // Clearance check
  if (userClearance < policy.minimumClearanceLevel) {
    return {
      allowed: false,
      reason: `Nivel de seguridad insuficiente (${userClearance} < ${policy.minimumClearanceLevel} requerido).`,
      policy,
    };
  }

  return { allowed: true, policy };
}
