/**
 * BioAzúcar 4.0 — P0-09 BioAI Real Datasets & Physics Models Calibration Test Suite
 * 
 * Verifies:
 * 1. 12-day continuous zafra dataset (>= 10 days / 240+ hourly records).
 * 2. SHA-256 cryptographic provenance hash immutability.
 * 3. Hugot compound imbibition calibration achieves MAPE < 3.5%.
 * 4. ASME PTC 4 boiler loss model calibration achieves MAPE < 3.5%.
 * 5. Turbogeneration specific consumption model achieves MAPE < 3.5%.
 * 6. Operational process drift diagnosis (roller wear & boiler fouling).
 * 7. Train/Test split generalization stability (80/20 and 70/30).
 * 8. Strict rejection/fail-closed when dataset has < 10 days of records.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  REAL_ZAFRA_12_DAY_TELEMETRY,
  REAL_ZAFRA_DATASET_METADATA,
  ZAFRA_DATASET_SHA256_PROVENANCE,
} from "../services/bioai/datasets/realZafraDataset";
import {
  BioAiModelCalibrationService,
  bioAiCalibrationService,
} from "../services/bioai/BioAiModelCalibrationService";
import { sha256Hex } from "../utils/cryptoUtils";

describe("P0-09: BioAI Real Datasets & Physics Calibration (Hugot & ASME PTC 4)", () => {
  let calibrator: BioAiModelCalibrationService;

  beforeEach(() => {
    calibrator = BioAiModelCalibrationService.getInstance();
  });

  describe("1. Dataset Integrity & Cryptographic Provenance", () => {
    it("should provide at least 10 continuous days of zafra telemetry (12 days actual = 288 hours)", () => {
      expect(REAL_ZAFRA_DATASET_METADATA.totalDays).toBeGreaterThanOrEqual(10);
      expect(REAL_ZAFRA_12_DAY_TELEMETRY.length).toBe(288);
      expect(REAL_ZAFRA_DATASET_METADATA.totalRecords).toBe(288);

      const days = new Set(REAL_ZAFRA_12_DAY_TELEMETRY.map((r) => r.dayNumber));
      expect(days.size).toBe(12);
      for (let d = 1; d <= 12; d++) {
        expect(days.has(d)).toBe(true);
      }
    });

    it("should possess a deterministic, tamper-evident SHA-256 provenance hash", () => {
      const serialized = JSON.stringify(REAL_ZAFRA_12_DAY_TELEMETRY);
      const computedHash = sha256Hex(serialized);

      expect(computedHash).toBe(ZAFRA_DATASET_SHA256_PROVENANCE);
      expect(REAL_ZAFRA_DATASET_METADATA.sha256ProvenanceHash).toBe(computedHash);
      expect(REAL_ZAFRA_DATASET_METADATA.anonymizationProtocol).toBe(
        "HIPAA_FERPA_EQUIVALENT_INDUSTRIAL_OT_ANON"
      );
    });

    it("should reflect realistic operational boundaries across all industrial variables", () => {
      for (const record of REAL_ZAFRA_12_DAY_TELEMETRY) {
        expect(record.tch).toBeGreaterThanOrEqual(200);
        expect(record.tch).toBeLessThanOrEqual(350);

        expect(record.caneFiberPercent).toBeGreaterThanOrEqual(11.0);
        expect(record.caneFiberPercent).toBeLessThanOrEqual(16.0);

        expect(record.canePolPercent).toBeGreaterThanOrEqual(12.0);
        expect(record.canePolPercent).toBeLessThanOrEqual(16.5);

        expect(record.observedExtractionPercent).toBeGreaterThanOrEqual(93.0);
        expect(record.observedExtractionPercent).toBeLessThanOrEqual(98.5);

        expect(record.observedBoilerEfficiencyPercent).toBeGreaterThanOrEqual(76.0);
        expect(record.observedBoilerEfficiencyPercent).toBeLessThanOrEqual(85.0);
      }
    });
  });

  describe("2. Acceptance Criteria Verification (MAPE < 3.5%)", () => {
    it("should calibrate Hugot extraction model with Test MAPE < 3.5%", () => {
      const calibration = calibrator.executeCalibration(REAL_ZAFRA_12_DAY_TELEMETRY, 0.8);

      expect(calibration.hugotExtraction.calibratedKw).toBeGreaterThan(1.8);
      expect(calibration.hugotExtraction.calibratedKw).toBeLessThan(2.5);

      const testMape = calibration.hugotExtraction.testMetrics.meanAbsolutePercentageError;
      expect(testMape).toBeLessThan(3.5);
      // High-precision expectation
      expect(testMape).toBeLessThan(1.0);
      expect(calibration.hugotExtraction.testMetrics.rSquared).toBeGreaterThan(0.30);
    });

    it("should calibrate ASME PTC 4 boiler loss model with Test MAPE < 3.5%", () => {
      const calibration = calibrator.executeCalibration(REAL_ZAFRA_12_DAY_TELEMETRY, 0.8);

      expect(calibration.asmeBoiler.calibratedRadiationLossPercent).toBeGreaterThan(1.0);
      expect(calibration.asmeBoiler.calibratedRadiationLossPercent).toBeLessThan(2.0);

      const testMape = calibration.asmeBoiler.testMetrics.meanAbsolutePercentageError;
      expect(testMape).toBeLessThan(3.5);
      expect(testMape).toBeLessThan(1.0);
      expect(calibration.asmeBoiler.testMetrics.rSquared).toBeGreaterThan(0.25);
    });

    it("should calibrate Turbogenerator specific consumption model with Test MAPE < 3.5%", () => {
      const calibration = calibrator.executeCalibration(REAL_ZAFRA_12_DAY_TELEMETRY, 0.8);

      expect(calibration.turbogeneration.isentropicEfficiencyPercent).toBeGreaterThan(75);
      const testMape = calibration.turbogeneration.testMetrics.meanAbsolutePercentageError;
      expect(testMape).toBeLessThan(3.5);
    });

    it("should issue full P0-09 formal compliance certificate", () => {
      const calibration = calibrator.executeCalibration(REAL_ZAFRA_12_DAY_TELEMETRY, 0.8);

      expect(calibration.complianceStatus.meetsMapeTarget).toBe(true);
      expect(calibration.complianceStatus.meetsTenDaysRequirement).toBe(true);
      expect(calibration.complianceStatus.auditCertification).toContain(
        "CERTIFIED_P0_09_ACCURACY_TARGET_ACHIEVED"
      );
    });
  });

  describe("3. Operational Process Drift & Wear Diagnosis", () => {
    it("should detect gradual roller wear rate over the 12-day period", () => {
      const calibration = calibrator.executeCalibration(REAL_ZAFRA_12_DAY_TELEMETRY, 0.8);
      const drift = calibration.processDrift;

      // Roller wear produces a small negative slope in extraction per day
      expect(drift.extractionDriftPercentPerDay).toBeLessThan(0);
      expect(drift.extractionDriftPercentPerDay).toBeGreaterThan(-0.1);
      expect(drift.rollerWearIndicatorPercent).toBeGreaterThan(0);
    });

    it("should detect boiler fouling dynamics and diagnosis summary", () => {
      const calibration = calibrator.executeCalibration(REAL_ZAFRA_12_DAY_TELEMETRY, 0.8);
      const drift = calibration.processDrift;

      expect(drift.driftDiagnosisSummary).toContain("Mill roller wear");
      expect(drift.driftDiagnosisSummary).toContain("soot blowing");
    });
  });

  describe("4. Generalization & Fail-Closed Behavior", () => {
    it("should maintain MAPE < 3.5% across alternative train/test split (70/30)", () => {
      const calibration = calibrator.executeCalibration(REAL_ZAFRA_12_DAY_TELEMETRY, 0.7);

      expect(calibration.hugotExtraction.testMetrics.meanAbsolutePercentageError).toBeLessThan(3.5);
      expect(calibration.asmeBoiler.testMetrics.meanAbsolutePercentageError).toBeLessThan(3.5);
      expect(calibration.complianceStatus.meetsMapeTarget).toBe(true);
    });

    it("should fail-closed and reject datasets with fewer than 10 continuous days (< 240 hours)", () => {
      const insufficientDataset = REAL_ZAFRA_12_DAY_TELEMETRY.slice(0, 100); // Only 100 hours

      expect(() => {
        calibrator.executeCalibration(insufficientDataset, 0.8);
      }).toThrow(/Minimum 240 records \(10 days @ 24h\/day\) required by P0-09/);
    });
  });
});
