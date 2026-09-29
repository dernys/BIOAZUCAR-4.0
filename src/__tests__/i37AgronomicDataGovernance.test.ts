/**
 * BIOAZÚCAR 4.0 — ITERATION 37 TEST SUITE
 * ==============================================================================
 * Iteration I37: Gobernanza y Validación End-to-End de Datos Agronómicos (Módulo PDA)
 * Standards: IEC 62443-4-2 SL3 / ISA-95 Level 3-4 (MOM) / ISSCT Sugar Technology
 * 
 * Verifies:
 * 1. Strict Physiological Boundary Enforcement (Saccharum officinarum Brix, Pol, Fiber, Trash).
 * 2. Cardinal Polarimetric Law (Pol <= Brix, Apparent Purity <= 100%).
 * 3. Exact Purity and Commercial Sugar Yield Calculations (Spencer-Meade / Hugot SJM).
 * 4. Analyst Identity & Accountability Verification (IEC 62443).
 * 5. Immutable SHA-256 Cryptographic Sealing & Anti-Tampering Detection.
 * 6. Batey Weighbridge Scale Reconciliation & Field Deviation Control.
 * 7. Multi-Tenant Partitioning & Cross-Tenant Data Isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgronomicValidationService } from "../services/agriculture/AgronomicValidationService";
import { AgronomicGovernancePipeline } from "../services/agriculture/AgronomicGovernancePipeline";
import { CaneLaboratorySample } from "../types/agriculture";

describe("BIOAZÚCAR 4.0 — ITERATION I37: AGRONOMIC DATA GOVERNANCE & LABORATORY INTEGRITY", () => {
  let pipeline: AgronomicGovernancePipeline;

  const VALID_SAMPLE_PAYLOAD = {
    sampleId: "lab-sample-test-01",
    sampleCode: "LAB-MUESTRA-20260928-001",
    tenantId: "TENANT_PORTUGUESA",
    campaignId: "CAMPAIGN_ZAFRA_2026_2027",
    plotId: "PLOT_TABLA_04",
    varietyCode: "CP72-2086",
    growthStage: "SOCA" as const,
    weighingTicketNumber: "TKT-BASCULA-88421",
    samplingStage: "CORE_SAMPLER_BATEY" as const,
    samplingDateTime: "2026-09-28T14:30:00.000Z",
    analystId: "usr-chem-01",
    analystName: "Dra. Elena Ramos (Química de Central)",
    laboratoryId: "LAB_CENTRAL_BATEY",
    brixDegrees: 19.8,
    polPercent: 17.2,
    fiberPercent: 12.8,
    trashPercent: 4.2,
    reducingSugarsPercent: 0.85,
    dextranPpm: 120,
    analystSignature: "SIG-HMAC-SHA256-ELENA-RAMOS-9842",
  };

  beforeEach(() => {
    pipeline = AgronomicGovernancePipeline.getInstance();
    pipeline.resetPipelineForTesting();
  });

  describe("1. Physiological Bounds Validation of Saccharum officinarum", () => {
    it("MUST approve samples with physiologically sound sugarcane metrics", () => {
      const res = AgronomicValidationService.validateCaneLaboratorySample(VALID_SAMPLE_PAYLOAD);

      expect(res.isValid).toBe(true);
      expect(res.dataQuality).toBe("VALIDATED");
      expect(res.errors).toHaveLength(0);
      expect(res.normalizedData.apparentPurity).toBeCloseTo(86.87, 1);
      expect(res.normalizedData.commercialSugarYieldEstimated).toBeGreaterThan(11.0);
      expect(res.normalizedData.cryptographicHash).toBeDefined();
      expect(res.normalizedData.cryptographicHash.length).toBe(64); // SHA-256 hex length
    });

    it("MUST reject Brix values below physiological minimum (< 8.0 °Bx)", () => {
      const payload = {
        ...VALID_SAMPLE_PAYLOAD,
        brixDegrees: 4.5, // Impossibly low: diluted juice or water
      };
      const res = AgronomicValidationService.validateCaneLaboratorySample(payload);

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === "brixDegrees" && e.rule.includes("8.0°Bx - 28.0°Bx"))).toBe(true);
    });

    it("MUST reject Brix values above physiological maximum (> 28.0 °Bx)", () => {
      const payload = {
        ...VALID_SAMPLE_PAYLOAD,
        brixDegrees: 34.2, // Impossibly high for raw cane juice: syrup or concentrate
      };
      const res = AgronomicValidationService.validateCaneLaboratorySample(payload);

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === "brixDegrees" && e.rule.includes("8.0°Bx - 28.0°Bx"))).toBe(true);
    });

    it("MUST reject Pol values below physiological minimum (< 5.0%)", () => {
      const payload = {
        ...VALID_SAMPLE_PAYLOAD,
        polPercent: 3.1,
      };
      const res = AgronomicValidationService.validateCaneLaboratorySample(payload);

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === "polPercent" && e.rule.includes("5.0% - 24.0%"))).toBe(true);
    });

    it("MUST reject Pol values above physiological maximum (> 24.0%)", () => {
      const payload = {
        ...VALID_SAMPLE_PAYLOAD,
        polPercent: 27.5,
      };
      const res = AgronomicValidationService.validateCaneLaboratorySample(payload);

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === "polPercent" && e.rule.includes("5.0% - 24.0%"))).toBe(true);
    });

    it("MUST reject Fiber values outside sugarcane range (8.0% - 22.0%)", () => {
      const tooLow = AgronomicValidationService.validateCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        fiberPercent: 5.0,
      });
      expect(tooLow.isValid).toBe(false);
      expect(tooLow.errors.some(e => e.field === "fiberPercent")).toBe(true);

      const tooHigh = AgronomicValidationService.validateCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        fiberPercent: 26.5,
      });
      expect(tooHigh.isValid).toBe(false);
      expect(tooHigh.errors.some(e => e.field === "fiberPercent")).toBe(true);
    });

    it("MUST reject Trash / Materia Extraña exceeding 25%", () => {
      const res = AgronomicValidationService.validateCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        trashPercent: 32.0,
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === "trashPercent" && e.rule.includes("0.0% - 25.0%"))).toBe(true);
    });
  });

  describe("2. Cardinal Polarimetric Law Enforcement: Pol <= Brix", () => {
    it("MUST immediately reject samples where Pol > Brix (Physical & Thermodynamic Impossibility)", () => {
      const impossiblePayload = {
        ...VALID_SAMPLE_PAYLOAD,
        brixDegrees: 16.0,
        polPercent: 19.5, // Pol exceeds total soluble solids (Brix) -> Impossibility!
      };
      const res = AgronomicValidationService.validateCaneLaboratorySample(impossiblePayload);

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e =>
        e.field === "polPercent" &&
        e.rule.includes("Imposibilidad física/polarimétrica") &&
        e.rule.includes("no puede exceder los grados Brix")
      )).toBe(true);
    });

    it("MUST reject factory weighbridge receptions if embedded lab sample violates Pol <= Brix", () => {
      const receptionPayload = {
        id: "rec-test-01",
        tenantId: "TENANT_PORTUGUESA",
        grossWeightTons: 42.5,
        tareWeightTons: 14.2,
        labBrix: 17.0,
        labPol: 20.5, // Impossible
      };
      const res = AgronomicValidationService.validateFactoryWeighingAndReception(receptionPayload);

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.rule.includes("Pol (20.5%) no puede exceder a Brix (17°Bx)"))).toBe(true);
    });
  });

  describe("3. Purity & Sugar Yield Mathematical Formulations", () => {
    it("accurately computes apparent purity: (Pol / Brix) * 100", () => {
      const purity = AgronomicValidationService.computeSugarcanePurity(18.0, 20.0);
      expect(purity).toBe(90.0);

      const zeroBrix = AgronomicValidationService.computeSugarcanePurity(15.0, 0);
      expect(zeroBrix).toBe(0);
    });

    it("calculates commercial sugar yield according to Spencer-Meade / Hugot SJM formulation", () => {
      // Pol: 17.5%, Purity: 87.5%, Fiber: 12.5%, Trash: 4.0%
      const yieldResult = AgronomicValidationService.computeCommercialSugarYield(17.5, 87.5, 12.5, 4.0);

      // SJM Factor = 1.4 - 40/87.5 = 1.4 - 0.4571 = 0.9429
      // Extraction = 1 - 0.125 = 0.875
      // Clean Cane = 1 - 0.04 = 0.96
      // Yield = 17.5 * 0.9429 * 0.875 * 0.96 ≈ 13.85%
      expect(yieldResult).toBeGreaterThan(12.0);
      expect(yieldResult).toBeLessThan(15.0);
      expect(yieldResult).toBeCloseTo(13.85, 0.5);
    });
  });

  describe("4. Identity, Accountability and Required Signatures (IEC 62443 SL3)", () => {
    it("MUST reject samples missing tenantId, plotId or analystId", () => {
      const missingTenant = AgronomicValidationService.validateCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        tenantId: "",
      });
      expect(missingTenant.isValid).toBe(false);
      expect(missingTenant.errors.some(e => e.field === "tenantId")).toBe(true);

      const missingPlot = AgronomicValidationService.validateCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        plotId: "",
      });
      expect(missingPlot.isValid).toBe(false);
      expect(missingPlot.errors.some(e => e.field === "plotId")).toBe(true);

      const missingAnalyst = AgronomicValidationService.validateCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        analystId: "",
      });
      expect(missingAnalyst.isValid).toBe(false);
      expect(missingAnalyst.errors.some(e => e.field === "analystId")).toBe(true);
    });

    it("MUST enforce analyst signature when requireAnalystSignature is enabled", () => {
      const res = AgronomicValidationService.validateCaneLaboratorySample(
        {
          ...VALID_SAMPLE_PAYLOAD,
          analystSignature: "",
        },
        { requireAnalystSignature: true }
      );

      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === "analystSignature")).toBe(true);
    });
  });

  describe("5. Cryptographic Sealing & Anti-Tampering Verification (SHA-256)", () => {
    it("generates a deterministic SHA-256 seal for valid samples", () => {
      const hash1 = AgronomicValidationService.generateCaneSampleHash(VALID_SAMPLE_PAYLOAD as any);
      const hash2 = AgronomicValidationService.generateCaneSampleHash(VALID_SAMPLE_PAYLOAD as any);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("successfully validates untampered samples through the governance pipeline", () => {
      const submitRes = pipeline.recordCaneLaboratorySample(VALID_SAMPLE_PAYLOAD);
      expect(submitRes.success).toBe(true);
      expect(submitRes.sample).toBeDefined();

      const integrityCheck = pipeline.verifySampleIntegrity(VALID_SAMPLE_PAYLOAD.sampleId, VALID_SAMPLE_PAYLOAD.tenantId);
      expect(integrityCheck.valid).toBe(true);
      expect(integrityCheck.computedHash).toBe(integrityCheck.recordedHash);
    });

    it("DETECTS TAMPERING immediately if any metric is altered retroactively in storage", () => {
      // 1. Submit sample legitimately
      const submitRes = pipeline.recordCaneLaboratorySample(VALID_SAMPLE_PAYLOAD);
      expect(submitRes.success).toBe(true);

      // 2. An unauthorized actor alters brixDegrees from 19.8 to 23.5 in the persistent record
      pipeline.tamperSampleForAuditTest(
        VALID_SAMPLE_PAYLOAD.sampleId,
        VALID_SAMPLE_PAYLOAD.tenantId,
        "brixDegrees",
        23.5
      );

      // 3. System watchdog checks sample integrity
      const integrityCheck = pipeline.verifySampleIntegrity(
        VALID_SAMPLE_PAYLOAD.sampleId,
        VALID_SAMPLE_PAYLOAD.tenantId
      );

      expect(integrityCheck.valid).toBe(false);
      expect(integrityCheck.computedHash).not.toBe(integrityCheck.recordedHash);
      expect(integrityCheck.reason).toContain("Violación de integridad de datos agronómicos");
      expect(integrityCheck.reason).toContain("Registro presuntamente alterado");
    });

    it("detects tampered records during comprehensive tenant-wide audits", () => {
      // Submit two samples
      pipeline.recordCaneLaboratorySample(VALID_SAMPLE_PAYLOAD);
      pipeline.recordCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        sampleId: "lab-sample-test-02",
        sampleCode: "LAB-MUESTRA-20260928-002",
        brixDegrees: 18.5,
        polPercent: 15.5,
      });

      // Tamper with the second sample
      pipeline.tamperSampleForAuditTest(
        "lab-sample-test-02",
        VALID_SAMPLE_PAYLOAD.tenantId,
        "polPercent",
        19.0
      );

      const auditSummary = pipeline.auditAllSamplesForTenant(VALID_SAMPLE_PAYLOAD.tenantId);
      expect(auditSummary.totalAudited).toBe(2);
      expect(auditSummary.validCount).toBe(1);
      expect(auditSummary.tamperedCount).toBe(1);
      expect(auditSummary.tamperedSampleIds).toContain("lab-sample-test-02");
    });
  });

  describe("6. Batey Weighbridge Scale Reconciliation & Field Deviation Control", () => {
    it("correctly reconciles normal weighbridge events within tolerance", () => {
      const reconciliation = pipeline.reconcileWeighbridgeReception({
        estimatedFieldTons: 25.0,
        grossWeightTons: 38.5,
        tareWeightTons: 14.0,
        ticketNumber: "TKT-BASC-001",
        plotCode: "TABLA_04",
        varietyCode: "CP72-2086",
        tenantId: "TENANT_PORTUGUESA",
        tolerancePercent: 20.0,
      });

      expect(reconciliation.netWeightTons).toBe(24.5);
      expect(reconciliation.varianceTons).toBe(-0.5);
      expect(reconciliation.toleranceExceeded).toBe(false);
      expect(reconciliation.status).toBe("NORMAL");
    });

    it("flags WARNING_DESVIACION when scale weight deviates from estimated field tons beyond tolerance", () => {
      const reconciliation = pipeline.reconcileWeighbridgeReception({
        estimatedFieldTons: 20.0,
        grossWeightTons: 45.0,
        tareWeightTons: 15.0, // net: 30.0t (50% over estimate -> deviation!)
        ticketNumber: "TKT-BASC-002",
        plotCode: "TABLA_08",
        varietyCode: "CR74-250",
        tenantId: "TENANT_PORTUGUESA",
        tolerancePercent: 20.0,
      });

      expect(reconciliation.netWeightTons).toBe(30.0);
      expect(reconciliation.variancePercent).toBe(50.0);
      expect(reconciliation.toleranceExceeded).toBe(true);
      expect(reconciliation.status).toBe("WARNING_DESVIACION");
    });

    it("marks RECHAZO_BASCULA if gross weight <= tare weight", () => {
      const reconciliation = pipeline.reconcileWeighbridgeReception({
        estimatedFieldTons: 25.0,
        grossWeightTons: 12.0,
        tareWeightTons: 14.0,
        ticketNumber: "TKT-BASC-003",
        plotCode: "TABLA_09",
        varietyCode: "CP72-2086",
        tenantId: "TENANT_PORTUGUESA",
      });

      expect(reconciliation.status).toBe("RECHAZO_BASCULA");
    });
  });

  describe("7. Multi-Tenant Partitioning and Strict Isolation", () => {
    it("MUST keep samples strictly segregated between different mill tenants", () => {
      pipeline.recordCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        sampleId: "sample-tenant-a",
        tenantId: "TENANT_PORTUGUESA",
      });

      pipeline.recordCaneLaboratorySample({
        ...VALID_SAMPLE_PAYLOAD,
        sampleId: "sample-tenant-b",
        sampleCode: "LAB-PALMAR-001",
        tenantId: "TENANT_EL_PALMAR",
      });

      const tenantASamples = pipeline.getSamplesByTenant("TENANT_PORTUGUESA");
      const tenantBSamples = pipeline.getSamplesByTenant("TENANT_EL_PALMAR");

      expect(tenantASamples).toHaveLength(1);
      expect(tenantASamples[0].sampleId).toBe("sample-tenant-a");

      expect(tenantBSamples).toHaveLength(1);
      expect(tenantBSamples[0].sampleId).toBe("sample-tenant-b");

      // Verify cross-tenant access returns undefined
      expect(pipeline.getSampleById("sample-tenant-b", "TENANT_PORTUGUESA")).toBeUndefined();
      expect(pipeline.getSampleById("sample-tenant-a", "TENANT_EL_PALMAR")).toBeUndefined();
    });
  });
});
