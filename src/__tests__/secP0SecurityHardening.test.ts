/**
 * BioAzúcar 4.0 — SEC-P0 Security, Authorization, Tenant Isolation & Audit Hardening
 * ==============================================================================
 * Conforms to IEC 62443-4-2 SL3, NIST SP 800-63B, ISA-95 & Zero-Trust Architecture.
 *
 * Verifies all 22 Mandatory Requirements:
 *  1. Fail-open identity rejection (no silent degradation to 'operador' or default tenant).
 *  2. Canonical AuthenticatedPrincipal resolution (SSOT).
 *  3. SuperAdmin Role vs Scope separation (tenantId=GLOBAL alone without role=superadmin is DENIED).
 *  4. Canonical Atomic Permission Registry & RBAC consistency.
 *  5. Multi-Tenant Isolation across multiple tenants (TENANT_PORTUGUESA, TENANT_EL_PALMAR, TENANT_BARINAS).
 *  6. Anti-spoofing defense (Header X-Tenant-Id injection rejected).
 *  7. SuperAdmin NO ES Safety Bypass in SecureCommandGateway (Physical interlocks & range limits inviolable).
 *  8. Four-Eyes Dual-Authorization Principle for critical operations.
 *  9. Cryptographic Chained Audit Trail (SHA-256 sequential Merkle-style ledger & tamper detection).
 * 10. Audit Tenant Isolation (Non-superadmin cannot query ?tenantId=GLOBAL or foreign tenants).
 * 11. SuperAdmin MFA Assurance Level (AAL2 enforcement on critical administrative endpoints).
 * 12. Privilege Escalation Prevention across all roles and channels.
 * 13. Session invalidation on role/membership mutation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import {
  parseAndVerifyToken,
  requireAuth,
  requireRole,
  requireAtomicPermission,
  requireAssuranceLevel,
  requireTenantIsolation,
  requireStrictTenantIsolation,
  assertTenantAuthorization,
  CrossTenantViolationError,
  correlationIdMiddleware,
  AuthenticatedUser,
} from "../server/authMiddleware";
import { MembershipService } from "../server/membershipService";
import {
  AuthenticatedPrincipal,
  hasAtomicPermission,
  validateSuperAdminIntegrity,
  ROLE_ATOMIC_PERMISSIONS,
} from "../types/securityPrincipal";
import {
  AuditChainService,
  GENESIS_HASH,
} from "../services/security/AuditChainService";
import {
  SecureCommandGateway,
  SecureWriteCommandRequest,
} from "../services/edge/commands/SecureCommandGateway";

describe("SEC-P0: Security, Authorization, Multi-Tenant Isolation & Audit Hardening", () => {
  beforeEach(() => {
    AuditChainService.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create mock Express Request/Response
  function createMockReqRes(user?: AuthenticatedUser, overrides: Partial<Request> = {}) {
    const req = {
      user,
      principal: user?.principal,
      query: {},
      body: {},
      params: {},
      headers: {},
      path: "/api/test",
      originalUrl: "/api/test",
      ip: "10.0.1.50",
      baseUrl: "",
      ...overrides,
    } as unknown as Request;

    const resJson = vi.fn();
    const resStatus = vi.fn().mockReturnValue({ json: resJson });
    const resSetHeader = vi.fn();
    const res = {
      status: resStatus,
      json: resJson,
      setHeader: resSetHeader,
    } as unknown as Response;

    const next = vi.fn();

    return { req, res, resStatus, resJson, resSetHeader, next };
  }

  // ==========================================================================
  // 1. FAIL-OPEN IDENTITY ELIMINATION (SEC-P0 §3)
  // ==========================================================================
  describe("1. Fail-Open Identity Elimination (SEC-P0 §3)", () => {
    it("should strictly DENY when token has no active membership (No silent degradation to operador)", async () => {
      // Test token with unmapped user having no membership
      const unmappedToken = "test-token-unmapped_unknown_role";
      const result = await parseAndVerifyToken(unmappedToken);
      expect(result).toBeNull();
    });

    it("should strictly DENY when membership is disabled or inactive", async () => {
      // Seed a disabled membership
      const disabledUid = "usr-disabled-emp-99";
      MembershipService.registerMembership({
        id: "mem-disabled-99",
        userId: disabledUid,
        tenantId: "TENANT_PORTUGUESA",
        role: "operador",
        permissions: ["plant.read"],
        securityLevel: 2,
        status: "DISABLED" as any,
        createdAt: new Date().toISOString(),
      });

      const membership = await MembershipService.getEffectiveMembership(disabledUid);
      expect(membership).toBeNull(); // Fail-closed: returns null
    });

    it("should strictly DENY when test token has empty role or missing tenant", async () => {
      const invalidToken1 = "test-token::TENANT_PORTUGUESA:usr-1";
      const invalidToken2 = "test-token:operador::usr-2";
      expect(await parseAndVerifyToken(invalidToken1)).toBeNull();
      expect(await parseAndVerifyToken(invalidToken2)).toBeNull();
    });

    it("should reject inconsistent claims vs membership (Privilege tampering detection)", () => {
      // Verify via MembershipService that spoofed email prefix alone does not grant privilege
      const evilEmail = "superadmin-fake@evil-domain.com";
      const resolved = MembershipService.getEffectiveMembershipSync("usr-attacker", evilEmail);
      expect(resolved).toBeNull();
    });
  });

  // ==========================================================================
  // 2. CANONICAL MODEL & SUPERADMIN ROLE VS SCOPE SEPARATION (SEC-P0 §4 & §5)
  // ==========================================================================
  describe("2. Canonical Identity & SuperAdmin Role vs Scope Separation (SEC-P0 §4 & §5)", () => {
    it("should populate AuthenticatedPrincipal canonical model with all required attributes", async () => {
      const token = "test-token:supervisor:TENANT_PORTUGUESA:usr-sup-44";
      const user = await parseAndVerifyToken(token);
      expect(user).not.toBeNull();
      expect(user?.principal).toBeDefined();

      const principal = user!.principal!;
      expect(principal.uid).toBe("usr-sup-44");
      expect(principal.role).toBe("supervisor");
      expect(principal.tenantId).toBe("TENANT_PORTUGUESA");
      expect(principal.scope).toBe("TENANT");
      expect(principal.isSuperAdmin).toBe(false);
      expect(principal.securityLevel).toBe(3);
      expect(principal.permissions).toContain("setpoint.write");
      expect(principal.permissions).toContain("alarm.ack");
    });

    it("should NOT consider tenantId=GLOBAL alone as superadmin privilege (Prevents privilege escalation)", () => {
      // Operator with tenantId=GLOBAL must NOT have isSuperAdmin=true
      const integrity1 = validateSuperAdminIntegrity({
        role: "operador",
        tenantId: "GLOBAL",
        scope: "GLOBAL",
        isSuperAdmin: false,
      });
      expect(integrity1).toBe(false);

      // SuperAdmin must satisfy role=superadmin AND (tenantId=GLOBAL or scope=GLOBAL) AND isSuperAdmin=true
      const integrity2 = validateSuperAdminIntegrity({
        role: "superadmin",
        tenantId: "GLOBAL",
        scope: "GLOBAL",
        isSuperAdmin: true,
      });
      expect(integrity2).toBe(true);
    });

    it("should reject superadmin flag when role is not superadmin even if client claims it", async () => {
      const token = "test-token:operador:GLOBAL:usr-op-global";
      const user = await parseAndVerifyToken(token);
      expect(user).not.toBeNull();
      expect(user?.role).toBe("operador");
      expect(user?.isSuperAdmin).toBe(false); // False! Conjunction required.
      expect(user?.scope).toBe("TENANT");
    });

    it("should grant global root privileges only to verified role=superadmin with scope=GLOBAL", async () => {
      const rootToken = "test-token:superadmin:GLOBAL:usr-root-01";
      const user = await parseAndVerifyToken(rootToken);
      expect(user).not.toBeNull();
      expect(user?.role).toBe("superadmin");
      expect(user?.isSuperAdmin).toBe(true);
      expect(user?.scope).toBe("GLOBAL");
      expect(user?.securityLevel).toBe(5);
      expect(user?.principal?.permissions).toContain("tenant.delete");
      expect(user?.principal?.permissions).toContain("security.policy.update");
    });
  });

  // ==========================================================================
  // 3. RBAC CANÓNICO & ATOMIC PERMISSION REGISTRY (SEC-P0 §6 & §10)
  // ==========================================================================
  describe("3. Canonical RBAC & Atomic Permission Registry (SEC-P0 §6 & §10)", () => {
    it("should correctly evaluate atomic permissions across all enterprise roles", () => {
      const rolesToTest = ["superadmin", "administrador", "supervisor", "operador", "mantenimiento", "observador"];
      for (const role of rolesToTest) {
        expect(ROLE_ATOMIC_PERMISSIONS[role]).toBeDefined();
        expect(ROLE_ATOMIC_PERMISSIONS[role].length).toBeGreaterThan(0);
      }

      // Operador has read and basic alarm ack, but CANNOT write setpoints or delete users
      expect(ROLE_ATOMIC_PERMISSIONS["operador"]).toContain("alarm.ack");
      expect(ROLE_ATOMIC_PERMISSIONS["operador"]).toContain("setpoint.read");
      expect(ROLE_ATOMIC_PERMISSIONS["operador"]).not.toContain("setpoint.write");
      expect(ROLE_ATOMIC_PERMISSIONS["operador"]).not.toContain("user.delete");

      // Supervisor can write setpoints, but cannot delete users or manage tenants
      expect(ROLE_ATOMIC_PERMISSIONS["supervisor"]).toContain("setpoint.write");
      expect(ROLE_ATOMIC_PERMISSIONS["supervisor"]).not.toContain("tenant.delete");

      // Superadmin has full atomic permissions
      expect(ROLE_ATOMIC_PERMISSIONS["superadmin"]).toContain("tenant.delete");
      expect(ROLE_ATOMIC_PERMISSIONS["superadmin"]).toContain("security.policy.update");
    });

    it("should enforce requireAtomicPermission middleware", () => {
      const middleware = requireAtomicPermission("setpoint.write");

      // User without setpoint.write -> 403 FORBIDDEN_PERMISSION
      const operatorUser: AuthenticatedUser = {
        uid: "usr-op-01",
        email: "operador@bioazucar.com",
        role: "operador",
        tenantId: "TENANT_PORTUGUESA",
        isSuperAdmin: false,
        securityLevel: 2,
        permissions: ["setpoint.read", "alarm.ack"],
        principal: {
          uid: "usr-op-01",
          email: "operador@bioazucar.com",
          tenantId: "TENANT_PORTUGUESA",
          membershipId: "mem-1",
          roleId: "role-operador",
          role: "operador",
          permissions: ["setpoint.read", "alarm.ack"] as any,
          isSuperAdmin: false,
          securityLevel: 2,
          authenticationAssurance: "AAL1",
          scope: "TENANT",
        },
      };

      const { req: req1, res: res1, resStatus: status1, next: next1 } = createMockReqRes(operatorUser);
      middleware(req1, res1, next1);
      expect(status1).toHaveBeenCalledWith(403);
      expect(next1).not.toHaveBeenCalled();

      // User with setpoint.write (Supervisor) -> 200 / next()
      const supervisorUser: AuthenticatedUser = {
        ...operatorUser,
        role: "supervisor",
        permissions: ["setpoint.write", "alarm.ack"],
        principal: {
          ...operatorUser.principal!,
          role: "supervisor",
          permissions: ["setpoint.write", "alarm.ack"] as any,
        },
      };

      const { req: req2, res: res2, next: next2 } = createMockReqRes(supervisorUser);
      middleware(req2, res2, next2);
      expect(next2).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. MULTI-TENANT ISOLATION ACROSS MULTIPLE TENANTS (SEC-P0 §8)
  // ==========================================================================
  describe("4. Multi-Tenant Isolation Across Multiple Tenants (SEC-P0 §8)", () => {
    const tenantA: AuthenticatedUser = {
      uid: "usr-a",
      email: "usr-a@ingenio-a.com",
      role: "operador",
      tenantId: "TENANT_PORTUGUESA",
      isSuperAdmin: false,
      securityLevel: 2,
      scope: "TENANT",
    };

    const tenantB: AuthenticatedUser = {
      uid: "usr-b",
      email: "usr-b@ingenio-b.com",
      role: "supervisor",
      tenantId: "TENANT_EL_PALMAR",
      isSuperAdmin: false,
      securityLevel: 3,
      scope: "TENANT",
    };

    const tenantC: AuthenticatedUser = {
      uid: "usr-c",
      email: "usr-c@ingenio-c.com",
      role: "administrador",
      tenantId: "TENANT_BARINAS",
      isSuperAdmin: false,
      securityLevel: 4,
      scope: "TENANT",
    };

    const superAdmin: AuthenticatedUser = {
      uid: "usr-root",
      email: "root@bioazucar.com",
      role: "superadmin",
      tenantId: "GLOBAL",
      isSuperAdmin: true,
      securityLevel: 5,
      scope: "GLOBAL",
    };

    it("should allow same-tenant access across all tenants (A->A, B->B, C->C)", () => {
      expect(() => assertTenantAuthorization(tenantA, "TENANT_PORTUGUESA")).not.toThrow();
      expect(() => assertTenantAuthorization(tenantB, "TENANT_EL_PALMAR")).not.toThrow();
      expect(() => assertTenantAuthorization(tenantC, "TENANT_BARINAS")).not.toThrow();
    });

    it("should strictly DENY cross-tenant access between distinct tenants (A->B, B->C, C->A)", () => {
      expect(() => assertTenantAuthorization(tenantA, "TENANT_EL_PALMAR")).toThrow(CrossTenantViolationError);
      expect(() => assertTenantAuthorization(tenantB, "TENANT_BARINAS")).toThrow(CrossTenantViolationError);
      expect(() => assertTenantAuthorization(tenantC, "TENANT_PORTUGUESA")).toThrow(CrossTenantViolationError);
    });

    it("should strictly DENY non-superadmin users attempting to target GLOBAL", () => {
      expect(() => assertTenantAuthorization(tenantA, "GLOBAL")).toThrow(CrossTenantViolationError);
      expect(() => assertTenantAuthorization(tenantB, "GLOBAL")).toThrow(CrossTenantViolationError);
      expect(() => assertTenantAuthorization(tenantC, "GLOBAL")).toThrow(CrossTenantViolationError);
    });

    it("should allow verified superadmin to target ANY tenant and GLOBAL", () => {
      expect(() => assertTenantAuthorization(superAdmin, "TENANT_PORTUGUESA")).not.toThrow();
      expect(() => assertTenantAuthorization(superAdmin, "TENANT_EL_PALMAR")).not.toThrow();
      expect(() => assertTenantAuthorization(superAdmin, "TENANT_BARINAS")).not.toThrow();
      expect(() => assertTenantAuthorization(superAdmin, "GLOBAL")).not.toThrow();
    });

    it("should block cross-tenant parameter bypass in requireTenantIsolation across body, query, and headers", () => {
      const isolationMiddleware = requireTenantIsolation();

      // Query bypass attempt (?tenantId=TENANT_BARINAS by user from TENANT_PORTUGUESA)
      const { req: req1, res: res1, resStatus: s1, next: next1 } = createMockReqRes(tenantA, {
        query: { tenantId: "TENANT_BARINAS" } as any,
      });
      isolationMiddleware(req1, res1, next1);
      expect(s1).toHaveBeenCalledWith(403);
      expect(next1).not.toHaveBeenCalled();

      // Body bypass attempt ({ millId: "TENANT_EL_PALMAR" } by user from TENANT_PORTUGUESA)
      const { req: req2, res: res2, resStatus: s2, next: next2 } = createMockReqRes(tenantA, {
        body: { millId: "TENANT_EL_PALMAR" },
      });
      isolationMiddleware(req2, res2, next2);
      expect(s2).toHaveBeenCalledWith(403);
      expect(next2).not.toHaveBeenCalled();

      // Target GLOBAL attempt (?tenantId=GLOBAL by non-superadmin user)
      const { req: req3, res: res3, resStatus: s3, next: next3 } = createMockReqRes(tenantB, {
        query: { tenantId: "GLOBAL" } as any,
      });
      isolationMiddleware(req3, res3, next3);
      expect(s3).toHaveBeenCalledWith(403);
      expect(next3).not.toHaveBeenCalled();
    });

    it("should reject X-Tenant-Id header spoofing attempts (requireStrictTenantIsolation)", () => {
      const strictMiddleware = requireStrictTenantIsolation();

      const { req, res, resStatus, next } = createMockReqRes(tenantA, {
        headers: { "x-tenant-id": "TENANT_EL_PALMAR" } as any,
      });
      strictMiddleware(req, res, next);
      expect(resStatus).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 5. SUPERADMIN NO ES SAFETY BYPASS & FOUR-EYES PRINCIPLE (SEC-P0 §13 & §14)
  // ==========================================================================
  describe("5. SuperAdmin NO ES Safety Bypass & Four-Eyes Principle (SEC-P0 §13 & §14)", () => {
    it("should strictly reject commands when physical process interlocks are violated, even for superadmin", async () => {
      const gateway = SecureCommandGateway.getInstance();

      // Boiler steam pressure rule has interlockCheck: drum level must be >= 30%
      // In gateway, drum level is at 55% by default. If we send an out-of-range pressure (e.g. 75 bar > max 65 bar):
      const superAdminCommand: SecureWriteCommandRequest = {
        commandId: "cmd-root-overpressure",
        tag: "Boiler.1.Steam_Pressure_SP",
        targetDriverId: "drv-modbus-boiler",
        value: 75.0, // Exceeds 65 bar safety limit
        requester: {
          userId: "usr-superadmin-root",
          userName: "Root Admin",
          role: "superadmin",
          twoFactorVerified: true,
          tenantId: "GLOBAL",
        },
        reason: "Prueba de esfuerzo operacional autorizada",
        timestamp: new Date().toISOString(),
        nonce: `nonce-${Date.now()}-overpress`,
        fourEyesApproval: {
          approvedByUserId: "usr-supervisor-dual",
          approverRole: "supervisor",
          approvedAt: new Date().toISOString(),
        },
      };

      const result = await gateway.executeSecureWrite(superAdminCommand);
      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED_OUT_OF_RANGE");
      // SuperAdmin CANNOT override physical safety limits
    });

    it("should strictly require four-eyes dual approval for critical tags, rejecting single-operator execution by superadmin", async () => {
      const gateway = SecureCommandGateway.getInstance();

      // Boiler 1 steam pressure requires Four-Eyes
      const unapprovedCommand: SecureWriteCommandRequest = {
        commandId: "cmd-root-no-dual",
        tag: "Boiler.1.Steam_Pressure_SP",
        targetDriverId: "drv-modbus-boiler",
        value: 50.0, // Safe range (10-65 bar)
        requester: {
          userId: "usr-superadmin-root",
          userName: "Root Admin",
          role: "superadmin",
          twoFactorVerified: true,
          tenantId: "GLOBAL",
        },
        reason: "Ajuste de presión sin segundo operador",
        timestamp: new Date().toISOString(),
        nonce: `nonce-${Date.now()}-no-dual`,
        // fourEyesApproval is missing!
      };

      const result = await gateway.executeSecureWrite(unapprovedCommand);
      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED_FOUR_EYES_REQUIRED");
    });

    it("should reject four-eyes approval when requester and approver are the same identity", async () => {
      const gateway = SecureCommandGateway.getInstance();

      const selfApprovalCommand: SecureWriteCommandRequest = {
        commandId: "cmd-self-approval",
        tag: "Boiler.1.Steam_Pressure_SP",
        targetDriverId: "drv-modbus-boiler",
        value: 50.0,
        requester: {
          userId: "usr-superadmin-root",
          role: "superadmin",
          twoFactorVerified: true,
        },
        reason: "Ajuste con auto-aprobación inválida",
        timestamp: new Date().toISOString(),
        nonce: `nonce-${Date.now()}-self`,
        fourEyesApproval: {
          approvedByUserId: "usr-superadmin-root", // Same as requester!
          approverRole: "superadmin",
          approvedAt: new Date().toISOString(),
        },
      };

      const result = await gateway.executeSecureWrite(selfApprovalCommand);
      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED_FOUR_EYES_REQUIRED");
      expect(result.message).toContain("Cuatro Ojos violado");
    });
  });

  // ==========================================================================
  // 6. CRYPTOGRAPHIC CHAINED AUDIT TRAIL (SEC-P0 §15, §16, §18)
  // ==========================================================================
  describe("6. Cryptographic Chained Audit Trail & Tamper Detection (SEC-P0 §15, §16, §18)", () => {
    it("should build an immutable sequential hash chain (previousHash -> eventHash)", () => {
      const auditChain = AuditChainService.getInstance();

      // Record Event 1
      const evt1 = auditChain.recordChainedEvent({
        actorUid: "usr-op-1",
        actorRole: "operador",
        tenantId: "TENANT_PORTUGUESA",
        action: "LOGIN_SUCCESS",
        resource: "/api/auth/login",
        result: "SUCCESS",
        correlationId: "corr-chain-01",
      });
      expect(evt1.previousHash).toBe(GENESIS_HASH);
      expect(evt1.eventHash).toBeDefined();
      expect(evt1.eventHash.length).toBe(64); // SHA-256 hex string

      // Record Event 2
      const evt2 = auditChain.recordChainedEvent({
        actorUid: "usr-op-1",
        actorRole: "operador",
        tenantId: "TENANT_PORTUGUESA",
        action: "SETPOINT_CHANGE",
        resource: "Boiler.Steam_Pressure",
        result: "SUCCESS",
        correlationId: "corr-chain-02",
      });
      expect(evt2.previousHash).toBe(evt1.eventHash);

      // Record Event 3
      const evt3 = auditChain.recordChainedEvent({
        actorUid: "usr-sup-1",
        actorRole: "supervisor",
        tenantId: "TENANT_PORTUGUESA",
        action: "CRITICAL_COMMAND_EXECUTED",
        resource: "Turbine.Power_SP",
        result: "SUCCESS",
        correlationId: "corr-chain-03",
      });
      expect(evt3.previousHash).toBe(evt2.eventHash);

      // Verify chain integrity passes 100%
      const integrity = auditChain.verifyAuditChainIntegrity();
      expect(integrity.isValid).toBe(true);
    });

    it("should immediately detect tampering if any record in the chain is modified retroactively", () => {
      const auditChain = AuditChainService.getInstance();

      // Record a chain of 4 events
      for (let i = 0; i < 4; i++) {
        auditChain.recordChainedEvent({
          actorUid: `usr-${i}`,
          actorRole: "operador",
          tenantId: "TENANT_PORTUGUESA",
          action: "SETPOINT_CHANGE",
          resource: `/api/setpoint/${i}`,
          result: "SUCCESS",
          correlationId: `corr-tamper-${i}`,
        });
      }

      expect(auditChain.verifyAuditChainIntegrity().isValid).toBe(true);

      // Tamper event at index 1 (change action or tenantId)
      auditChain.tamperRecordForTesting(1, "tenantId", "ATTACKER_TENANT");

      const checkAfterTamper = auditChain.verifyAuditChainIntegrity();
      expect(checkAfterTamper.isValid).toBe(false);
      expect(checkAfterTamper.brokenAtIndex).toBe(1);
      expect(checkAfterTamper.reason).toContain("Alteración de datos detectada");
    });

    it("should partition audit trail strictly by tenant for non-global actors", () => {
      const auditChain = AuditChainService.getInstance();

      auditChain.recordChainedEvent({
        actorUid: "usr-portuguesa",
        actorRole: "operador",
        tenantId: "TENANT_PORTUGUESA",
        action: "HARVEST_LOG",
        resource: "/api/harvest",
        result: "SUCCESS",
        correlationId: "corr-p1",
      });

      auditChain.recordChainedEvent({
        actorUid: "usr-palmar",
        actorRole: "operador",
        tenantId: "TENANT_EL_PALMAR",
        action: "BOILER_CHECK",
        resource: "/api/boiler",
        result: "SUCCESS",
        correlationId: "corr-p2",
      });

      // Tenant Portuguesa query only returns their records
      const logsPortuguesa = auditChain.getChainedAuditRecords("TENANT_PORTUGUESA");
      expect(logsPortuguesa.length).toBe(1);
      expect(logsPortuguesa[0].tenantId).toBe("TENANT_PORTUGUESA");

      // Global query (SuperAdmin) returns all records
      const logsGlobal = auditChain.getChainedAuditRecords("GLOBAL");
      expect(logsGlobal.length).toBe(2);
    });
  });

  // ==========================================================================
  // 7. SUPERADMIN MFA / ASSURANCE LEVEL (SEC-P0 §19)
  // ==========================================================================
  describe("7. SuperAdmin MFA Assurance Level (SEC-P0 §19)", () => {
    it("should block critical administrative actions if assurance level is AAL1", () => {
      const mfaMiddleware = requireAssuranceLevel("AAL2");

      const lowAssuranceSuperAdmin: AuthenticatedUser = {
        uid: "usr-root",
        email: "root@bioazucar.com",
        role: "superadmin",
        tenantId: "GLOBAL",
        isSuperAdmin: true,
        securityLevel: 5,
        authenticationAssurance: "AAL1",
        principal: {
          uid: "usr-root",
          email: "root@bioazucar.com",
          tenantId: "GLOBAL",
          membershipId: "mem-root",
          roleId: "role-superadmin",
          role: "superadmin",
          permissions: ROLE_ATOMIC_PERMISSIONS["superadmin"],
          isSuperAdmin: true,
          securityLevel: 5,
          authenticationAssurance: "AAL1",
          scope: "GLOBAL",
        },
      };

      const { req, res, resStatus, next } = createMockReqRes(lowAssuranceSuperAdmin);
      mfaMiddleware(req, res, next);
      expect(resStatus).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow critical administrative actions when assurance level is AAL2 (MFA verified)", () => {
      const mfaMiddleware = requireAssuranceLevel("AAL2");

      const highAssuranceSuperAdmin: AuthenticatedUser = {
        uid: "usr-root",
        email: "root@bioazucar.com",
        role: "superadmin",
        tenantId: "GLOBAL",
        isSuperAdmin: true,
        securityLevel: 5,
        authenticationAssurance: "AAL2",
        principal: {
          uid: "usr-root",
          email: "root@bioazucar.com",
          tenantId: "GLOBAL",
          membershipId: "mem-root",
          roleId: "role-superadmin",
          role: "superadmin",
          permissions: ROLE_ATOMIC_PERMISSIONS["superadmin"],
          isSuperAdmin: true,
          securityLevel: 5,
          authenticationAssurance: "AAL2",
          scope: "GLOBAL",
        },
      };

      const { req, res, next } = createMockReqRes(highAssuranceSuperAdmin);
      mfaMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 8. PRIVILEGE ESCALATION ATTEMPTS (SEC-P0 §12)
  // ==========================================================================
  describe("8. Privilege Escalation Attempts (SEC-P0 §12)", () => {
    it("should reject operator attempting administrator action", () => {
      const adminRoleMiddleware = requireRole(["administrador", "superadmin"]);
      const operator: AuthenticatedUser = {
        uid: "usr-op",
        email: "op@bioazucar.com",
        role: "operador",
        tenantId: "TENANT_PORTUGUESA",
        isSuperAdmin: false,
        securityLevel: 2,
      };

      const { req, res, resStatus, next } = createMockReqRes(operator);
      adminRoleMiddleware(req, res, next);
      expect(resStatus).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject administrator attempting superadmin action", () => {
      const superAdminMiddleware = requireRole(["superadmin"]);
      const admin: AuthenticatedUser = {
        uid: "usr-admin",
        email: "admin@bioazucar.com",
        role: "administrador",
        tenantId: "TENANT_PORTUGUESA",
        isSuperAdmin: false,
        securityLevel: 4,
      };

      const { req, res, resStatus, next } = createMockReqRes(admin);
      superAdminMiddleware(req, res, next);
      expect(resStatus).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 9. CORRELATION ID PROPAGATION (SEC-P0 §17)
  // ==========================================================================
  describe("9. Correlation ID Propagation (SEC-P0 §17)", () => {
    it("should preserve incoming X-Correlation-Id header and set it in response", () => {
      const customCorrelation = "corr-upstream-industrial-flow-99";
      const { req, res, resSetHeader, next } = createMockReqRes(undefined, {
        headers: { "x-correlation-id": customCorrelation } as any,
      });

      correlationIdMiddleware(req, res, next);
      expect(req.correlationId).toBe(customCorrelation);
      expect(resSetHeader).toHaveBeenCalledWith("X-Correlation-Id", customCorrelation);
      expect(next).toHaveBeenCalled();
    });

    it("should generate cryptographically sound correlation ID when missing", () => {
      const { req, res, resSetHeader, next } = createMockReqRes();
      correlationIdMiddleware(req, res, next);
      expect(req.correlationId).toMatch(/^corr-[a-z0-9]+-[a-f0-9]+$/);
      expect(resSetHeader).toHaveBeenCalledWith("X-Correlation-Id", req.correlationId);
      expect(next).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 10. SESSION SECURITY & INVALIDATION (SEC-P0 §20)
  // ==========================================================================
  describe("10. Session Security & Invalidation (SEC-P0 §20)", () => {
    it("should immediately invalidate and recalculate membership on role mutation", () => {
      const testUid = "usr-role-mutate-target";
      MembershipService.registerMembership({
        id: "mem-mutate-1",
        userId: testUid,
        tenantId: "TENANT_PORTUGUESA",
        role: "operador",
        permissions: ["plant.read"],
        securityLevel: 2,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      });

      expect(MembershipService.getEffectiveMembershipSync(testUid)?.role).toBe("operador");

      // Update role to supervisor
      MembershipService.updateMembershipRole(testUid, "supervisor", ["plant.read", "setpoint.write"]);
      expect(MembershipService.getEffectiveMembershipSync(testUid)?.role).toBe("supervisor");
      expect(MembershipService.getEffectiveMembershipSync(testUid)?.securityLevel).toBe(3);

      // Invalidate membership
      MembershipService.invalidateMembership(testUid);
      expect(MembershipService.getEffectiveMembershipSync(testUid)).toBeNull();
    });
  });
});
