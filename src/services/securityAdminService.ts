import { UserAccount, RbacRoleDefinition, AuditLogEntry } from "../types";
import {
  PermissionCatalogItem,
  AccessScopeAssignment,
  UserSessionRecord,
  EffectivePermissionRecord,
  CANONICAL_PERMISSION_CATALOG,
  ROLE_ATOMIC_PERMISSIONS,
} from "../types/securityPrincipal";
import { auth } from "./firebase";
import {
  createUserInDb,
  updateUserInDb,
  deleteUserInDb,
  createRoleInDb,
  updateRoleInDb,
  deleteRoleInDb,
  logAuditEventToDb,
} from "./dbService";
import { PREDEFINED_USERS } from "./authService";
import { DEFAULT_ROLES } from "./rbacService";

async function getAuthHeader(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (_e) {
    // Proceed without token
  }
  return headers;
}

export class SecurityAdminService {
  // Local fallback caches for offline / direct browser mode
  private static localUsers = [...PREDEFINED_USERS];
  private static localRoles = [...DEFAULT_ROLES];
  private static localAssignments: AccessScopeAssignment[] = [
    {
      id: "asg-01",
      userId: "usr-superadmin",
      userName: "Ing. Dernys (Super Administrador)",
      userEmail: "ing.dernys@gmail.com",
      roleId: "role-superadmin",
      role: "superadmin",
      tenantId: "GLOBAL",
      scopeType: "GLOBAL",
      assignedAt: "2026-01-01T00:00:00Z",
      assignedBy: "SYSTEM_ROOT",
      status: "ACTIVE",
    },
    {
      id: "asg-02",
      userId: "usr-admin-01",
      userName: "Ing. Laura Silva (Gerente de Planta)",
      userEmail: "admin@bioazucar.com",
      roleId: "role-administrador",
      role: "administrador",
      tenantId: "BIOAZUCAR-DEMO",
      plantId: "planta-principal",
      scopeType: "PLANT",
      assignedAt: "2026-01-01T00:00:00Z",
      assignedBy: "usr-superadmin",
      status: "ACTIVE",
    },
    {
      id: "asg-03",
      userId: "usr-sup-01",
      userName: "Ing. Carlos Mendoza (Jefe de Turno A)",
      userEmail: "supervisor@bioazucar.com",
      roleId: "role-supervisor",
      role: "supervisor",
      tenantId: "BIOAZUCAR-DEMO",
      plantId: "planta-principal",
      areaId: "tandem-molienda",
      scopeType: "AREA",
      assignedAt: "2026-01-01T00:00:00Z",
      assignedBy: "usr-admin-01",
      status: "ACTIVE",
    },
  ];
  private static localSessions: UserSessionRecord[] = [
    {
      id: "sess-sa-01",
      userId: "usr-superadmin",
      userName: "Ing. Dernys (Super Administrador)",
      userEmail: "ing.dernys@gmail.com",
      tenantId: "GLOBAL",
      ipAddress: "192.168.10.15",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133.0 BioAzucarSCADA/4.0",
      device: "Estación de Ingeniería Central #01",
      browser: "Chrome SCADA Shell",
      os: "Industrial Linux 6.6 LTS",
      startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      lastActiveAt: new Date().toISOString(),
      status: "ACTIVE",
      authAssurance: "AAL3",
    },
    {
      id: "sess-adm-01",
      userId: "usr-admin-01",
      userName: "Ing. Laura Silva (Gerente de Planta)",
      userEmail: "admin@bioazucar.com",
      tenantId: "BIOAZUCAR-DEMO",
      ipAddress: "192.168.10.42",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/132.0",
      device: "Terminal Gerencia Planta",
      browser: "Microsoft Edge",
      os: "Windows 11 Enterprise LTSC",
      startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      lastActiveAt: new Date(Date.now() - 60000 * 12).toISOString(),
      status: "ACTIVE",
      authAssurance: "AAL2",
    },
    {
      id: "sess-op-01",
      userId: "usr-op-01",
      userName: "Roberto Gómez (Operador Sala DCS)",
      userEmail: "operador@bioazucar.com",
      tenantId: "BIOAZUCAR-DEMO",
      ipAddress: "10.0.12.105",
      userAgent: "IndustrialDCSClient/4.0 (Console 03)",
      device: "Pupitre Operador Sala DCS - Consola 03",
      browser: "DCS Kiosk Embedded",
      os: "Debian 12 RT-Preempt",
      startedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      lastActiveAt: new Date(Date.now() - 60000 * 2).toISOString(),
      status: "ACTIVE",
      authAssurance: "AAL2",
    },
  ];

