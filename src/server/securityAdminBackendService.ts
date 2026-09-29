import crypto from "crypto";
import { getAdminFirestore } from "./firebaseAdmin";
import { systemLogger } from "../services/logger/IndustrialLogger";
import { UserAccount, RbacRoleDefinition, UserRole } from "../types";
import {
  AtomicPermission,
  CANONICAL_PERMISSION_CATALOG,
  PermissionCatalogItem,
  AccessScopeAssignment,
  UserSessionRecord,
  EffectivePermissionRecord,
  ROLE_ATOMIC_PERMISSIONS,
} from "../types/securityPrincipal";
import { DEFAULT_ROLES } from "../services/rbacService";
import { PREDEFINED_USERS } from "../services/authService";
import { logServerAuditEventAsync } from "./authMiddleware";

export class SecurityAdminBackendService {
  // In-memory fallback and synchronization cache
  private static usersMap = new Map<string, UserAccount>();
  private static rolesMap = new Map<string, RbacRoleDefinition>();
  private static assignmentsMap = new Map<string, AccessScopeAssignment>();
  private static sessionsMap = new Map<string, UserSessionRecord>();
  private static initialized = false;

  public static initializeDefaults(): void {
    if (this.initialized) return;

    // Seed predefined users
    PREDEFINED_USERS.forEach((u) => {
      const user: UserAccount = {
        ...u,
        isActive: true,
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        scope: u.role === "superadmin" ? "GLOBAL" : "TENANT",
      };
      this.usersMap.set(user.id, user);
    });

    // Seed default roles
    DEFAULT_ROLES.forEach((r) => {
      const roleDef: RbacRoleDefinition = {
        ...r,
        permissions: ROLE_ATOMIC_PERMISSIONS[r.role] || [],
        scope: r.role === "superadmin" ? "GLOBAL" : "TENANT",
        isActive: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      this.rolesMap.set(roleDef.id || `role-${r.role}`, roleDef);
    });

    // Seed initial sample sessions
    const initialSessions: UserSessionRecord[] = [
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

    initialSessions.forEach((s) => this.sessionsMap.set(s.id, s));

    // Seed initial sample access scope assignments
    const initialAssignments: AccessScopeAssignment[] = [
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

    initialAssignments.forEach((a) => this.assignmentsMap.set(a.id, a));

    this.initialized = true;
  }

  // ==========================================
  // USERS MANAGEMENT
  // ==========================================

  public static async getUsers(tenantId: string, isSuperAdmin: boolean): Promise<UserAccount[]> {
    this.initializeDefaults();
    try {
      const db = getAdminFirestore();
      const snapshot = await db.collection("users").get();
      if (!snapshot.empty) {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserAccount;
          this.usersMap.set(docSnap.id, { ...data, id: docSnap.id });
        });
      }
    } catch (_err) {
      // Fallback to in-memory map
    }

    const all = Array.from(this.usersMap.values());
    if (isSuperAdmin) {
      return all;
    }
    return all.filter((u) => u.tenantId === tenantId || u.tenantId === "GLOBAL");
  }

  public static async createUser(
    userData: Omit<UserAccount, "id">,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<UserAccount> {
    this.initializeDefaults();

    // Prevent privilege escalation: only Superadmin can create superadmin or GLOBAL users
    if ((userData.role === "superadmin" || userData.isSuperAdmin || userData.tenantId === "GLOBAL") && !actor.isSuperAdmin) {
      throw new Error("Violación de Seguridad: Únicamente el SuperAdministrador Global puede crear cuentas con privilegios de nivel 5 o scope GLOBAL.");
    }

    const userId = `usr-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const newUser: UserAccount = {
      ...userData,
      id: userId,
      status: userData.status || "ACTIVE",
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      lastLogin: "Nunca",
      createdAt: now,
      updatedAt: now,
    };

    this.usersMap.set(userId, newUser);

    try {
      const db = getAdminFirestore();
      await db.collection("users").doc(userId).set(newUser);
    } catch (_err) {
      // Disk/memory persisted
    }

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || userData.tenantId,
      action: "USER_CREATED",
      resource: "users",
      result: "SUCCESS",
      severity: "INFO",
      metadata: { createdUserId: userId, createdUserEmail: newUser.email, role: newUser.role, tenantId: newUser.tenantId },
    });

    return newUser;
  }

  public static async updateUser(
    userId: string,
    updates: Partial<UserAccount>,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<UserAccount> {
    this.initializeDefaults();
    const existing = this.usersMap.get(userId);
    if (!existing) {
      throw new Error(`Usuario con ID ${userId} no encontrado.`);
    }

    // Tenant isolation: non-superadmin cannot modify other tenants' users
    if (!actor.isSuperAdmin && existing.tenantId !== actor.tenantId && existing.tenantId !== "GLOBAL") {
      throw new Error("Violación de Aislamiento: No tiene autorización para modificar usuarios de otra empresa.");
    }

    // Protection of Root SuperAdmin
    if ((existing.id === "usr-superadmin" || existing.email === "ing.dernys@gmail.com") && !actor.isSuperAdmin) {
      throw new Error("Seguridad Crítica: El usuario SuperAdministrador raíz solo puede ser administrado por sí mismo.");
    }

    const updatedUser: UserAccount = {
      ...existing,
      ...updates,
      id: userId,
      updatedAt: new Date().toISOString(),
    };

    this.usersMap.set(userId, updatedUser);

    try {
      const db = getAdminFirestore();
      await db.collection("users").doc(userId).update(updates);
    } catch (_err) {
      // In-memory updated
    }

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || existing.tenantId,
      action: "USER_UPDATED",
      resource: "users",
      result: "SUCCESS",
      severity: "INFO",
      metadata: { targetUserId: userId, updatedFields: Object.keys(updates) },
    });

    return updatedUser;
  }

  public static async toggleUserStatus(
    userId: string,
    targetStatus: "ACTIVE" | "INACTIVE" | "LOCKED",
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<UserAccount> {
    this.initializeDefaults();
    const existing = this.usersMap.get(userId);
    if (!existing) {
      throw new Error(`Usuario ${userId} no encontrado.`);
    }

    if (existing.id === "usr-superadmin" || existing.email === "ing.dernys@gmail.com") {
      throw new Error("Seguridad Crítica: El SuperAdministrador raíz no puede ser desactivado o bloqueado.");
    }

    if (actor.uid === userId && targetStatus !== "ACTIVE") {
      throw new Error("Seguridad Preventiva: No puede desactivar o bloquear su propia cuenta activa.");
    }

    const isActive = targetStatus === "ACTIVE";
    const updated = await this.updateUser(userId, { status: targetStatus, isActive }, actor);

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || existing.tenantId,
      action: targetStatus === "ACTIVE" ? "USER_ENABLED" : "USER_DISABLED",
      resource: "users",
      result: "SUCCESS",
      severity: "WARNING",
      metadata: { targetUserId: userId, status: targetStatus },
    });

    return updated;
  }

  public static async deleteUser(
    userId: string,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<void> {
    this.initializeDefaults();
    const existing = this.usersMap.get(userId);
    if (!existing) {
      throw new Error(`Usuario ${userId} no encontrado.`);
    }

    if (existing.id === "usr-superadmin" || existing.email === "ing.dernys@gmail.com") {
      throw new Error("Seguridad Crítica: El SuperAdministrador raíz nunca puede ser eliminado del clúster.");
    }

    if (actor.uid === userId) {
      throw new Error("Seguridad Preventiva: No puede auto-eliminar su propia cuenta de administrador.");
    }

    if (!actor.isSuperAdmin && existing.tenantId !== actor.tenantId) {
      throw new Error("Violación de Aislamiento: No puede eliminar usuarios de otra empresa.");
    }

    this.usersMap.delete(userId);

    // Revoke any active sessions
    Array.from(this.sessionsMap.values())
      .filter((s) => s.userId === userId)
      .forEach((s) => this.sessionsMap.delete(s.id));

    try {
      const db = getAdminFirestore();
      await db.collection("users").doc(userId).delete();
    } catch (_err) {
      // In-memory deleted
    }

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || existing.tenantId,
      action: "USER_DELETED",
      resource: "users",
      result: "SUCCESS",
      severity: "CRITICAL",
      metadata: { deletedUserId: userId, deletedEmail: existing.email },
    });
  }

  public static async resetUserAccess(
    userId: string,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<{ tempToken: string; expiresAt: string }> {
    this.initializeDefaults();
    const existing = this.usersMap.get(userId);
    if (!existing) {
      throw new Error(`Usuario ${userId} no encontrado.`);
    }

    const tempToken = "BIOAZUCAR-OTP-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || existing.tenantId,
      action: "USER_ACCESS_RESET",
      resource: "users",
      result: "SUCCESS",
      severity: "INFO",
      metadata: { targetUserId: userId, expiresAt },
    });

    return { tempToken, expiresAt };
  }

  // ==========================================
  // ROLES MANAGEMENT
  // ==========================================

  public static async getRoles(tenantId: string, isSuperAdmin: boolean): Promise<RbacRoleDefinition[]> {
    this.initializeDefaults();
    try {
      const db = getAdminFirestore();
      const snapshot = await db.collection("roles").get();
      if (!snapshot.empty) {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as RbacRoleDefinition;
          this.rolesMap.set(docSnap.id, { ...data, id: docSnap.id });
        });
      }
    } catch (_err) {
      // Fallback
    }

    const all = Array.from(this.rolesMap.values());
    if (isSuperAdmin) return all;
    return all.filter((r) => !r.tenantId || r.tenantId === "GLOBAL" || r.tenantId === tenantId);
  }

  public static async createRole(
    roleData: Omit<RbacRoleDefinition, "id">,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<RbacRoleDefinition> {
    this.initializeDefaults();

    if (roleData.securityClearanceLevel >= 5 && !actor.isSuperAdmin) {
      throw new Error("Violación de Seguridad: Solo el Superadministrador puede crear roles con nivel 5 (Clearance Root).");
    }

    const roleKey = ("rol_" + roleData.title.toLowerCase().replace(/[^a-z0-9]/g, "_")).slice(0, 30) as UserRole;
    const roleId = `role-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

    const newRole: RbacRoleDefinition = {
      ...roleData,
      id: roleId,
      role: roleKey,
      isSystem: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      tenantId: roleData.tenantId || actor.tenantId || "GLOBAL",
    };

    this.rolesMap.set(roleId, newRole);

    try {
      const db = getAdminFirestore();
      await db.collection("roles").doc(roleId).set(newRole);
    } catch (_err) {
      // In-memory
    }

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || newRole.tenantId,
      action: "ROLE_CREATED",
      resource: "roles",
      result: "SUCCESS",
      severity: "WARNING",
      metadata: { roleId, title: newRole.title, permissionsCount: newRole.permissions?.length || 0 },
    });

    return newRole;
  }

