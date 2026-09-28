import { describe, it, expect, beforeEach } from "vitest";
import {
  IndustrialConfigurationManager,
  SECURE_DEFAULT_INDUSTRIAL_CONFIG,
} from "../services/config/IndustrialConfigurationManager";

describe("BIOAZÚCAR 4.0 — CENTRAL INDUSTRIAL CONFIGURATION MANAGER", () => {
  let manager: IndustrialConfigurationManager;

  beforeEach(() => {
    manager = IndustrialConfigurationManager.getInstance();
  });

  it("should initialize with secure-by-default parameters (IEC 62443 SL3)", () => {
    const config = manager.getConfig();
    expect(config.schemaVersion).toBe("1.0.0");
    expect(config.network.ipForwardingDisabled).toBe(true);
    expect(config.network.mTLSMandatory).toBe(true);
    expect(config.edge.safRollbackOnFailure).toBe(true);
    expect(config.checksum).toBeTruthy();
  });

  it("should validate and reject non-compliant configuration lacking security parameters", () => {
    const invalidConfig: any = {
      ...SECURE_DEFAULT_INDUSTRIAL_CONFIG,
      network: {
        ...SECURE_DEFAULT_INDUSTRIAL_CONFIG.network,
        ipForwardingDisabled: false, // Security violation
      },
    };

    const validation = manager.validate(invalidConfig);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("ipForwardingDisabled"))).toBe(true);
  });

  it("should update valid config, record audit entry, and update checksum", async () => {
    const updated = await manager.updateConfig(
      {
        siteName: "Central Azucarero Río Turbio - Planta Piloto",
      },
      "industrial_architect",
      "Actualización de nombre de planta para piloto"
    );

    expect(updated.siteName).toBe("Central Azucarero Río Turbio - Planta Piloto");
    expect(updated.updatedBy).toBe("industrial_architect");

    const auditTrail = manager.getAuditTrail();
    expect(auditTrail.length).toBeGreaterThan(0);
    expect(auditTrail[auditTrail.length - 1].action).toBe("UPDATE");
  });

  it("should export signed backup package and restore successfully", async () => {
    const backupJson = manager.exportBackup();
    expect(backupJson).toContain("manifestVersion");
    expect(backupJson).toContain("checksum");

    const restoreResult = await manager.restoreFromBackup(backupJson, "qa_auditor");
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.message).toContain("Configuration successfully restored");
  });

  it("should reject corrupted or tampered backup packages", async () => {
    const backup = JSON.parse(manager.exportBackup());
    // Tamper with payload while keeping original checksum
    backup.config.plantCode = "TAMPERED_PLANT_CODE";

    const tamperedJson = JSON.stringify(backup);
    const restoreResult = await manager.restoreFromBackup(tamperedJson, "malicious_actor");
    expect(restoreResult.success).toBe(false);
    expect(restoreResult.message).toContain("Checksum mismatch");
  });
});
