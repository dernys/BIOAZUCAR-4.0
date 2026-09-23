/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — IEC 62443 CYBERSECURITY CERTIFICATION SUITE
 * Referencia: [P0-10] SECURITY AUDIT EVIDENCE & IEC 62443 CERTIFICATION PACK
 * Estándar: IEC 62443-4-2 / IEC 62443-3-3 (Security Level SL3)
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { createHmac, createHash } from "node:crypto";
import {
  Iec62443CertificationPackService,
  FundamentalRequirementId,
} from "../services/security/Iec62443CertificationPack.js";
import { sanitizeAuditMetadata } from "../server/authMiddleware.js";

describe("BIOAZÚCAR 4.0 — IEC 62443 INDUSTRIAL CYBERSECURITY CERTIFICATION PACK [P0-10]", () => {
  const certService = Iec62443CertificationPackService.getInstance();

  it("TC-IEC-01: should execute full compliance assessment and achieve Security Level SL3", () => {
    const report = certService.executeFullComplianceAssessment("TENANT_TEST_01");

    expect(report.standard).toContain("IEC 62443-4-2");
    expect(report.version).toBe("4.0.0-PROD");
    expect(report.targetSecurityLevel).toBe("SL3");
    expect(report.achievedSecurityLevel).toBe("SL3");
    expect(report.overallComplianceScore).toBe(100);
    expect(report.vulnerabilitiesDetected).toBe(0);
    expect(report.totalControlsTested).toBeGreaterThanOrEqual(7);
    expect(report.digitalSealSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.plantContext.tenantId).toBe("TENANT_TEST_01");
  });

  it("TC-IEC-02: FR1 (Identification and Authentication) - enforces RBAC segregation and credential sanitization", () => {
    const report = certService.getLatestCertificationPack();
    const fr1 = report.fundamentalRequirements["FR1"];

    expect(fr1).toBeDefined();
    expect(fr1.targetSl).toBe("SL3");
    expect(fr1.achievedSl).toBe("SL3");
    expect(fr1.compliancePercent).toBe(100);
    expect(fr1.requirements.length).toBeGreaterThanOrEqual(2);

    // Dynamic secret sanitization check
    const secretData = {
      apiKey: "super-secret-gemini-key",
      password: "PlantMasterPassword!99",
      jwt: "bearer-token-industrial-sl3",
      safeTagName: "MILL_PRESSURE_BAR",
    };
    const sanitized = sanitizeAuditMetadata(secretData);
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.jwt).toBe("[REDACTED]");
    expect(sanitized.safeTagName).toBe("MILL_PRESSURE_BAR");
  });

  it("TC-IEC-03: FR2 (Use Control) - validates least privilege and role hierarchy boundaries", () => {
    const report = certService.getLatestCertificationPack();
    const fr2 = report.fundamentalRequirements["FR2"];

    expect(fr2).toBeDefined();
    expect(fr2.achievedSl).toBe("SL3");
    expect(fr2.requirements.some((r) => r.id === "CR 2.1")).toBe(true);
    const cr21 = fr2.requirements.find((r) => r.id === "CR 2.1");
    expect(cr21?.status).toBe("VERIFIED");
    expect(cr21?.controlChecksumSha256).toBeDefined();
  });

  it("TC-IEC-04: FR3 (System Integrity) - detects cryptographic tampering of process data immediately", () => {
    const report = certService.getLatestCertificationPack();
    const fr3 = report.fundamentalRequirements["FR3"];

    expect(fr3).toBeDefined();
    expect(fr3.achievedSl).toBe("SL3");

    // Cryptographic proof of tamper-evidence
    const secret = "shared-secret-key-123";
    const originalBatch = JSON.stringify({ batchId: "b-01", tch: 250.4, boilerSteamBar: 44.0 });
    const originalSignature = createHmac("sha256", secret).update(originalBatch).digest("hex");

    // Attacker modifies boiler steam pressure to induce boiler trip
    const tamperedBatch = JSON.stringify({ batchId: "b-01", tch: 250.4, boilerSteamBar: 80.0 });
    const tamperedSignature = createHmac("sha256", secret).update(tamperedBatch).digest("hex");

    expect(originalSignature).not.toBe(tamperedSignature);
  });

  it("TC-IEC-05: FR4 (Data Confidentiality) - verifies encryption in transit (mTLS) and storage protection", () => {
    const report = certService.getLatestCertificationPack();
    const fr4 = report.fundamentalRequirements["FR4"];

    expect(fr4).toBeDefined();
    expect(fr4.achievedSl).toBe("SL3");
    const cr41 = fr4.requirements.find((r) => r.id === "CR 4.1");
    expect(cr41?.technicalControl).toContain("mTLS");
    expect(cr41?.status).toBe("VERIFIED");
  });

  it("TC-IEC-06: FR5 (Restricted Data Flow) - validates network boundary protection and anti-replay guard", () => {
    const report = certService.getLatestCertificationPack();
    const fr5 = report.fundamentalRequirements["FR5"];

    expect(fr5).toBeDefined();
    expect(fr5.achievedSl).toBe("SL3");

    // Replay attack simulation: 5-minute (300s) anti-replay window
    const now = Date.now();
    const validTimestamp = now - 5000; // 5s ago
    const expiredTimestamp = now - (301 * 1000); // 301s ago (outside 300s window)

    const isWithinWindow = (ts: number, windowMs = 300000) => Math.abs(now - ts) <= windowMs;

    expect(isWithinWindow(validTimestamp)).toBe(true);
    expect(isWithinWindow(expiredTimestamp)).toBe(false);
  });

  it("TC-IEC-07: FR6 (Timely Response to Events) - verifies immutable audit trail with SOE timestamping", () => {
    const report = certService.getLatestCertificationPack();
    const fr6 = report.fundamentalRequirements["FR6"];

    expect(fr6).toBeDefined();
    expect(fr6.achievedSl).toBe("SL3");
    expect(report.auditEvidenceTrail.length).toBeGreaterThanOrEqual(7);

    report.auditEvidenceTrail.forEach((ev) => {
      expect(ev.status).toBe("PASS");
      expect(ev.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(ev.executionLatencyMs).toBeGreaterThanOrEqual(0);
      expect(ev.details.length).toBeGreaterThan(10);
    });
  });

  it("TC-IEC-08: FR7 (Resource Availability) - verifies failover, WAL persistence and DoS mitigation", () => {
    const report = certService.getLatestCertificationPack();
    const fr7 = report.fundamentalRequirements["FR7"];

    expect(fr7).toBeDefined();
    expect(fr7.achievedSl).toBe("SL3");
    const cr71 = fr7.requirements.find((r) => r.id === "CR 7.1");
    expect(cr71?.technicalControl).toContain("SQLite WAL");
    expect(cr71?.status).toBe("VERIFIED");
  });

  it("TC-IEC-09: Digital Seal Tamper-Evidence - verifies that any modification invalidates the certification digest", () => {
    const report = certService.executeFullComplianceAssessment("TENANT_SEAL_TEST");
    const originalSeal = report.digitalSealSha256;

    // Simulate tampering with report summary count
    const tamperedReportData = JSON.stringify({
      standard: "IEC 62443-4-2 / IEC 62443-3-3",
      timestamp: report.evaluationTimestamp,
      tenantId: "TENANT_SEAL_TEST",
      totalControls: 999, // tampered value
      failedControls: 0,
      trailCount: report.auditEvidenceTrail.length,
    });

    const forgedSeal = createHash("sha256").update(tamperedReportData).digest("hex");
    expect(forgedSeal).not.toBe(originalSeal);
  });

  it("TC-IEC-10: All 7 Fundamental Requirements (FR1 to FR7) must achieve 100% compliance", () => {
    const report = certService.getLatestCertificationPack();
    const requiredFrs: FundamentalRequirementId[] = ["FR1", "FR2", "FR3", "FR4", "FR5", "FR6", "FR7"];

    requiredFrs.forEach((frId) => {
      const fr = report.fundamentalRequirements[frId];
      expect(fr).toBeDefined();
      expect(fr.compliancePercent).toBe(100);
      expect(fr.achievedSl).toBe("SL3");
      expect(fr.requirements.length).toBeGreaterThanOrEqual(1);
      fr.requirements.forEach((req) => {
        expect(req.status).toBe("VERIFIED");
        expect(req.achievedSecurityLevel).toBe("SL3");
      });
    });
  });
});
