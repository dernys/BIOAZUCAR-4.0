import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAdminSdkStatus,
  getAdminSdkDiagnostics,
  assertAdminSdkReady,
  setAdminSdkStatusForTesting,
  AdminSdkMissingError,
} from "../server/adminSdkStatus";
import { bootstrapDatabaseWithAdminSdk } from "../server/bootstrapService";

describe("[BioAzúcar 4.0] Admin SDK Explicit State Machine & Fail-Closed Governance Tests", () => {
  const originalEnvProfile = process.env.INDUSTRIAL_RUNTIME_PROFILE;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset to sandbox / development defaults for tests
    process.env.INDUSTRIAL_RUNTIME_PROFILE = "DEVELOPMENT";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.INDUSTRIAL_RUNTIME_PROFILE = originalEnvProfile;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("1. Must report valid explicit status (ADMIN_SDK_READY or ADMIN_SDK_MISSING)", () => {
    const status = getAdminSdkStatus();
    expect(["ADMIN_SDK_READY", "ADMIN_SDK_MISSING"]).toContain(status);

    const diagnostics = getAdminSdkDiagnostics();
    expect(diagnostics.status).toBe(status);
    expect(typeof diagnostics.checkedAt).toBe("string");
    expect(["SERVER_AUTHORITATIVE_ENFORCED", "FAIL_CLOSED_ACTIVE", "SANDBOX_CLIENT_PERSISTENCE"]).toContain(
      diagnostics.operationalMode
    );
  });

  it("2. In Non-Production mode, assertAdminSdkReady must NOT throw when ADMIN_SDK_MISSING", () => {
    setAdminSdkStatusForTesting("ADMIN_SDK_MISSING", "Missing credentials");
    process.env.INDUSTRIAL_RUNTIME_PROFILE = "DEVELOPMENT";
    process.env.NODE_ENV = "development";

    // Should log warning but not throw in development
    expect(() => {
      assertAdminSdkReady("NonProductionOperation");
    }).not.toThrow();

    const diagnostics = getAdminSdkDiagnostics();
    expect(diagnostics.operationalMode).toBe("SANDBOX_CLIENT_PERSISTENCE");
  });

  it("3. In PRODUCTION mode, assertAdminSdkReady MUST FAIL-CLOSED when ADMIN_SDK_MISSING", () => {
    setAdminSdkStatusForTesting("ADMIN_SDK_MISSING", "GCP Compute metadata unreachable");
    process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
    process.env.NODE_ENV = "production";

    expect(() => {
      assertAdminSdkReady("PrivilegedTenantCreation");
    }).toThrow(AdminSdkMissingError);

    try {
      assertAdminSdkReady("PrivilegedTenantCreation");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminSdkMissingError);
      expect(err.code).toBe("ADMIN_SDK_MISSING_ERROR");
      expect(err.statusCode).toBe(503);
      expect(err.message).toContain("FAIL-CLOSED");
      expect(err.message).toContain("PrivilegedTenantCreation");
    }

    const diagnostics = getAdminSdkDiagnostics();
    expect(diagnostics.operationalMode).toBe("FAIL_CLOSED_ACTIVE");
  });

  it("4. When ADMIN_SDK_READY, assertAdminSdkReady must succeed in any environment", () => {
    setAdminSdkStatusForTesting("ADMIN_SDK_READY", null);
    process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
    process.env.NODE_ENV = "production";

    expect(() => {
      assertAdminSdkReady("PrivilegedTenantCreation");
    }).not.toThrow();

    const diagnostics = getAdminSdkDiagnostics();
    expect(diagnostics.operationalMode).toBe("SERVER_AUTHORITATIVE_ENFORCED");
  });

  it("5. bootstrapDatabaseWithAdminSdk must fail-closed in PRODUCTION profile if credentials are missing", async () => {
    setAdminSdkStatusForTesting("ADMIN_SDK_MISSING", "Credentials missing");
    process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
    process.env.NODE_ENV = "production";

    const result = await bootstrapDatabaseWithAdminSdk();
    expect(result.success).toBe(false);
    expect(result.status).toBe("ADMIN_SDK_MISSING");
    expect(result.message).toContain("fail-closed");
  });
});
