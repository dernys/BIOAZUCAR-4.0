import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import {
  requireTenantIsolation,
  requireStrictTenantIsolation,
  assertTenantAuthorization,
  CrossTenantViolationError,
  getServerAuditTrail,
  clearServerAuditTrail,
  logServerAuditEvent,
  AuthenticatedUser,
} from "../server/authMiddleware";
import { crossTenantViolationsTotal } from "../services/metrics";

describe("Iteration I36: [P1-04] Central Server Multi-Tenant Authorization Hardening (IEC 62443 SL3)", () => {
  const userTenantA: AuthenticatedUser = {
    uid: "usr-operator-tenant-a",
    email: "operador@ingenio-a.com",
    role: "operador",
    tenantId: "TENANT_PORTUGUESA",
    isSuperAdmin: false,
    securityLevel: 2,
  };

  const userTenantB: AuthenticatedUser = {
    uid: "usr-operator-tenant-b",
    email: "operador@ingenio-b.com",
    role: "operador",
    tenantId: "TENANT_EL_PALMAR",
    isSuperAdmin: false,
    securityLevel: 2,
  };

  const superAdminUser: AuthenticatedUser = {
    uid: "usr-superadmin-root",
    email: "superadmin@bioazucar.com",
    role: "superadmin",
    tenantId: "GLOBAL",
    isSuperAdmin: true,
    securityLevel: 5,
  };

  beforeEach(() => {
    clearServerAuditTrail();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. assertTenantAuthorization Helper Function", () => {
    it("should allow access when target tenant matches user tenant", () => {
      expect(() => {
        assertTenantAuthorization(userTenantA, "TENANT_PORTUGUESA", "/api/data");
      }).not.toThrow();
    });

    it("should allow superadmin global access across any tenant", () => {
      expect(() => {
        assertTenantAuthorization(superAdminUser, "TENANT_PORTUGUESA");
        assertTenantAuthorization(superAdminUser, "TENANT_EL_PALMAR");
      }).not.toThrow();
    });

    it("should throw CrossTenantViolationError (403) on cross-tenant mismatch", () => {
      expect(() => {
        assertTenantAuthorization(userTenantA, "TENANT_EL_PALMAR", "/api/milling");
      }).toThrow(CrossTenantViolationError);

      try {
        assertTenantAuthorization(userTenantA, "TENANT_EL_PALMAR", "/api/milling");
      } catch (err: any) {
        expect(err).toBeInstanceOf(CrossTenantViolationError);
        expect(err.code).toBe("CROSS_TENANT_DENIED");
        expect(err.statusCode).toBe(403);
        expect(err.userTenant).toBe("TENANT_PORTUGUESA");
        expect(err.attemptedTenant).toBe("TENANT_EL_PALMAR");
      }
    });

    it("should no-op when targetTenantId is undefined or empty", () => {
      expect(() => {
        assertTenantAuthorization(userTenantA, undefined);
        assertTenantAuthorization(userTenantA, "");
      }).not.toThrow();
    });
  });

  describe("2. requireTenantIsolation Middleware", () => {
    function createMockReqRes(user?: AuthenticatedUser, overrides: Partial<Request> = {}) {
      const req = {
        user,
        query: {},
        body: {},
        params: {},
        headers: {},
        path: "/api/telemetry",
        originalUrl: "/api/telemetry",
        ip: "192.168.10.45",
        baseUrl: "",
        ...overrides,
      } as unknown as Request;

      let statusCode = 200;
      let jsonPayload: any = null;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          jsonPayload = payload;
          return res;
        },
      } as unknown as Response;

      return { req, res, getStatus: () => statusCode, getPayload: () => jsonPayload };
    }

    it("should reject unauthenticated requests with 401 UNAUTHENTICATED", () => {
      const { req, res, getStatus, getPayload } = createMockReqRes(undefined);
      const next = vi.fn();

      const middleware = requireTenantIsolation();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(401);
      expect(getPayload().code).toBe("UNAUTHENTICATED");
    });

    it("should allow matching tenant in query parameters", () => {
      const { req, res, getStatus } = createMockReqRes(userTenantA, {
        query: { tenantId: "TENANT_PORTUGUESA" },
      });
      const next = vi.fn();

      const middleware = requireTenantIsolation();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(getStatus()).toBe(200);
    });

    it("should block cross-tenant query parameter and log CRITICAL audit event", () => {
      const { req, res, getStatus, getPayload } = createMockReqRes(userTenantA, {
        query: { tenantId: "TENANT_EL_PALMAR" },
      });
      const next = vi.fn();

      const middleware = requireTenantIsolation();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect(getPayload().code).toBe("CROSS_TENANT_DENIED");
      expect(getPayload().error).toContain("TENANT_PORTUGUESA");
      expect(getPayload().error).toContain("TENANT_EL_PALMAR");

      // Verify audit record
      const trail = getServerAuditTrail();
      const crossEvent = trail.find((e) => e.action === "CROSS_TENANT_ACCESS_ATTEMPT");
      expect(crossEvent).toBeDefined();
      expect(crossEvent?.severity).toBe("CRITICAL");
      expect(crossEvent?.result).toBe("DENIED");
      expect(crossEvent?.actorUid).toBe("usr-operator-tenant-a");
      expect(crossEvent?.metadata?.attemptedTenant).toBe("TENANT_EL_PALMAR");
    });

    it("should block cross-tenant targetTenantId in request body", () => {
      const { req, res, getStatus, getPayload } = createMockReqRes(userTenantA, {
        body: { targetTenantId: "TENANT_EL_PALMAR", setpoint: 450 },
      });
      const next = vi.fn();

      const middleware = requireTenantIsolation();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect(getPayload().code).toBe("CROSS_TENANT_DENIED");
    });

    it("should block cross-tenant millId in request body", () => {
      const { req, res, getStatus, getPayload } = createMockReqRes(userTenantA, {
        body: { millId: "TENANT_EL_PALMAR" },
      });
      const next = vi.fn();

      const middleware = requireTenantIsolation();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect(getPayload().code).toBe("CROSS_TENANT_DENIED");
    });

    it("should block cross-tenant in route parameters (:tenantId)", () => {
      const { req, res, getStatus, getPayload } = createMockReqRes(userTenantA, {
        params: { tenantId: "TENANT_EL_PALMAR" },
      });
      const next = vi.fn();

      const middleware = requireTenantIsolation();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect(getPayload().code).toBe("CROSS_TENANT_DENIED");
    });

    it("should allow superadmin global clearance across all requested tenants", () => {
      const { req, res, getStatus } = createMockReqRes(superAdminUser, {
        query: { tenantId: "TENANT_EL_PALMAR" },
      });
      const next = vi.fn();

      const middleware = requireTenantIsolation();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(getStatus()).toBe(200);
    });
  });

  describe("3. requireStrictTenantIsolation & Header Injection Defense", () => {
    function createMockReqRes(user?: AuthenticatedUser, headers: Record<string, string> = {}) {
      const req = {
        user,
        query: {},
        body: {},
        params: {},
        headers,
        path: "/api/secure-op",
        originalUrl: "/api/secure-op",
        ip: "10.0.4.12",
        baseUrl: "",
      } as unknown as Request;

      let statusCode = 200;
      let jsonPayload: any = null;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          jsonPayload = payload;
          return res;
        },
      } as unknown as Response;

      return { req, res, getStatus: () => statusCode, getPayload: () => jsonPayload };
    }

    it("should immediately reject spoofed X-Tenant-Id header differing from authenticated token", () => {
      const { req, res, getStatus, getPayload } = createMockReqRes(userTenantA, {
        "x-tenant-id": "TENANT_EL_PALMAR",
      });
      const next = vi.fn();

      const middleware = requireStrictTenantIsolation();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect(getPayload().code).toBe("TENANT_HEADER_SPOOFING_REJECTED");

      const trail = getServerAuditTrail();
      const spoofEvent = trail.find((e) => e.action === "HEADER_TENANT_INJECTION_REJECTED");
      expect(spoofEvent).toBeDefined();
      expect(spoofEvent?.severity).toBe("CRITICAL");
      expect(spoofEvent?.metadata?.injectedHeaderTenant).toBe("TENANT_EL_PALMAR");
    });

    it("should allow X-Tenant-Id when matching authenticated token", () => {
      const { req, res, getStatus } = createMockReqRes(userTenantA, {
        "x-tenant-id": "TENANT_PORTUGUESA",
      });
      const next = vi.fn();

      const middleware = requireStrictTenantIsolation();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(getStatus()).toBe(200);
    });

    it("should allow superadmin to supply any X-Tenant-Id header for administrative tasks", () => {
      const { req, res, getStatus } = createMockReqRes(superAdminUser, {
        "x-tenant-id": "TENANT_EL_PALMAR",
      });
      const next = vi.fn();

      const middleware = requireStrictTenantIsolation();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(getStatus()).toBe(200);
    });
  });

  describe("4. Partitioned Audit Trail Filtering (getServerAuditTrail)", () => {
    it("should strictly partition audit logs by tenant", () => {
      logServerAuditEvent({
        actorUid: "usr-a",
        tenantId: "TENANT_PORTUGUESA",
        action: "HARVEST_START",
        result: "SUCCESS",
      });

      logServerAuditEvent({
        actorUid: "usr-b",
        tenantId: "TENANT_EL_PALMAR",
        action: "BOILER_IGNITION",
        result: "SUCCESS",
      });

      const allLogs = getServerAuditTrail();
      expect(allLogs.length).toBe(2);

      const logsTenantA = getServerAuditTrail("TENANT_PORTUGUESA");
      expect(logsTenantA.length).toBe(1);
      expect(logsTenantA[0].action).toBe("HARVEST_START");
      expect(logsTenantA[0].tenantId).toBe("TENANT_PORTUGUESA");

      const logsTenantB = getServerAuditTrail("TENANT_EL_PALMAR");
      expect(logsTenantB.length).toBe(1);
      expect(logsTenantB[0].action).toBe("BOILER_IGNITION");
      expect(logsTenantB[0].tenantId).toBe("TENANT_EL_PALMAR");

      // Superadmin / GLOBAL queries get all
      const globalLogs = getServerAuditTrail("GLOBAL");
      expect(globalLogs.length).toBe(2);
    });
  });
});
