import { describe, it, expect, beforeEach } from "vitest";
import { SecurityAdminBackendService } from "../server/securityAdminBackendService";
import {
  AtomicPermission,
  CANONICAL_PERMISSION_CATALOG,
  ROLE_ATOMIC_PERMISSIONS,
  hasAtomicPermission,
  validateSuperAdminIntegrity,
} from "../types/securityPrincipal";

describe("BioAzúcar 4.0 — Consola de Seguridad IAM & Gobierno de Autorización", () => {
  beforeEach(() => {
    SecurityAdminBackendService.initializeDefaults();
  });

  describe("1. Catálogo Canónico de Permisos Atómicos (§7)", () => {
    it("debe contener el catálogo canónico completo con más de 30 permisos industriales", () => {
      const catalog = SecurityAdminBackendService.getPermissionCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(30);

      const keys = catalog.map((p) => p.key);
      expect(keys).toContain("user.read");
      expect(keys).toContain("user.create");
      expect(keys).toContain("user.disable");
      expect(keys).toContain("user.delete");
      expect(keys).toContain("role.read");
      expect(keys).toContain("role.create");
      expect(keys).toContain("role.delete");
      expect(keys).toContain("permission.read");
      expect(keys).toContain("permission.assign");
      expect(keys).toContain("plant.read");
      expect(keys).toContain("plant.configure");
      expect(keys).toContain("setpoint.read");
      expect(keys).toContain("setpoint.write");
      expect(keys).toContain("alarm.ack");
      expect(keys).toContain("alarm.shelve");
      expect(keys).toContain("audit.read");
    });

    it("cada permiso del catálogo debe tener recurso, acción, módulo y nivel de riesgo", () => {
      const catalog = SecurityAdminBackendService.getPermissionCatalog();
      catalog.forEach((perm) => {
        expect(perm.key).toBeDefined();
        expect(perm.name).toBeDefined();
        expect(perm.resource).toBeDefined();
        expect(perm.action).toBeDefined();
        expect(perm.module).toBeDefined();
        expect(["BAJO", "MEDIO", "ALTO", "CRITICO"]).toContain(perm.riskLevel);
      });
    });

    it("debe soportar equivalencias y alias de permisos atómicos", () => {
      const principal = {
        uid: "test-user-01",
        email: "op@bioazucar.com",
        tenantId: "TENANT-01",
        membershipId: "mem-01",
        roleId: "role-operador",
        role: "operador",
        permissions: ["user.read", "alarm.ack"] as AtomicPermission[],
        isSuperAdmin: false,
        securityLevel: 2,
        authenticationAssurance: "AAL2" as const,
        scope: "TENANT" as const,
      };

      expect(hasAtomicPermission(principal, "user.read")).toBe(true);
      expect(hasAtomicPermission(principal, "users.read" as any)).toBe(true);
      expect(hasAtomicPermission(principal, "alarm.ack")).toBe(true);
      expect(hasAtomicPermission(principal, "alarm.acknowledge" as any)).toBe(true);
      expect(hasAtomicPermission(principal, "user.delete")).toBe(false);
    });
  });

  describe("2. Administración de Usuarios & Acciones de Seguridad (§5)", () => {
    const adminActor = {
      uid: "usr-admin-01",
      email: "admin@bioazucar.com",
      role: "administrador",
      isSuperAdmin: false,
      tenantId: "BIOAZUCAR-DEMO",
    };

    const superAdminActor = {
      uid: "usr-superadmin",
      email: "ing.dernys@gmail.com",
      role: "superadmin",
      isSuperAdmin: true,
      tenantId: "GLOBAL",
    };

    it("debe listar usuarios respetando el aislamiento multi-tenant para administradores locales", async () => {
      const tenantUsers = await SecurityAdminBackendService.getUsers("BIOAZUCAR-DEMO", false);
      tenantUsers.forEach((u) => {
        expect(["BIOAZUCAR-DEMO", "GLOBAL"]).toContain(u.tenantId);
      });
    });

    it("debe permitir al SuperAdmin ver todos los usuarios del clúster", async () => {
      const allUsers = await SecurityAdminBackendService.getUsers("GLOBAL", true);
      expect(allUsers.length).toBeGreaterThanOrEqual(4);
    });

    it("debe crear un nuevo usuario y persistirlo en la lista", async () => {
      const newUser = await SecurityAdminBackendService.createUser(
        {
          name: "Carlos",
          lastName: "Pérez",
          email: "cperez@bioazucar.com",
          role: "operador",
          securityLevel: 2,
          department: "Molienda",
          badgeCode: "OP-999",
          tenantId: "BIOAZUCAR-DEMO",
        },
        adminActor
      );

      expect(newUser.id).toBeDefined();
      expect(newUser.name).toBe("Carlos");
      expect(newUser.isActive).toBe(true);
      expect(newUser.status).toBe("ACTIVE");

      const users = await SecurityAdminBackendService.getUsers("BIOAZUCAR-DEMO", false);
      expect(users.some((u) => u.email === "cperez@bioazucar.com")).toBe(true);
    });

    it("debe impedir que un administrador local cree un SuperAdmin o con scope GLOBAL (Escalada de privilegios)", async () => {
      await expect(
        SecurityAdminBackendService.createUser(
          {
            name: "Hacker",
            email: "hacker@bioazucar.com",
            role: "superadmin",
            securityLevel: 5,
            department: "Root",
            badgeCode: "SA-999",
            tenantId: "GLOBAL",
          },
          adminActor
        )
      ).rejects.toThrow("Violación de Seguridad");
    });

    it("debe permitir cambiar de estado (Activar / Desactivar / Bloquear)", async () => {
      const created = await SecurityAdminBackendService.createUser(
        {
          name: "Operador Temporal",
          email: "optemp@bioazucar.com",
          role: "operador",
          securityLevel: 1,
          department: "Báscula",
          badgeCode: "OP-777",
          tenantId: "BIOAZUCAR-DEMO",
        },
        adminActor
      );

      const disabled = await SecurityAdminBackendService.toggleUserStatus(created.id, "INACTIVE", adminActor);
      expect(disabled.isActive).toBe(false);
      expect(disabled.status).toBe("INACTIVE");

      const locked = await SecurityAdminBackendService.toggleUserStatus(created.id, "LOCKED", adminActor);
      expect(locked.status).toBe("LOCKED");
    });

    it("debe impedir desactivar o eliminar al SuperAdministrador raíz", async () => {
      await expect(
        SecurityAdminBackendService.toggleUserStatus("usr-superadmin", "INACTIVE", adminActor)
      ).rejects.toThrow("SuperAdministrador raíz no puede ser desactivado");

      await expect(
        SecurityAdminBackendService.deleteUser("usr-superadmin", superAdminActor)
      ).rejects.toThrow("SuperAdministrador raíz nunca puede ser eliminado");
    });

    it("debe impedir que un usuario se auto-elimine", async () => {
      await expect(
        SecurityAdminBackendService.deleteUser("usr-admin-01", adminActor)
      ).rejects.toThrow("No puede auto-eliminar");
    });

    it("debe generar un token OTP de reseteo de acceso con caducidad", async () => {
      const reset = await SecurityAdminBackendService.resetUserAccess("usr-admin-01", superAdminActor);
      expect(reset.tempToken).toMatch(/^BIOAZUCAR-OTP-/);
      expect(new Date(reset.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("3. Gestión de Roles & Clonación (§6)", () => {
    const superAdminActor = {
      uid: "usr-superadmin",
      email: "ing.dernys@gmail.com",
      role: "superadmin",
      isSuperAdmin: true,
      tenantId: "GLOBAL",
    };

    it("debe listar los roles existentes incluyendo roles del sistema", async () => {
      const roles = await SecurityAdminBackendService.getRoles("GLOBAL", true);
      const systemRoles = roles.filter((r) => r.isSystem);
      expect(systemRoles.length).toBeGreaterThanOrEqual(4);
      expect(roles.some((r) => r.role === "superadmin")).toBe(true);
      expect(roles.some((r) => r.role === "operador")).toBe(true);
    });

    it("debe permitir crear un nuevo rol personalizado con permisos atómicos", async () => {
      const newRole = await SecurityAdminBackendService.createRole(
        {
          role: "rol_analista_lims" as any,
          title: "Analista de Laboratorio LIMS",
          description: "Análisis de brix, pol y pureza de jugo",
          badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
          securityClearanceLevel: 2,
          canWriteSetpoints: false,
          canAcknowledgeAlarms: true,
          canShelveAlarms: false,
          canCreateWorkOrders: false,
          canApproveWorkOrders: false,
          canChangeDispatchMW: false,
          canExportHistorian: true,
          canAddCaneBatches: true,
          canModifyPlantParams: false,
          canAccessAiCenter: false,
          permissions: ["lims.read", "lims.write", "historian.read"],
        },
        superAdminActor
      );

      expect(newRole.id).toBeDefined();
      expect(newRole.isSystem).toBe(false);
      expect(newRole.permissions).toContain("lims.write");
    });

    it("debe duplicar (clonar) un rol existente preservando sus permisos", async () => {
      const cloned = await SecurityAdminBackendService.duplicateRole(
        "role-operador",
        "Operador de Evaporación Avanzado",
        superAdminActor
      );

      expect(cloned.title).toBe("Operador de Evaporación Avanzado");
      expect(cloned.isSystem).toBe(false);
      expect(cloned.permissions).toEqual(ROLE_ATOMIC_PERMISSIONS["operador"]);
    });

    it("debe proteger los roles del sistema contra eliminación", async () => {
      await expect(
        SecurityAdminBackendService.deleteRole("role-superadmin", superAdminActor)
      ).rejects.toThrow("roles protegidos del sistema no pueden ser eliminados");
    });
  });

  describe("4. Asignaciones de Acceso & Scope (§9)", () => {
    const adminActor = {
      uid: "usr-admin-01",
      email: "admin@bioazucar.com",
      role: "administrador",
      isSuperAdmin: false,
      tenantId: "BIOAZUCAR-DEMO",
    };

    it("debe crear y consultar asignaciones de acceso con delimitación de scope", async () => {
      const asg = await SecurityAdminBackendService.createAssignment(
        {
          userId: "usr-op-01",
          userName: "Roberto Gómez",
          userEmail: "operador@bioazucar.com",
          roleId: "role-operador",
          role: "operador",
          tenantId: "BIOAZUCAR-DEMO",
          plantId: "planta-portuguesa",
          areaId: "tandem-01",
          scopeType: "AREA",
          assignedBy: "admin@bioazucar.com",
          status: "ACTIVE",
        },
        adminActor
      );

      expect(asg.id).toBeDefined();
      expect(asg.scopeType).toBe("AREA");
      expect(asg.plantId).toBe("planta-portuguesa");

      const assignments = await SecurityAdminBackendService.getAssignments("BIOAZUCAR-DEMO", false);
      expect(assignments.some((a) => a.id === asg.id)).toBe(true);

      await SecurityAdminBackendService.deleteAssignment(asg.id, adminActor);
      const afterDelete = await SecurityAdminBackendService.getAssignments("BIOAZUCAR-DEMO", false);
      expect(afterDelete.some((a) => a.id === asg.id)).toBe(false);
    });
  });

  describe("5. Monitor de Sesiones & Revocación Remota (§13)", () => {
    const adminActor = {
      uid: "usr-admin-01",
      email: "admin@bioazucar.com",
      role: "administrador",
      isSuperAdmin: false,
      tenantId: "BIOAZUCAR-DEMO",
    };

    it("debe listar las sesiones activas en salas de control", async () => {
      const sessions = await SecurityAdminBackendService.getSessions("BIOAZUCAR-DEMO", false);
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      const active = sessions.filter((s) => s.status === "ACTIVE");
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it("debe revocar una sesión individual", async () => {
      const sessions = await SecurityAdminBackendService.getSessions("BIOAZUCAR-DEMO", false);
      const targetSession = sessions.find((s) => s.status === "ACTIVE");
      expect(targetSession).toBeDefined();

      await SecurityAdminBackendService.revokeSession(targetSession!.id, adminActor);
      const updatedSessions = await SecurityAdminBackendService.getSessions("BIOAZUCAR-DEMO", false);
      const revoked = updatedSessions.find((s) => s.id === targetSession!.id);
      expect(revoked?.status).toBe("REVOKED");
    });

    it("debe revocar todas las sesiones de un usuario", async () => {
      const revokedCount = await SecurityAdminBackendService.revokeAllSessionsForUser("usr-op-01", adminActor);
      expect(revokedCount).toBeGreaterThanOrEqual(0);

      const sessions = await SecurityAdminBackendService.getSessions("BIOAZUCAR-DEMO", false);
      const activeUserSessions = sessions.filter((s) => s.userId === "usr-op-01" && s.status === "ACTIVE");
      expect(activeUserSessions.length).toBe(0);
    });
  });

  describe("6. Cálculo de Permisos Efectivos (§12)", () => {
    it("debe calcular los permisos efectivos de un operador indicando qué puede y no puede hacer", async () => {
      const perms = await SecurityAdminBackendService.getEffectivePermissionsForUser("usr-op-01");
      expect(perms.length).toBeGreaterThan(20);

      const canAckAlarm = perms.find((p) => p.permission === "alarm.ack");
      expect(canAckAlarm?.granted).toBe(true);

      const canDeleteTenant = perms.find((p) => p.permission === "tenant.delete");
      expect(canDeleteTenant?.granted).toBe(false);
    });

    it("debe conceder acceso irrestricto al SuperAdmin en todos los permisos efectivos", async () => {
      const perms = await SecurityAdminBackendService.getEffectivePermissionsForUser("usr-superadmin");
      perms.forEach((p) => {
        expect(p.granted).toBe(true);
        expect(p.scope).toContain("GLOBAL");
      });
    });
  });
});
