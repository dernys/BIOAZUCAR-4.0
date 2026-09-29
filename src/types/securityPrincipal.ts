/**
 * BioAzúcar 4.0 — Canonical Identity, RBAC & Permission Registry (SEC-P0)
 * ==============================================================================
 * Conforms to IEC 62443-4-2 SL3, NIST SP 800-63B (AAL), and ISA-95 Models.
 *
 * Defines:
 * 1. Single AuthenticatedPrincipal representation (SSOT).
 * 2. Atomic Permission Registry for fine-grained authorization.
 * 3. Strict separation of ROLE vs SCOPE (SuperAdmin requires role='superadmin' AND scope='GLOBAL').
 */

export type AuthenticationAssuranceLevel = "AAL1" | "AAL2" | "AAL3";

export type SecurityScope = "GLOBAL" | "TENANT";

/**
 * Canonical Atomic Permissions Registry (SEC-P0)
 */
export type AtomicPermission =
  // Tenant Lifecycle
  | "tenant.read"
  | "tenant.create"
  | "tenant.update"
  | "tenant.delete"
  // User Management
  | "user.read"
  | "user.create"
  | "user.update"
  | "user.disable"
  | "user.delete"
  | "users.read"
  | "users.create"
  | "users.update"
  | "users.disable"
  | "users.delete"
  // Role & Policy Management
  | "role.read"
  | "role.create"
  | "role.update"
  | "role.delete"
  | "roles.read"
  | "roles.create"
  | "roles.update"
  | "roles.delete"
  | "permission.read"
  | "permission.assign"
  | "permissions.read"
  | "permissions.manage"
  // Sessions Management
  | "sessions.read"
  | "sessions.revoke"
  // Plant & Industrial Configuration
  | "plant.read"
  | "plant.configure"
  // Alarms Management (ISA-18.2)
  | "alarm.read"
  | "alarm.ack"
  | "alarm.acknowledge"
  | "alarm.shelve"
  | "alarm.clear"
  | "alarm.configure"
  // Equipment CBM / Maintenance
  | "equipment.read"
  | "equipment.create"
  | "equipment.update"
  | "equipment.delete"
  | "equipment.configure"
  // Process Setpoints (SCADA / PID)
  | "setpoint.read"
  | "setpoint.write"
  // Historian & Telemetry
  | "historian.read"
  | "historian.export"
  | "telemetry.read"
  | "telemetry.export"
  // Edge Nodes & Gateway
  | "edge.read"
  | "edge.configure"
  // Industrial Command Execution (PLC / DCS Gateway)
  | "industrial.command.execute"
  // Audit Trail & Compliance
  | "audit.read"
  | "audit.export"
  // LIMS & Agriculture
  | "lims.read"
  | "lims.write"
  | "lims.delete"
  // CMMS Work Orders
  | "cmms.read"
  | "cmms.write"
  | "cmms.approve"
  | "cmms.delete"
  // Cogeneration & Dispatch
  | "cogen.read"
  | "cogen.dispatch"
  // Security Policies & Credentials
  | "security.policy.update"
  | "security.credentials.manage";

export type PermissionRiskLevel = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

export type PermissionModule =
  | "Seguridad & IAM"
  | "Directorio Multi-Tenant"
  | "Operaciones SCADA"
  | "Centro de Alarmas"
  | "Equipos & Mantenimiento CMMS"
  | "Historiador & Telemetría"
  | "Calidad & LIMS"
  | "Cogeneración Eléctrica"
  | "Edge & IIoT"
  | "Auditoría & Cumplimiento";

export interface PermissionCatalogItem {
  key: AtomicPermission;
  name: string;
  description: string;
  resource: string;
  action: string;
  module: PermissionModule;
  scopeType: "GLOBAL" | "TENANT" | "PLANT" | "AREA";
  riskLevel: PermissionRiskLevel;
  system: boolean;
  enabled: boolean;
}