  public static async duplicateRole(
    roleId: string,
    newTitle: string,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<RbacRoleDefinition> {
    this.initializeDefaults();
    const sourceRole = this.rolesMap.get(roleId);
    if (!sourceRole) {
      throw new Error(`Rol de origen ${roleId} no encontrado.`);
    }

    const duplicatedData: Omit<RbacRoleDefinition, "id"> = {
      ...sourceRole,
      title: newTitle || `${sourceRole.title} (Copia)`,
      description: `Clonado a partir de ${sourceRole.title}. ${sourceRole.description}`,
      isSystem: false,
      tenantId: actor.isSuperAdmin ? sourceRole.tenantId : actor.tenantId,
    };

    return this.createRole(duplicatedData, actor);
  }

  public static async updateRole(
    roleId: string,
    updates: Partial<RbacRoleDefinition>,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<RbacRoleDefinition> {
    this.initializeDefaults();
    const existing = this.rolesMap.get(roleId);
    if (!existing) {
      throw new Error(`Rol ${roleId} no encontrado.`);
    }

    if (existing.isSystem && !actor.isSuperAdmin) {
      throw new Error("Seguridad Crítica: Los roles de fábrica del sistema están protegidos contra modificaciones no autorizadas.");
    }

    const updated: RbacRoleDefinition = {
      ...existing,
      ...updates,
      id: roleId,
      updatedAt: new Date().toISOString(),
    };

    this.rolesMap.set(roleId, updated);

    try {
      const db = getAdminFirestore();
      await db.collection("roles").doc(roleId).update(updates);
    } catch (_err) {
      // In-memory
    }

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || existing.tenantId,
      action: "ROLE_UPDATED",
      resource: "roles",
      result: "SUCCESS",
      severity: "INFO",
      metadata: { roleId, updatedFields: Object.keys(updates) },
    });

    return updated;
  }

