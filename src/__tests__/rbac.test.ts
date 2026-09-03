import { describe, it, expect } from "vitest";
import {
  checkRbacPermission,
  DEFAULT_ROLES,
  getRoleBadgeInfo,
  isSuperAdminUser,
} from "../services/rbacService";
import { UserAccount, UserRole } from "../types";

describe("RBAC & Security Clearances (IEC 62443)", () => {
  it("should allow superadmin full administrative access across all actions", () => {
    const actions = [
      "MODIFY_SETPOINTS",
      "ACKNOWLEDGE_ALARM",
      "SHELVE_ALARM",
      "CLEAR_ALARM",
      "ADD_WORK_ORDER",
      "UPDATE_WORK_ORDER",
      "APPROVE_WORK_ORDER",
      "CHANGE_DISPATCH_MW",
      "EXPORT_HISTORIAN",
      "ADD_CANE_BATCH",
      "MODIFY_PLANT_PARAMS",
      "MANAGE_TENANTS",
      "MANAGE_USERS",
      "RESET_DATABASE",
    ] as const;

    actions.forEach((action) => {
      const res = checkRbacPermission("superadmin", action);
      expect(res.allowed).toBe(true);
      expect(res.rule).toBeDefined();
    });
  });

  it("should restrict operador from managing tenants or modifying plant params", () => {
    const resTenants = checkRbacPermission("operador", "MANAGE_TENANTS");
    expect(resTenants.allowed).toBe(false);
    expect(resTenants.reason).toContain("no tiene permisos");

    const resConfig = checkRbacPermission("operador", "MODIFY_PLANT_PARAMS");
    expect(resConfig.allowed).toBe(false);

    const resReset = checkRbacPermission("operador", "RESET_DATABASE");
    expect(resReset.allowed).toBe(false);
  });

  it("should allow operador to acknowledge alarms and add cane batches", () => {
    const resAck = checkRbacPermission("operador", "ACKNOWLEDGE_ALARM");
    expect(resAck.allowed).toBe(true);

    const resBatch = checkRbacPermission("operador", "ADD_CANE_BATCH");
    expect(resBatch.allowed).toBe(true);
  });

  it("should allow mantenimiento to create work orders and export historian", () => {
    const resAddWO = checkRbacPermission("mantenimiento", "ADD_WORK_ORDER");
    expect(resAddWO.allowed).toBe(true);

    const resApproveWO = checkRbacPermission("mantenimiento", "APPROVE_WORK_ORDER");
    expect(resApproveWO.allowed).toBe(false);

    const resHistorian = checkRbacPermission("mantenimiento", "EXPORT_HISTORIAN");
    expect(resHistorian.allowed).toBe(true);
  });

  it("should verify isSuperAdminUser helper accurately identifies superadmin roles or flags", () => {
    const superAdminAcc: UserAccount = {
      id: "u-1",
      email: "dernys@bioazucar.com",
      name: "Ing. Dernys",
      role: "superadmin",
      tenantId: "GLOBAL",
      department: "Dirección",
      badgeCode: "BIO-001",
      isSuperAdmin: true,
      securityLevel: 5,
    };

    const operatorAcc: UserAccount = {
      id: "u-2",
      email: "operador@bioazucar.com",
      name: "Juan Pérez",
      role: "operador",
      tenantId: "tenant-bioazucar-01",
      department: "Molienda",
      badgeCode: "BIO-045",
      isSuperAdmin: false,
      securityLevel: 2,
    };

    expect(isSuperAdminUser(superAdminAcc)).toBe(true);
    expect(isSuperAdminUser(operatorAcc)).toBe(false);
  });

  it("should return valid badge metadata for all standard industrial roles", () => {
    const roles: UserRole[] = ["superadmin", "administrador", "supervisor", "operador", "mantenimiento"];
    roles.forEach((r) => {
      const badge = getRoleBadgeInfo(r);
      expect(badge.label).toBeDefined();
      expect(badge.clearance).toBeDefined();
      expect(badge.color).toBeDefined();
    });
  });
});
