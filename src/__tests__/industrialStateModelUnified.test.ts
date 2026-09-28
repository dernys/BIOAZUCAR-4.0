import { describe, it, expect, beforeEach } from "vitest";
import {
  DeploymentProfile,
  RuntimeMode,
  ConnectivityState,
  ValidationState,
  VALID_DEPLOYMENT_PROFILES,
  VALID_RUNTIME_MODES,
  VALID_CONNECTIVITY_STATES,
  VALID_VALIDATION_STATES,
  validateStateCoherence,
  assertValidIndustrialState,
  assertProductionNoSimulation,
  IndustrialStateViolationError,
} from "../types/industrialStateModel";
import {
  IndustrialStateModelEngine,
} from "../services/runtime/IndustrialStateModelEngine";

describe("BIOAZÚCAR 4.0 — UNIFIED INDUSTRIAL STATE MODEL & ENFORCEMENT", () => {
  let engine: IndustrialStateModelEngine;

  beforeEach(() => {
    engine = IndustrialStateModelEngine.getInstance();
    engine.clearForTesting();
    delete process.env.INDUSTRIAL_RUNTIME_PROFILE;
  });

  describe("1. Strict Separation of 4 Industrial State Axes", () => {
    it("should define exactly 3 Deployment Profiles", () => {
      expect(VALID_DEPLOYMENT_PROFILES).toEqual(["SIMULATION", "LAB", "PRODUCTION"]);
      expect(VALID_DEPLOYMENT_PROFILES).toHaveLength(3);
    });

    it("should define exactly 5 Runtime Modes", () => {
      expect(VALID_RUNTIME_MODES).toEqual([
        "SIMULATION",
        "LIVE_OT",
        "HYBRID",
        "HISTORICAL_REPLAY",
        "WAITING_FOR_COMMISSIONING",
      ]);
      expect(VALID_RUNTIME_MODES).toHaveLength(5);
    });

    it("should define exactly 8 Connectivity States", () => {
      expect(VALID_CONNECTIVITY_STATES).toEqual([
        "ONLINE",
        "OFFLINE",
        "DEGRADED",
        "CONNECTING",
        "DISCONNECTED",
        "FAULT",
        "SYNCING",
        "SYNC_ERROR",
      ]);
      expect(VALID_CONNECTIVITY_STATES).toHaveLength(8);
    });

    it("should define exactly 8 Formal Validation States conforming to industrial maturation", () => {
      expect(VALID_VALIDATION_STATES).toEqual([
        "DESIGNED",
        "IMPLEMENTED",
        "TESTED",
        "LAB_VALIDATED",
        "FAT_VALIDATED",
        "SAT_VALIDATED",
        "FIELD_VALIDATED",
        "PRODUCTION_OPERATIONAL",
      ]);
      expect(VALID_VALIDATION_STATES).toHaveLength(8);
    });
  });

  describe("2. Production Fail-Closed Rules (Zero Simulation / Zero Mock Fallback)", () => {
    it("should reject SIMULATION mode when DeploymentProfile is PRODUCTION", () => {
      const result = validateStateCoherence("PRODUCTION", "SIMULATION", "ONLINE", "TESTED");
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes("RuntimeMode cannot be 'SIMULATION'"))).toBe(true);

      expect(() => {
        assertValidIndustrialState("PRODUCTION", "SIMULATION", "ONLINE", "TESTED");
      }).toThrowError(IndustrialStateViolationError);
    });

    it("should reject simulated data points in PRODUCTION", () => {
      const result = validateStateCoherence(
        "PRODUCTION",
        "LIVE_OT",
        "ONLINE",
        "FIELD_VALIDATED",
        { isSimulatedData: true }
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes("Simulated data points are strictly prohibited"))).toBe(true);
    });

    it("should reject mock fallback in PRODUCTION", () => {
      const result = validateStateCoherence(
        "PRODUCTION",
        "LIVE_OT",
        "ONLINE",
        "FIELD_VALIDATED",
        { isMockFallback: true }
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes("Mock or synthetic fallback is strictly prohibited"))).toBe(true);
    });

    it("should reject claiming PRODUCTION_OPERATIONAL when profile is SIMULATION", () => {
      const result = validateStateCoherence("SIMULATION", "SIMULATION", "ONLINE", "PRODUCTION_OPERATIONAL");
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes("ValidationState cannot be 'PRODUCTION_OPERATIONAL' in non-production"))).toBe(true);
    });

    it("should pass coherence check for valid production operational state", () => {
      const result = validateStateCoherence("PRODUCTION", "LIVE_OT", "ONLINE", "PRODUCTION_OPERATIONAL");
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("3. Industrial State Model Engine Transitions & Auditing", () => {
    it("should default to WAITING_FOR_COMMISSIONING in PRODUCTION profile", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      const state = engine.getTenantState("TENANT_TEST_01");

      expect(state.deploymentProfile).toBe("PRODUCTION");
      expect(state.runtimeMode).toBe("WAITING_FOR_COMMISSIONING");
      expect(state.connectivityState).toBe("CONNECTING");
      expect(state.simulationPermitted).toBe(false);
      expect(state.isolationStrict).toBe(true);
    });

    it("should default to SIMULATION in SIMULATION profile", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "SIMULATION";
      const state = engine.getTenantState("TENANT_TEST_02");

      expect(state.deploymentProfile).toBe("SIMULATION");
      expect(state.runtimeMode).toBe("SIMULATION");
      expect(state.simulationPermitted).toBe(true);
      expect(state.isolationStrict).toBe(false);
    });

    it("should successfully transition valid industrial states and record audit trail", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      const t1 = engine.getTenantState("TENANT_MOLINO_01");

      const updated = engine.transitionState("TENANT_MOLINO_01", {
        runtimeMode: "LIVE_OT",
        connectivityState: "ONLINE",
        validationState: "FIELD_VALIDATED",
        actor: "lead-engineer@bioazucar.com",
        reason: "SAT and Field commissioning completed successfully",
      });

      expect(updated.runtimeMode).toBe("LIVE_OT");
      expect(updated.connectivityState).toBe("ONLINE");
      expect(updated.validationState).toBe("FIELD_VALIDATED");

      const history = engine.getAuditHistory("TENANT_MOLINO_01");
      expect(history).toHaveLength(1);
      expect(history[0].actor).toBe("lead-engineer@bioazucar.com");
      expect(history[0].reason).toContain("commissioning completed");
    });

    it("should prevent validation state regression without explicit rollback justification", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      engine.transitionState("TENANT_MOLINO_02", {
        runtimeMode: "LIVE_OT",
        connectivityState: "ONLINE",
        validationState: "FIELD_VALIDATED",
        actor: "lead-engineer@bioazucar.com",
        reason: "Field validation completed",
      });

      expect(() => {
        engine.transitionState("TENANT_MOLINO_02", {
          validationState: "DESIGNED",
          actor: "operator@bioazucar.com",
          reason: "Routine config adjustment",
        });
      }).toThrowError(IndustrialStateViolationError);

      // Allowed if explicit decommission/rollback reason provided
      const regressed = engine.transitionState("TENANT_MOLINO_02", {
        validationState: "DESIGNED",
        actor: "superadmin@bioazucar.com",
        reason: "Formal decommission and equipment overhaul rollback",
      });
      expect(regressed.validationState).toBe("DESIGNED");
    });
  });
});
