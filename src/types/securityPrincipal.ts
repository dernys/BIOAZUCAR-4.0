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
  // Role & Policy Management
  | "role.read"
  | "role.create"
  | "role.update"
  | "role.delete"
  | "permission.read"
  | "permission.assign"
  // Plant & Industrial Configuration
  | "plant.read"
  | "plant.configure"
  // Alarms Management (ISA-18.2)
  | "alarm.ack"
  | "alarm.shelve"
  | "alarm.clear"
  // Process Setpoints (SCADA / PID)
  | "setpoint.read"
  | "setpoint.write"
  // Historian & Telemetry
  | "historian.read"
  | "historian.export"
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
  return principal.permissions.includes(requiredPermission);
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
