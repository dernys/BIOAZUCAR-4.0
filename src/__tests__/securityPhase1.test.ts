import { describe, it, expect } from "vitest";
import {
  parseAndVerifyToken,
  rateLimiter,
  securityHeadersMiddleware,
  logServerAuditEvent,
  getServerAuditTrail,
} from "../server/authMiddleware";
import { PREDEFINED_USERS } from "../services/authService";

describe("BIOAZÚCAR 4.0 — FASE 1 SECURITY FOUNDATION TEST SUITE", () => {
  describe("SEC-01: Elimination of Plaintext Credentials", () => {
    it("MUST NOT contain any password or passwordHash in PREDEFINED_USERS", () => {
      PREDEFINED_USERS.forEach((user) => {
        expect((user as any).passwordHash).toBeUndefined();
        expect((user as any).password).toBeUndefined();
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.role).toBeDefined();
        expect(user.tenantId).toBeDefined();
      });
    });
  });

  describe("SEC-02 & SEC-03: Server-Side Token Parsing and RBAC", () => {
    it("correctly parses structured test tokens into verified user identities", async () => {
      const token = "test-token-administrador-tenant-bioazucar-01-usr-admin-01";
      const user = await parseAndVerifyToken(token);

      expect(user).not.toBeNull();
      expect(user?.role).toBe("administrador");
      expect(user?.tenantId).toBe("tenant-bioazucar-01");
      expect(user?.id).toBe("usr-admin-01");
    });

    it("rejects malformed or empty tokens", async () => {
      expect(await parseAndVerifyToken("")).toBeNull();
      expect(await parseAndVerifyToken("invalid-token-string")).toBeNull();
      expect(await parseAndVerifyToken("bearer-foo")).toBeNull();
    });
  });

  describe("SEC-04: Multi-Tenant Isolation & Audit Trail", () => {
    it("records and retrieves server-side audit events conforming to IEC 62443", () => {
      const initialCount = getServerAuditTrail().length;

      logServerAuditEvent({
        eventType: "RBAC_VIOLATION",
        severity: "WARNING",
        userId: "usr-op-01",
        userRole: "operador",
        tenantId: "tenant-bioazucar-01",
        action: "TEST_UNAUTHORIZED_ACTION",
        resource: "/api/ai/suggest-mill-setup",
        result: "DENIED",
        metadata: { reason: "Insufficient role level" },
      });

      const trail = getServerAuditTrail();
      expect(trail.length).toBeGreaterThan(initialCount);
      const lastEvent = trail[trail.length - 1];
      expect(lastEvent.eventType).toBe("RBAC_VIOLATION");
      expect(lastEvent.result).toBe("DENIED");
      expect(lastEvent.userId).toBe("usr-op-01");
    });
  });

  describe("SEC-05: Security Headers & Rate Limiting", () => {
    it("injects IEC 62443 and OWASP defensive headers", () => {
      const headers: Record<string, string> = {};
      const req = {} as any;
      const res = {
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
      } as any;
      let nextCalled = false;

      securityHeadersMiddleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
      expect(headers["X-Industrial-Security"]).toBe("IEC-62443-SL3");
    });

    it("enforces rate limiting on excessive requests", () => {
      const limiter = rateLimiter(3, 60000); // 3 requests per minute
      const req = {
        ip: "192.168.1.100",
        headers: {},
        path: "/api/ai/test",
      } as any;
      const res = {
        status: (code: number) => ({
          json: (data: any) => ({ code, data }),
        }),
      } as any;

      let called = 0;
      const next = () => {
        called++;
      };

      // Requests 1, 2, 3 should pass
      limiter(req, res, next);
      limiter(req, res, next);
      limiter(req, res, next);
      expect(called).toBe(3);

      // Request 4 should be blocked (next not called)
      let blockedCode = 0;
      const blockingRes = {
        status: (code: number) => {
          blockedCode = code;
          return { json: () => {} };
        },
      } as any;

      limiter(req, blockingRes, next);
      expect(called).toBe(3); // did not increment
      expect(blockedCode).toBe(429);
    });
  });

  describe("SEC-06: Cryptographic Token Negative Tests & Alg None Attack", () => {
    it("MUST reject tokens with alg: 'none' attack", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: "usr-hacker",
          role: "superadmin",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url");
      const noneToken = `${header}.${payload}.`;

      const result = parseAndVerifyToken(noneToken);
      expect(result).toBeNull();
    });

    it("MUST reject expired tokens", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: "usr-admin-01",
          role: "administrador",
          exp: Math.floor(Date.now() / 1000) - 600, // expired 10 minutes ago
        })
      ).toString("base64url");
      const expiredToken = `${header}.${payload}.mock-signature`;

      const result = parseAndVerifyToken(expiredToken);
      expect(result).toBeNull();
    });

    it("MUST reject tampered JWT signature in HMAC tokens", async () => {
      const crypto = await import("crypto");
      const secret = "bioazucar-industrial-hmac-secret-key-62443";
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: "usr-op-01",
          role: "operador",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url");

      const validSig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
      const tamperedSig = validSig.slice(0, -4) + "XXXX"; // Tamper signature

      const validToken = `${header}.${payload}.${validSig}`;
      const tamperedToken = `${header}.${payload}.${tamperedSig}`;

      expect(parseAndVerifyToken(validToken)).not.toBeNull();
      expect(parseAndVerifyToken(tamperedToken)).toBeNull();
    });
  });

  describe("SEC-07: Anti-Tampering & Client Role Forgery Prevention", () => {
    it("MUST strip credentials and secrets from audit trail metadata", () => {
      logServerAuditEvent({
        actorUid: "usr-op-01",
        tenantId: "tenant-bioazucar-01",
        action: "LOGIN_ATTEMPT",
        resource: "/api/auth/login",
        result: "SUCCESS",
        metadata: {
          token: "secret-token-12345",
          password: "super-secret-password",
          apiKey: "AIzaSyFakeKey999",
          normalField: "safe_value",
        },
      });

      const trail = getServerAuditTrail();
      const last = trail[trail.length - 1];
      expect(last.metadata?.token).toBe("[REDACTED]");
      expect(last.metadata?.password).toBe("[REDACTED]");
      expect(last.metadata?.apiKey).toBe("[REDACTED]");
      expect(last.metadata?.normalField).toBe("safe_value");
    });
  });

  describe("SEC-08: Telemetry Provenance and Simulation Metadata", () => {
    it("MUST explicitly mark simulated telemetry with provenance and simulation flags", async () => {
      const { INITIAL_TELEMETRY, updateTelemetry } = await import("../services/simulationEngine");

      expect(INITIAL_TELEMETRY.isSimulated).toBe(true);
      expect(INITIAL_TELEMETRY.provenance).toBe("SIMULATED_PROCESS_MODEL");
      expect(INITIAL_TELEMETRY.quality).toBe("SIMULATED");
      expect(INITIAL_TELEMETRY.source).toBeDefined();

      const updated = updateTelemetry(INITIAL_TELEMETRY, "NORMAL");
      expect(updated.isSimulated).toBe(true);
      expect(updated.provenance).toBe("SIMULATED_PROCESS_MODEL");
      expect(updated.quality).toBe("SIMULATED");
    });
  });
});
