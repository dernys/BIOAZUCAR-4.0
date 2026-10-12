import { describe, it, expect, beforeEach } from "vitest";
import { industrialDataQualityGate } from "../services/dataProviders/IndustrialDataQualityGate";
import { dataProviderRegistry } from "../services/dataProviders/DataProviderRegistry";
import { tenantRuntimeManager } from "../services/runtime/TenantRuntimeManager";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";
import {
  assertValidIndustrialState,
  assertProductionNoSimulation,
  IndustrialStateViolationError,
} from "../types/industrialStateModel";
import {
  createCanonicalDataPoint,
  validateIndustrialDataPoint,
} from "../types/industrialDataPoint";

describe("BIOAZÚCAR 4.0 — FORENSIC INDUSTRIAL DATA TRUTH & PROVENANCE AUDIT", () => {
  beforeEach(() => {
    RuntimeProfileManager.getInstance().resetForTesting();
  });

  describe("Principle 1 & 4: Strict Provenance Classification (REAL, SIMULADO, HISTORICO, CALCULADO, ESTIMADO, PREDICHO, DESCONOCIDO)", () => {
    it("should correctly classify SIMULATED points and never allow them to mask as REAL", () => {
      const simPoint = createCanonicalDataPoint({
        runtimeMode: "SIMULATION",
        sourceType: "SIMULATOR",
        sourceId: "SIM-TANDEM-HUGOT",
        driverId: "driver-sim-01",
        protocol: "SIMULATOR",
        deviceId: "DEV-SIM-01",
        assetId: "MOLINO-01",
        tagId: "MILL_01_TCH",
        value: 450.5,
        engineeringUnit: "TCH",
        sequence: 101,
        quality: "SIMULATED",
      });

      expect(simPoint.isSimulated).toBe(true);
      expect(simPoint.provenance).toBe("SIMULATED_PROCESS_MODEL");

      const origin = industrialDataQualityGate.resolveOrigin(simPoint);
      expect(origin).toBe("SIMULATED");
      expect(origin).not.toBe("REAL");
    });

    it("should classify calculated, predicted, estimated, and historical points with exact provenance", () => {
      expect(industrialDataQualityGate.resolveOrigin("CALCULADO", false)).toBe("CALCULATED");
      expect(industrialDataQualityGate.resolveOrigin("PREDICHO", false)).toBe("PREDICTED");
      expect(industrialDataQualityGate.resolveOrigin("ESTIMADO", false)).toBe("ESTIMATED");
      expect(industrialDataQualityGate.resolveOrigin("HISTORICO", false)).toBe("HISTORICAL");
      expect(industrialDataQualityGate.resolveOrigin("DESCONOCIDO", false)).toBe("UNKNOWN");
      expect(industrialDataQualityGate.resolveOrigin("NO_VERIFICADO", false)).toBe("UNKNOWN");
    });

    it("should never convert unverified data point without source into REAL", () => {
      const unverified = {
        value: 123.4,
      } as any;

      const origin = industrialDataQualityGate.resolveOrigin(unverified);
      expect(origin).toBe("UNKNOWN");
      expect(origin).not.toBe("REAL");
    });
  });

  describe("Principle 2: Simulation Authorized Only When Explicitly Configured", () => {
    it("should fail-closed if simulation provider is activated under PRODUCTION profile", async () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

      await expect(
        dataProviderRegistry.setActiveProvider("provider-simulation-canonical")
      ).rejects.toThrow(/Cannot activate SimulationDataProvider in PRODUCTION profile/);
    });

    it("should fail-closed if tenant runtime switches to SIMULATION under PRODUCTION profile", () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");
      const runtime = tenantRuntimeManager.getOrCreateRuntime("tenant-test-prod", "LIVE_OT");

      expect(() => {
        runtime.setMode("SIMULATION");
      }).toThrow(/Switching to SIMULATION runtime mode is strictly prohibited under PRODUCTION profile/);
    });

    it("should enforce assertProductionNoSimulation invariant", () => {
      expect(() => {
        assertProductionNoSimulation("PRODUCTION", "SIMULATION");
      }).toThrowError(IndustrialStateViolationError);

      expect(() => {
        assertProductionNoSimulation("PRODUCTION", "LIVE_OT", { isSimulated: true });
      }).toThrowError(IndustrialStateViolationError);

      expect(() => {
        assertProductionNoSimulation("PRODUCTION", "LIVE_OT", { isFallback: true });
      }).toThrowError(IndustrialStateViolationError);
    });
  });

  describe("Principle 3: Disconnected Real Installation Receives Zero Synthetic Replacements", () => {
    it("should return zeroed values and BAD quality when LIVE_OT is disconnected", () => {
      const runtime = tenantRuntimeManager.getOrCreateRuntime("tenant-disconnected-mill", "LIVE_OT");
      runtime.setOTConfig({
        status: "DISCONNECTED",
        isLiveConnection: false,
      });

      const snapshot = runtime.getTelemetrySnapshot();

      expect(snapshot.isSimulated).toBe(false);
      expect(snapshot.quality).toBe("BAD");
      expect(snapshot.provenance).toBe("DESCONOCIDO");
      expect(snapshot.tch).toBe(0);
      expect(snapshot.boilerPressureHP).toBe(0);
      expect(snapshot.powerGeneratedMW).toBe(0);
    });

    it("should return zeroed telemetry and NO_VERIFICADO provenance in WAITING_FOR_COMMISSIONING mode", () => {
      const runtime = tenantRuntimeManager.getOrCreateRuntime("tenant-uncommissioned-mill", "WAITING_FOR_COMMISSIONING");

      const snapshot = runtime.getTelemetrySnapshot();

      expect(snapshot.isSimulated).toBe(false);
      expect(snapshot.quality).toBe("BAD");
      expect(snapshot.provenance).toBe("NO_VERIFICADO");
      expect(snapshot.tch).toBe(0);
      expect(snapshot.sugarBagsToday).toBe(0);
    });
  });

  describe("Principle 5 & 6: Data Truth Validation and Production Integrity", () => {
    it("should flag validation error if simulated data attempts to carry LIVE_OT label", () => {
      const result = validateIndustrialDataPoint({
        runtimeMode: "SIMULATION",
        sourceType: "SIMULATOR",
        sourceId: "SIM-01",
        driverId: "drv-01",
        protocol: "SIMULATOR",
        deviceId: "DEV-01",
        assetId: "AST-01",
        tagId: "TAG-01",
        value: 100,
        engineeringUnit: "bar",
        dataType: "FLOAT",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1,
        quality: "GOOD",
        qualityReason: "NORMAL",
        calibrationState: "CALIBRATED",
        schemaVersion: "4.0.0",
        source: "LIVE_OT", // illegal contradiction!
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("DATA_TRUTH_VIOLATION"))).toBe(true);
    });

    it("should reject simulated data quality in PRODUCTION profile point validation", () => {
      const result = validateIndustrialDataPoint({
        runtimeMode: "PRODUCTION",
        sourceType: "PLC",
        sourceId: "PLC-01",
        driverId: "drv-01",
        protocol: "MODBUS_TCP",
        deviceId: "DEV-01",
        assetId: "AST-01",
        tagId: "TAG-01",
        value: 100,
        engineeringUnit: "bar",
        dataType: "FLOAT",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1,
        quality: "SIMULATED", // illegal in production!
        qualityReason: "NORMAL",
        calibrationState: "CALIBRATED",
        schemaVersion: "4.0.0",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("CRITICAL_PROVENANCE_VIOLATION"))).toBe(true);
    });
  });
});
