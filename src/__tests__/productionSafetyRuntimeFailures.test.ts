import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BioAzucarEdgeDaemon } from "../services/edge/daemon";
import {
  assertProductionNoSimulation,
  assertValidIndustrialState,
} from "../types/industrialStateModel";
import { assertValidProductionEnvironment, RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

describe("Production Safety Guards & Hard Failures (IEC 62443 / Production Governance)", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
    RuntimeProfileManager.getInstance().resetForTesting();
  });

  afterEach(() => {
    process.env = { ...origEnv };
    RuntimeProfileManager.getInstance().resetForTesting();
  });

  describe("1. PRODUCTION + SIMULATION = Hard Startup Failure", () => {
    it("should throw startup failure when attempting SIMULATION mode under PRODUCTION profile", () => {
      expect(() => {
        assertProductionNoSimulation("PRODUCTION", "SIMULATION");
      }).toThrowError(/Illegal simulation mode requested in PRODUCTION/i);
    });

    it("should reject simulated driver or mock telemetry in production safety guard", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      expect(() => {
        assertValidProductionEnvironment({
          driverId: "sim-test-01",
          driverType: "SIMULATOR",
          isSimulated: true,
          protocol: "MODBUS_TCP",
        });
      }).toThrow(/FAIL CLOSED/);

      expect(() => {
        assertValidProductionEnvironment({
          driverId: "mock-plc-01",
          driverType: "PLC",
          isMock: true,
          protocol: "OPC_UA",
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("should reject simulated telemetry or synthetic fallback in production state invariants", () => {
      expect(() => {
        assertProductionNoSimulation("PRODUCTION", "LIVE_OT", { isSimulated: true });
      }).toThrowError(/Simulated telemetry rejected in PRODUCTION/i);

      expect(() => {
        assertProductionNoSimulation("PRODUCTION", "LIVE_OT", { isFallback: true });
      }).toThrowError(/Synthetic fallback rejected in PRODUCTION/i);
    });

    it("should reject invalid state combinations in production state assertion", () => {
      expect(() => {
        assertValidIndustrialState("PRODUCTION", "WAITING_FOR_COMMISSIONING", "ONLINE", "LAB_VALIDATED");
      }).toThrowError(/Connectivity cannot be 'ONLINE' while still in 'WAITING_FOR_COMMISSIONING'/i);
    });
  });

  describe("2. PRODUCTION + Insecure HTTP Cloud Sync URL = Startup Failure", () => {
    it("should abort daemon startup if cloudSyncUrl starts with http:// instead of https://", async () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";

      const daemon = new BioAzucarEdgeDaemon({
        edgeSecret: "super-secure-production-secret-entropy-9999",
        cloudSyncUrl: "http://insecure-cloud.central-azucar.com/api/sync",
        tenantId: "TENANT_PORTUGUESA",
        edgeId: "EDGE_NODE_01",
        cloudSyncIntervalMs: 5000,
        otInterface: "eth1",
        dmzInterface: "eth0",
        healthPort: 9091,
        batchSize: 1000,
        heartbeatIntervalMs: 10000,
        rejectUnauthorized: true,
      });

      await expect(daemon.start()).rejects.toThrowError(
        /Insecure HTTP sync endpoint.*rejected in PRODUCTION profile/i
      );
    });
  });

  describe("3. PRODUCTION without Secret = Startup Failure", () => {
    it("should abort daemon startup if BIOAZUCAR_EDGE_SECRET is missing or empty", async () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      delete process.env.BIOAZUCAR_EDGE_SECRET;

      const daemon = new BioAzucarEdgeDaemon({
        edgeSecret: "",
        cloudSyncUrl: "https://secure-edge-hub.central-azucar.com/api/sync",
        tenantId: "TENANT_PORTUGUESA",
        edgeId: "EDGE_NODE_01",
        cloudSyncIntervalMs: 5000,
        otInterface: "eth1",
        dmzInterface: "eth0",
        healthPort: 9091,
        batchSize: 1000,
        heartbeatIntervalMs: 10000,
        rejectUnauthorized: true,
      });

      await expect(daemon.start()).rejects.toThrowError(
        /Missing or insecure BIOAZUCAR_EDGE_SECRET in PRODUCTION/i
      );
    });

    it("should abort daemon startup if BIOAZUCAR_EDGE_SECRET uses a known weak default", async () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";

      const daemon = new BioAzucarEdgeDaemon({
        edgeSecret: "change-me",
        cloudSyncUrl: "https://secure-edge-hub.central-azucar.com/api/sync",
        tenantId: "TENANT_PORTUGUESA",
        edgeId: "EDGE_NODE_01",
        cloudSyncIntervalMs: 5000,
        otInterface: "eth1",
        dmzInterface: "eth0",
        healthPort: 9091,
        batchSize: 1000,
        heartbeatIntervalMs: 10000,
        rejectUnauthorized: true,
      });

      await expect(daemon.start()).rejects.toThrowError(
        /Missing or insecure BIOAZUCAR_EDGE_SECRET in PRODUCTION/i
      );
    });
  });
});