  public static async deleteRole(
    roleId: string,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<void> {
    this.initializeDefaults();
    const existing = this.rolesMap.get(roleId);
    if (!existing) {
      throw new Error(`Rol ${roleId} no encontrado.`);
    }

    if (existing.isSystem) {
      throw new Error("Seguridad Crítica: Los roles protegidos del sistema no pueden ser eliminados.");
    }

    this.rolesMap.delete(roleId);

    try {
      const db = getAdminFirestore();
      await db.collection("roles").doc(roleId).delete();
    } catch (_err) {
      // In-memory
    }

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || existing.tenantId,
      action: "ROLE_DELETED",
      resource: "roles",
      result: "SUCCESS",
      severity: "WARNING",
      metadata: { deletedRoleId: roleId, title: existing.title },
    });
  }

  // ==========================================
  // PERMISSIONS CATALOG & EFFECTIVE PERMISSIONS
  // ==========================================

  public static getPermissionCatalog(): PermissionCatalogItem[] {
    return CANONICAL_PERMISSION_CATALOG;
  }

  public static async getEffectivePermissionsForUser(userId: string): Promise<EffectivePermissionRecord[]> {
    this.initializeDefaults();
    const user = this.usersMap.get(userId);
    if (!user) {
      throw new Error(`Usuario ${userId} no encontrado para cálculo de permisos efectivos.`);
    }

    const effectiveList: EffectivePermissionRecord[] = [];
    const isSuper = user.role === "superadmin" || Boolean(user.isSuperAdmin);

    // Get user's primary role definition
    const roleDef = Array.from(this.rolesMap.values()).find((r) => r.role === user.role);
    const rolePermissions = new Set<string>(roleDef?.permissions || ROLE_ATOMIC_PERMISSIONS[user.role] || []);

    // Get scope assignments
    const userAssignments = Array.from(this.assignmentsMap.values()).filter(
      (a) => a.userId === userId && a.status === "ACTIVE"
    );

    const scopeDesc = isSuper
      ? "GLOBAL (Root irrestricto)"
      : userAssignments.length > 0
      ? userAssignments.map((a) => `${a.scopeType}:${a.plantId || a.tenantId}`).join(", ")
      : user.tenantId || "TENANT";

    CANONICAL_PERMISSION_CATALOG.forEach((perm) => {
      const isGrantedByRole = rolePermissions.has(perm.key);
      const isGranted = isSuper || isGrantedByRole;

      effectiveList.push({
        permission: perm.key,
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        scope: isSuper ? "GLOBAL" : scopeDesc,
        sourceRole: isSuper ? "superadmin" : isGrantedByRole ? (roleDef?.title || user.role) : "Ninguno",
        riskLevel: perm.riskLevel,
        module: perm.module,
        granted: isGranted,
        reason: isSuper
          ? "Acceso total concedido por Rol SuperAdmin Global"
          : isGranted
          ? `Otorgado mediante membresía en rol "${roleDef?.title || user.role}"`
          : "Permiso denegado por política RBAC",
      });
    });

    return effectiveList;
  }

  // ==========================================
  // ACCESS ASSIGNMENTS & SCOPE
  // ==========================================

  public static async getAssignments(tenantId: string, isSuperAdmin: boolean): Promise<AccessScopeAssignment[]> {
    this.initializeDefaults();
    const all = Array.from(this.assignmentsMap.values());
    if (isSuperAdmin) return all;
    return all.filter((a) => a.tenantId === tenantId || a.tenantId === "GLOBAL");
  }

  public static async createAssignment(
    data: Omit<AccessScopeAssignment, "id" | "assignedAt">,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<AccessScopeAssignment> {
    this.initializeDefaults();

    const id = `asg-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const newAssignment: AccessScopeAssignment = {
      ...data,
      id,
      assignedAt: new Date().toISOString(),
      status: "ACTIVE",
    };

    this.assignmentsMap.set(id, newAssignment);

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || data.tenantId,
      action: "ROLE_ASSIGNED",
      resource: "assignments",
      result: "SUCCESS",
      severity: "INFO",
      metadata: { assignmentId: id, targetUserId: data.userId, role: data.role, scopeType: data.scopeType },
    });

    return newAssignment;
  }

  public static async deleteAssignment(
    assignmentId: string,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<void> {
    this.initializeDefaults();
    const existing = this.assignmentsMap.get(assignmentId);
    if (!existing) {
      throw new Error(`Asignación ${assignmentId} no encontrada.`);
    }

    this.assignmentsMap.delete(assignmentId);

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || existing.tenantId,
      action: "ROLE_REVOKED",
      resource: "assignments",
      result: "SUCCESS",
      severity: "INFO",
      metadata: { assignmentId, revokedUserId: existing.userId, role: existing.role },
    });
  }

  // ==========================================
  // SESSIONS MANAGEMENT
  // ==========================================

  public static async getSessions(tenantId: string, isSuperAdmin: boolean): Promise<UserSessionRecord[]> {
    this.initializeDefaults();
    const all = Array.from(this.sessionsMap.values());
    if (isSuperAdmin) return all;
    return all.filter((s) => s.tenantId === tenantId || s.tenantId === "GLOBAL");
  }

  public static async revokeSession(
    sessionId: string,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<void> {
    this.initializeDefaults();
    const session = this.sessionsMap.get(sessionId);
    if (!session) {
      throw new Error(`Sesión ${sessionId} no encontrada.`);
    }

    session.status = "REVOKED";
    session.revokedAt = new Date().toISOString();
    session.revokedBy = actor.email || actor.uid || "ADMIN";
    this.sessionsMap.set(sessionId, session);

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || session.tenantId,
      action: "SESSION_REVOKED",
      resource: "sessions",
      result: "SUCCESS",
      severity: "WARNING",
      metadata: { sessionId, targetUserId: session.userId, ipAddress: session.ipAddress },
    });
  }

  public static async revokeAllSessionsForUser(
    targetUserId: string,
    actor: { uid?: string; email?: string; role?: string; isSuperAdmin?: boolean; tenantId?: string }
  ): Promise<number> {
    this.initializeDefaults();
    let count = 0;
    const now = new Date().toISOString();

    for (const [id, session] of this.sessionsMap.entries()) {
      if (session.userId === targetUserId && session.status === "ACTIVE") {
        session.status = "REVOKED";
        session.revokedAt = now;
        session.revokedBy = actor.email || actor.uid || "ADMIN";
        this.sessionsMap.set(id, session);
        count++;
      }
    }

    await logServerAuditEventAsync({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      tenantId: actor.tenantId || "GLOBAL",
      action: "ALL_SESSIONS_REVOKED",
      resource: "sessions",
      result: "SUCCESS",
      severity: "WARNING",
      metadata: { targetUserId, revokedSessionsCount: count },
    });

    return count;
  }
}