export interface AccessScopeAssignment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleId: string;
  role: string;
  tenantId: string;
  plantId?: string;
  areaId?: string;
  resource?: string;
  scopeType: "GLOBAL" | "TENANT" | "PLANT" | "AREA";
  assignedAt: string;
  assignedBy: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
}

export interface UserSessionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  startedAt: string;
  lastActiveAt: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  revokedAt?: string;
  revokedBy?: string;
  authAssurance: "AAL1" | "AAL2" | "AAL3";
}

export interface EffectivePermissionRecord {
  permission: AtomicPermission;
  name: string;
  resource: string;
  action: string;
  scope: string;
  sourceRole: string;
  riskLevel: PermissionRiskLevel;
  module: PermissionModule;
  granted: boolean;
  reason?: string;
}

export const CANONICAL_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  // Multi-Tenant
  { key: "tenant.read", name: "Consultar Empresas", description: "Ver directorio de ingenios y particiones multi-tenant", resource: "tenants", action: "read", module: "Directorio Multi-Tenant", scopeType: "GLOBAL", riskLevel: "BAJO", system: true, enabled: true },
  { key: "tenant.create", name: "Crear Empresa", description: "Aprovisionar nuevo ingenio azucarero en plataforma", resource: "tenants", action: "create", module: "Directorio Multi-Tenant", scopeType: "GLOBAL", riskLevel: "CRITICO", system: true, enabled: true },
  { key: "tenant.update", name: "Modificar Empresa", description: "Editar parámetros nominales de molienda y capacidad de cogeneración", resource: "tenants", action: "update", module: "Directorio Multi-Tenant", scopeType: "GLOBAL", riskLevel: "ALTO", system: true, enabled: true },
  { key: "tenant.delete", name: "Eliminar Empresa", description: "Dar de baja partición de empresa en el clúster", resource: "tenants", action: "delete", module: "Directorio Multi-Tenant", scopeType: "GLOBAL", riskLevel: "CRITICO", system: true, enabled: true },

  // User Management
  { key: "user.read", name: "Listar Usuarios", description: "Consultar directorio de identidades y membresías del tenant", resource: "users", action: "read", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "users.read", name: "Listar Usuarios (Alias)", description: "Consultar directorio de identidades del tenant", resource: "users", action: "read", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "user.create", name: "Crear Usuario", description: "Dar de alta nueva cuenta de operador, supervisor o administrador", resource: "users", action: "create", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "users.create", name: "Crear Usuario (Alias)", description: "Dar de alta nueva cuenta de usuario", resource: "users", action: "create", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "user.update", name: "Modificar Usuario", description: "Actualizar perfiles, roles y niveles de seguridad SIL", resource: "users", action: "update", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "users.update", name: "Modificar Usuario (Alias)", description: "Actualizar perfiles de usuario", resource: "users", action: "update", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "user.disable", name: "Desactivar Usuario", description: "Suspender administrativamente el acceso a la plataforma", resource: "users", action: "disable", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "users.disable", name: "Desactivar Usuario (Alias)", description: "Suspender acceso administrativo", resource: "users", action: "disable", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "user.delete", name: "Eliminar Usuario", description: "Eliminación segura con trazabilidad de auditoría", resource: "users", action: "delete", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "CRITICO", system: true, enabled: true },
  { key: "users.delete", name: "Eliminar Usuario (Alias)", description: "Eliminación segura con trazabilidad", resource: "users", action: "delete", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "CRITICO", system: true, enabled: true },

  // Role Management
  { key: "role.read", name: "Consultar Roles", description: "Ver definiciones de roles RBAC y capacidades asignadas", resource: "roles", action: "read", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "roles.read", name: "Consultar Roles (Alias)", description: "Ver catálogo de roles RBAC", resource: "roles", action: "read", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "role.create", name: "Crear Rol", description: "Definir nuevo rol personalizado para la planta", resource: "roles", action: "create", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "roles.create", name: "Crear Rol (Alias)", description: "Definir nuevo rol", resource: "roles", action: "create", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "role.update", name: "Editar Rol", description: "Modificar permisos y facultades de un rol personalizado", resource: "roles", action: "update", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "roles.update", name: "Editar Rol (Alias)", description: "Modificar rol personalizado", resource: "roles", action: "update", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "role.delete", name: "Eliminar Rol", description: "Eliminar rol personalizado no asignado", resource: "roles", action: "delete", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "CRITICO", system: true, enabled: true },
  { key: "roles.delete", name: "Eliminar Rol (Alias)", description: "Eliminar rol personalizado", resource: "roles", action: "delete", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "CRITICO", system: true, enabled: true },

  // Permissions & Policy Management
  { key: "permission.read", name: "Consultar Permisos", description: "Auditar catálogo canónico de permisos atómicos", resource: "permissions", action: "read", module: "Seguridad & IAM", scopeType: "GLOBAL", riskLevel: "BAJO", system: true, enabled: true },
  { key: "permissions.read", name: "Consultar Permisos (Alias)", description: "Auditar permisos", resource: "permissions", action: "read", module: "Seguridad & IAM", scopeType: "GLOBAL", riskLevel: "BAJO", system: true, enabled: true },
  { key: "permission.assign", name: "Asignar Permisos", description: "Conceder o revocar permisos atómicos sobre roles y scopes", resource: "permissions", action: "assign", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "CRITICO", system: true, enabled: true },
  { key: "permissions.manage", name: "Gestionar Permisos", description: "Administrar matriz canónica de autorización", resource: "permissions", action: "manage", module: "Seguridad & IAM", scopeType: "GLOBAL", riskLevel: "CRITICO", system: true, enabled: true },

  // Sessions Management
  { key: "sessions.read", name: "Consultar Sesiones", description: "Inspeccionar sesiones activas en sala de control y dispositivos", resource: "sessions", action: "read", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "sessions.revoke", name: "Revocar Sesión", description: "Terminar sesiones activas inmediatamente", resource: "sessions", action: "revoke", module: "Seguridad & IAM", scopeType: "TENANT", riskLevel: "ALTO", system: true, enabled: true },

  // SCADA / Plant Operations
  { key: "plant.read", name: "Lectura de Planta", description: "Visualizar sinópticos SCADA, mímicos y KPIs operacionales", resource: "plant", action: "read", module: "Operaciones SCADA", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "plant.configure", name: "Configurar Planta", description: "Ajustar parámetros maestros del tándem y calderas", resource: "plant", action: "configure", module: "Operaciones SCADA", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "setpoint.read", name: "Lectura Consignas", description: "Ver consignas de lazos PID y reguladores de molienda", resource: "setpoints", action: "read", module: "Operaciones SCADA", scopeType: "AREA", riskLevel: "BAJO", system: true, enabled: true },
  { key: "setpoint.write", name: "Escritura Consignas", description: "Ajustar consignas críticas de proceso SCADA en vivo", resource: "setpoints", action: "write", module: "Operaciones SCADA", scopeType: "AREA", riskLevel: "ALTO", system: true, enabled: true },
  { key: "telemetry.read", name: "Lectura Telemetría", description: "Consultar flujo en tiempo real de variables industriales", resource: "telemetry", action: "read", module: "Historiador & Telemetría", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "telemetry.export", name: "Exportar Telemetría", description: "Descargar series temporales en formato CSV / Parquet", resource: "telemetry", action: "export", module: "Historiador & Telemetría", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },

  // Alarms (ISA-18.2)
  { key: "alarm.read", name: "Consultar Alarmas", description: "Monitorear alarmas activas y enclavamientos de seguridad", resource: "alarms", action: "read", module: "Centro de Alarmas", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "alarm.ack", name: "Reconocer Alarma (ACK)", description: "Confirmar reconocimiento de alarma de proceso", resource: "alarms", action: "ack", module: "Centro de Alarmas", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "alarm.acknowledge", name: "Reconocer Alarma (Alias)", description: "Confirmar reconocimiento según ISA-18.2", resource: "alarms", action: "acknowledge", module: "Centro de Alarmas", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "alarm.shelve", name: "Inhibir Alarma (Shelve)", description: "Inhibir temporalmente alarma con justificación operacional", resource: "alarms", action: "shelve", module: "Centro de Alarmas", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "alarm.clear", name: "Restablecer Alarma", description: "Limpiar y restablecer alarma enclavada", resource: "alarms", action: "clear", module: "Centro de Alarmas", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "alarm.configure", name: "Configurar Umbrales Alarmas", description: "Modificar límites HH, H, L, LL según ingeniería", resource: "alarms", action: "configure", module: "Centro de Alarmas", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },

  // Equipment & CMMS
  { key: "equipment.read", name: "Consultar Equipos CBM", description: "Ver condición mecánica, vibraciones ISO 10816 y OTs", resource: "equipment", action: "read", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "equipment.create", name: "Registrar Equipo", description: "Dar de alta un nuevo activo en el árbol ISA-95", resource: "equipment", action: "create", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "equipment.update", name: "Modificar Equipo", description: "Actualizar datos de placa, potencias y umbrales predictivos", resource: "equipment", action: "update", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "equipment.delete", name: "Eliminar Equipo", description: "Dar de baja equipo del catálogo de la planta", resource: "equipment", action: "delete", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "equipment.configure", name: "Configurar Diagnóstico CBM", description: "Calibrar bandas espectrales FFT y frecuencias de falla", resource: "equipment", action: "configure", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },

  // CMMS Work Orders
  { key: "cmms.read", name: "Consultar Órdenes", description: "Listar solicitudes y órdenes de trabajo", resource: "cmms", action: "read", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "cmms.write", name: "Crear/Editar Órdenes", description: "Registrar intervenciones mecánicas o eléctricas", resource: "cmms", action: "write", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "cmms.approve", name: "Aprobar Órdenes", description: "Autorizar cierre técnico y firma de mantenimiento", resource: "cmms", action: "approve", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "cmms.delete", name: "Eliminar Órdenes", description: "Eliminar registros de órdenes de trabajo erróneas", resource: "cmms", action: "delete", module: "Equipos & Mantenimiento CMMS", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },

  // Historian
  { key: "historian.read", name: "Consultar Historiador", description: "Ver tendencias históricas de variables de molienda y vapor", resource: "historian", action: "read", module: "Historiador & Telemetría", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "historian.export", name: "Exportar Historiador", description: "Descargar series temporales del archivo TSDB", resource: "historian", action: "export", module: "Historiador & Telemetría", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },

  // LIMS & Caña
  { key: "lims.read", name: "Consultar LIMS", description: "Ver pesajes de caña y análisis Brix / Pol / ARE", resource: "lims", action: "read", module: "Calidad & LIMS", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "lims.write", name: "Registrar Lote de Caña", description: "Ingresar camiones y muestras de laboratorio azucarero", resource: "lims", action: "write", module: "Calidad & LIMS", scopeType: "PLANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "lims.delete", name: "Eliminar Registro LIMS", description: "Dar de baja registros de recepción de caña", resource: "lims", action: "delete", module: "Calidad & LIMS", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },

  // Cogeneration & Dispatch
  { key: "cogen.read", name: "Consultar Cogeneración", description: "Ver balance térmico ASME PTC 4 y generación MW", resource: "cogen", action: "read", module: "Cogeneración Eléctrica", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "cogen.dispatch", name: "Despacho MW", description: "Ajustar consigna de exportación al Mercado Eléctrico", resource: "cogen", action: "dispatch", module: "Cogeneración Eléctrica", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },

  // Edge & IIoT Gateway
  { key: "edge.read", name: "Monitorear Nodos Edge", description: "Ver estado de conectores OPC UA, Modbus y MQTT", resource: "edge", action: "read", module: "Edge & IIoT", scopeType: "PLANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "edge.configure", name: "Configurar Nodos Edge", description: "Ajustar parámetros de Store & Forward y TLS", resource: "edge", action: "configure", module: "Edge & IIoT", scopeType: "PLANT", riskLevel: "ALTO", system: true, enabled: true },
  { key: "industrial.command.execute", name: "Ejecutar Comando OT", description: "Enviar comandos directos a PLCs a través de Secure Gateway", resource: "industrial.command", action: "execute", module: "Operaciones SCADA", scopeType: "AREA", riskLevel: "CRITICO", system: true, enabled: true },

  // Audit & Security Policies
  { key: "audit.read", name: "Consultar Auditoría", description: "Ver registro inmutable de eventos con firma SHA-256", resource: "audit", action: "read", module: "Auditoría & Cumplimiento", scopeType: "TENANT", riskLevel: "BAJO", system: true, enabled: true },
  { key: "audit.export", name: "Exportar Auditoría", description: "Descargar cadena de custodia criptográfica IEC 62443", resource: "audit", action: "export", module: "Auditoría & Cumplimiento", scopeType: "TENANT", riskLevel: "MEDIO", system: true, enabled: true },
  { key: "security.policy.update", name: "Políticas de Seguridad", description: "Modificar enclavamientos físicos y políticas de control", resource: "security", action: "policy.update", module: "Seguridad & IAM", scopeType: "GLOBAL", riskLevel: "CRITICO", system: true, enabled: true },
  { key: "security.credentials.manage", name: "Gestión de Credenciales", description: "Rotación de secretos Edge y WebAuthn FIDO2", resource: "security", action: "credentials.manage", module: "Seguridad & IAM", scopeType: "GLOBAL", riskLevel: "CRITICO", system: true, enabled: true },
];

/**
 * Canonical Authenticated Principal Model (SEC-P0 §4)
 */
export interface AuthenticatedPrincipal {
  uid: string;
  email: string;
  tenantId: string;
  membershipId: string;
  roleId: string;
  role: string;
  permissions: AtomicPermission[];
  isSuperAdmin: boolean;
  securityLevel: number;
  authenticationAssurance: AuthenticationAssuranceLevel;
  scope: SecurityScope;
  sessionId?: string;
  issuedAt?: number;
  expiresAt?: number;
}

/**
 * Atomic Permission definitions for default enterprise roles
 */
export const ROLE_ATOMIC_PERMISSIONS: Record<string, AtomicPermission[]> = {
  superadmin: [
    "tenant.read",
    "tenant.create",
    "tenant.update",
    "tenant.delete",
    "user.read",
    "user.create",
    "user.update",
    "user.disable",
    "user.delete",
    "role.read",
    "role.create",
    "role.update",
    "role.delete",
    "permission.read",
    "permission.assign",
    "plant.read",
    "plant.configure",
    "alarm.ack",
    "alarm.shelve",
    "alarm.clear",
    "setpoint.read",
    "setpoint.write",
    "historian.read",
    "historian.export",
    "edge.read",
    "edge.configure",
    "industrial.command.execute",
    "audit.read",
    "audit.export",
    "lims.read",
    "lims.write",
    "lims.delete",
    "cmms.read",
    "cmms.write",
    "cmms.approve",
    "cmms.delete",
    "cogen.read",
    "cogen.dispatch",
    "security.policy.update",
    "security.credentials.manage",
  ],
  administrador: [
    "user.read",
    "user.create",
    "user.update",
    "user.disable",
    "role.read",
    "permission.read",
    "plant.read",
    "plant.configure",
    "alarm.ack",
    "alarm.shelve",
    "alarm.clear",
    "setpoint.read",
    "setpoint.write",
    "historian.read",
    "historian.export",
    "edge.read",
    "industrial.command.execute",
    "audit.read",
    "lims.read",
    "lims.write",
    "lims.delete",
    "cmms.read",
    "cmms.write",
    "cmms.approve",
    "cmms.delete",
    "cogen.read",
    "cogen.dispatch",
  ],
  supervisor: [
    "plant.read",
    "alarm.ack",
    "alarm.shelve",
    "alarm.clear",
    "setpoint.read",
    "setpoint.write",
    "historian.read",
    "historian.export",
    "industrial.command.execute",
    "lims.read",
    "lims.write",
    "cmms.read",
    "cmms.write",
    "cmms.approve",
    "cogen.read",
    "cogen.dispatch",
  ],
  operador: [
    "plant.read",
    "alarm.ack",
    "setpoint.read",
    "historian.read",
    "lims.read",
    "lims.write",
    "cmms.read",
    "cmms.write",
  ],
  mantenimiento: [
    "plant.read",
    "alarm.ack",
    "historian.read",
    "historian.export",
    "cmms.read",
    "cmms.write",
  ],
  observador: [
    "plant.read",
    "historian.read",
  ],
};

const PERMISSION_EQUIVALENTS: Record<string, string[]> = {
  "user.read": ["users.read"],
  "users.read": ["user.read"],
  "user.create": ["users.create"],
  "users.create": ["user.create"],
  "user.update": ["users.update"],
  "users.update": ["user.update"],
  "user.disable": ["users.disable"],
  "users.disable": ["user.disable"],
  "user.delete": ["users.delete"],
  "users.delete": ["user.delete"],
  "role.read": ["roles.read"],
  "roles.read": ["role.read"],
  "role.create": ["roles.create"],
  "roles.create": ["role.create"],
  "role.update": ["roles.update"],
  "roles.update": ["role.update"],
  "role.delete": ["roles.delete"],
  "roles.delete": ["role.delete"],
  "permission.read": ["permissions.read"],
  "permissions.read": ["permission.read"],
  "permission.assign": ["permissions.manage"],
  "permissions.manage": ["permission.assign"],
  "alarm.ack": ["alarm.acknowledge", "alarm.read"],
  "alarm.acknowledge": ["alarm.ack"],
  "telemetry.read": ["historian.read"],
  "telemetry.export": ["historian.export"],
};

/**
 * Validates whether a principal has a specific atomic permission
 */
export function hasAtomicPermission(
  principal: AuthenticatedPrincipal | null | undefined,
  requiredPermission: AtomicPermission
): boolean {
  if (!principal) return false;
  if (principal.isSuperAdmin && principal.scope === "GLOBAL" && principal.role === "superadmin") {
    return true; // Superadmin has root access across registered permissions
  }
  if (principal.permissions.includes(requiredPermission)) {
    return true;
  }
  const aliases = PERMISSION_EQUIVALENTS[requiredPermission] || [];
  return aliases.some((alias) => principal.permissions.includes(alias as AtomicPermission));
}

/**
 * Validates Superadmin criteria: Must satisfy role=superadmin, scope=GLOBAL, isSuperAdmin=true
 * A tenantId=GLOBAL alone without role=superadmin is strictly rejected (prevents privilege escalation).
 */
export function validateSuperAdminIntegrity(principal: {
  role?: string;
  tenantId?: string;
  scope?: string;
  isSuperAdmin?: boolean;
}): boolean {
  if (!principal) return false;
  const isRoleSuperAdmin = principal.role === "superadmin";
  const isScopeGlobal = principal.tenantId === "GLOBAL" || principal.scope === "GLOBAL";
  const isFlagTrue = principal.isSuperAdmin === true;

  // Strict conjunction: Must satisfy ALL three conditions
  return isRoleSuperAdmin && isScopeGlobal && isFlagTrue;
}