  // ----------------------------------------------------
  // USERS
  // ----------------------------------------------------

  public static async fetchUsers(tenantId?: string): Promise<UserAccount[]> {
    try {
      const headers = await getAuthHeader();
      const url = tenantId ? `/api/security/users?tenantId=${tenantId}` : "/api/security/users";
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.users && Array.isArray(data.users)) {
          this.localUsers = data.users;
          return data.users;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return this.localUsers;
  }

  public static async createUser(
    userData: Omit<UserAccount, "id">,
    actor: UserAccount
  ): Promise<UserAccount> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/security/users", {
        method: "POST",
        headers,
        body: JSON.stringify(userData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.localUsers.push(data.user);
          return data.user;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) throw new Error(errData.error);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) {
        throw err;
      }
    }

    // Direct Firestore / Local fallback
    const id = await createUserInDb(userData, actor);
    const created: UserAccount = { ...userData, id };
    this.localUsers.push(created);
    return created;
  }

  public static async updateUser(
    userId: string,
    updates: Partial<UserAccount>,
    actor: UserAccount
  ): Promise<UserAccount> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/users/${userId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const idx = this.localUsers.findIndex((u) => u.id === userId);
          if (idx >= 0) this.localUsers[idx] = data.user;
          return data.user;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) throw new Error(errData.error);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) {
        throw err;
      }
    }

    // Direct Firestore / Local fallback
    await updateUserInDb(userId, updates, actor);
    const idx = this.localUsers.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      this.localUsers[idx] = { ...this.localUsers[idx], ...updates };
      return this.localUsers[idx];
    }
    return { ...updates, id: userId } as UserAccount;
  }

  public static async toggleUserStatus(
    userId: string,
    targetStatus: "ACTIVE" | "INACTIVE" | "LOCKED",
    actor: UserAccount
  ): Promise<UserAccount> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/users/${userId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const idx = this.localUsers.findIndex((u) => u.id === userId);
          if (idx >= 0) this.localUsers[idx] = data.user;
          return data.user;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) throw new Error(errData.error);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) {
        throw err;
      }
    }

    const isActive = targetStatus === "ACTIVE";
    return this.updateUser(userId, { status: targetStatus, isActive }, actor);
  }

  public static async resetUserAccess(
    userId: string,
    actor: UserAccount
  ): Promise<{ tempToken: string; expiresAt: string }> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/users/${userId}/reset-access`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      if (err.error) throw new Error(err.error);
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) throw err;
    }

    const tempToken = "BIOAZUCAR-OTP-" + Math.floor(100000 + Math.random() * 900000);
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    await logAuditEventToDb({
      tenantId: actor.tenantId || "GLOBAL",
      userRole: actor.role,
      userName: actor.name,
      action: "RESTABLECER_ACCESO_USUARIO",
      module: "Seguridad & IAM",
      targetId: userId,
      newValue: `Acceso temporal generado. Expira: ${expiresAt}`,
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
    });

    return { tempToken, expiresAt };
  }

  public static async deleteUser(userId: string, actor: UserAccount): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/users/${userId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        this.localUsers = this.localUsers.filter((u) => u.id !== userId);
        return;
      }
      const err = await res.json().catch(() => ({}));
      if (err.error) throw new Error(err.error);
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) throw err;
    }

    await deleteUserInDb(userId, actor);
    this.localUsers = this.localUsers.filter((u) => u.id !== userId);
  }

  // ----------------------------------------------------
  // ROLES
  // ----------------------------------------------------

  public static async fetchRoles(tenantId?: string): Promise<RbacRoleDefinition[]> {
    try {
      const headers = await getAuthHeader();
      const url = tenantId ? `/api/security/roles?tenantId=${tenantId}` : "/api/security/roles";
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.roles && Array.isArray(data.roles)) {
          this.localRoles = data.roles;
          return data.roles;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return this.localRoles;
  }

  public static async createRole(
    roleData: Omit<RbacRoleDefinition, "id">,
    actor: UserAccount
  ): Promise<RbacRoleDefinition> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/security/roles", {
        method: "POST",
        headers,
        body: JSON.stringify(roleData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.role) {
          this.localRoles.push(data.role);
          return data.role;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error) throw new Error(err.error);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) throw err;
    }

    const id = await createRoleInDb(roleData, actor);
    const created: RbacRoleDefinition = { ...roleData, id };
    this.localRoles.push(created);
    return created;
  }

  public static async duplicateRole(
    roleId: string,
    newTitle: string,
    actor: UserAccount
  ): Promise<RbacRoleDefinition> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/roles/${roleId}/duplicate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ newTitle }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.role) {
          this.localRoles.push(data.role);
          return data.role;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error) throw new Error(err.error);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) throw err;
    }

    const source = this.localRoles.find((r) => r.id === roleId || r.role === roleId);
    if (!source) throw new Error(`Rol base ${roleId} no encontrado`);

    const copyData: Omit<RbacRoleDefinition, "id"> = {
      ...source,
      title: newTitle || `${source.title} (Copia)`,
      description: `Clonado de ${source.title}. ${source.description}`,
      isSystem: false,
    };
    return this.createRole(copyData, actor);
  }

  public static async updateRole(
    roleId: string,
    updates: Partial<RbacRoleDefinition>,
    actor: UserAccount
  ): Promise<RbacRoleDefinition> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/roles/${roleId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.role) {
          const idx = this.localRoles.findIndex((r) => r.id === roleId);
          if (idx >= 0) this.localRoles[idx] = data.role;
          return data.role;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error) throw new Error(err.error);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) throw err;
    }

    await updateRoleInDb(roleId, updates, actor);
    const idx = this.localRoles.findIndex((r) => r.id === roleId);
    if (idx >= 0) {
      this.localRoles[idx] = { ...this.localRoles[idx], ...updates };
      return this.localRoles[idx];
    }
    return { ...updates, id: roleId } as RbacRoleDefinition;
  }

  public static async deleteRole(roleId: string, actor: UserAccount): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/roles/${roleId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        this.localRoles = this.localRoles.filter((r) => r.id !== roleId);
        return;
      }
      const err = await res.json().catch(() => ({}));
      if (err.error) throw new Error(err.error);
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) throw err;
    }

    await deleteRoleInDb(roleId, actor);
    this.localRoles = this.localRoles.filter((r) => r.id !== roleId);
  }

  // ----------------------------------------------------
  // PERMISSIONS & EFFECTIVE PERMISSIONS
  // ----------------------------------------------------

  public static async fetchPermissionCatalog(): Promise<PermissionCatalogItem[]> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/security/permissions", { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.catalog && Array.isArray(data.catalog)) {
          return data.catalog;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return CANONICAL_PERMISSION_CATALOG;
  }

  public static async fetchEffectivePermissions(userId: string): Promise<EffectivePermissionRecord[]> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/security/effective-permissions/${userId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.effectivePermissions) {
          return data.effectivePermissions;
        }
      }
    } catch (_err) {
      // Fallback calculation
    }

    const user = this.localUsers.find((u) => u.id === userId);
    if (!user) return [];

    const isSuper = user.role === "superadmin" || Boolean(user.isSuperAdmin);
    const roleDef = this.localRoles.find((r) => r.role === user.role);
    const permissionsSet = new Set(roleDef?.permissions || ROLE_ATOMIC_PERMISSIONS[user.role] || []);

    return CANONICAL_PERMISSION_CATALOG.map((perm) => {
      const isGrantedByRole = permissionsSet.has(perm.key);
      const isGranted = isSuper || isGrantedByRole;
      return {
        permission: perm.key,
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        scope: isSuper ? "GLOBAL" : user.tenantId || "TENANT",
        sourceRole: isSuper ? "superadmin" : isGrantedByRole ? (roleDef?.title || user.role) : "Ninguno",
        riskLevel: perm.riskLevel,
        module: perm.module,
        granted: isGranted,
        reason: isSuper
          ? "Acceso global concedido por Rol SuperAdmin Global"
          : isGranted
          ? `Otorgado mediante membresía en rol "${roleDef?.title || user.role}"`
          : "Permiso no concedido por política RBAC",
      };
    });
  }

  // ----------------------------------------------------
  // ACCESS ASSIGNMENTS & SCOPES
  // ----------------------------------------------------

  public static async fetchAssignments(tenantId?: string): Promise<AccessScopeAssignment[]> {
    try {
      const headers = await getAuthHeader();
      const url = tenantId ? `/api/security/assignments?tenantId=${tenantId}` : "/api/security/assignments";
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.assignments && Array.isArray(data.assignments)) {
          this.localAssignments = data.assignments;
          return data.assignments;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return this.localAssignments;
  }

  public static async createAssignment(
    assignment: Omit<AccessScopeAssignment, "id" | "assignedAt">
  ): Promise<AccessScopeAssignment> {
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/security/assignments", {
        method: "POST",
        headers,
        body: JSON.stringify(assignment),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.assignment) {
          this.localAssignments.push(data.assignment);
          return data.assignment;
        }
      }
    } catch (_err) {
      // Fallback
    }

    const created: AccessScopeAssignment = {
      ...assignment,
      id: `asg-${Date.now().toString(36)}`,
      assignedAt: new Date().toISOString(),
      status: "ACTIVE",
    };
    this.localAssignments.push(created);
    return created;
  }

  public static async deleteAssignment(assignmentId: string): Promise<void> {
    try {
      const headers = await getAuthHeader();
      await fetch(`/api/security/assignments/${assignmentId}`, {
        method: "DELETE",
        headers,
      });
    } catch (_err) {
      // Fallback
    }
    this.localAssignments = this.localAssignments.filter((a) => a.id !== assignmentId);
  }

  // ----------------------------------------------------
  // SESSIONS
  // ----------------------------------------------------

  public static async fetchSessions(tenantId?: string): Promise<UserSessionRecord[]> {
    try {
      const headers = await getAuthHeader();
      const url = tenantId ? `/api/security/sessions?tenantId=${tenantId}` : "/api/security/sessions";
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          this.localSessions = data.sessions;
          return data.sessions;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return this.localSessions;
  }

  public static async revokeSession(sessionId: string): Promise<void> {
    try {
      const headers = await getAuthHeader();
      await fetch("/api/security/sessions/revoke", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId }),
      });
    } catch (_err) {
      // Fallback
    }
    const s = this.localSessions.find((sess) => sess.id === sessionId);
    if (s) {
      s.status = "REVOKED";
      s.revokedAt = new Date().toISOString();
    }
  }

  public static async revokeAllSessions(userId: string): Promise<number> {
    let count = 0;
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/security/sessions/revoke-all", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        count = data.revokedCount || 0;
      }
    } catch (_err) {
      // Fallback
    }

    const now = new Date().toISOString();
    this.localSessions.forEach((s) => {
      if (s.userId === userId && s.status === "ACTIVE") {
        s.status = "REVOKED";
        s.revokedAt = now;
        count++;
      }
    });

    return count;
  }

  // ----------------------------------------------------
  // IAM AUDIT TRAIL
  // ----------------------------------------------------

  public static async fetchAuditTrail(tenantId?: string): Promise<AuditLogEntry[]> {
    try {
      const headers = await getAuthHeader();
      const url = tenantId ? `/api/security/audit-trail?tenantId=${tenantId}` : "/api/security/audit-trail";
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.auditTrail && Array.isArray(data.auditTrail)) {
          return data.auditTrail;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return [];
  }
}
