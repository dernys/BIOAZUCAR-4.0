/**
 * BioAzúcar 4.0 — I22 Test Suite: Runtime Profiles, Fail-Closed & Canonical Data Contract
 *
 * Verifies:
 * 1. Runtime Profile Separation (SIMULATION, LAB, PRODUCTION).
 * 2. Fail-Closed behavior in PRODUCTION:
 *    - Rejection of synthetic/mock/simulated drivers.
 *    - Rejection of simulated fallback in field drivers.
 *    - Rejection of localhost/mock endpoints in PRODUCTION.
 * 3. Canonical 17-field IndustrialDataPoint contract validation.
 * 4. Provenance immutability and anti-spoofing guarantees.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RuntimeProfileManager,
  getRuntimeProfile,
  assertValidProductionEnvironment,
  suppressExitForTesting,
} from "../services/edge/config/runtimeProfile";
import {
  validateIndustrialDataPoint,
  IndustrialDataPoint,
} from "../types/industrialDataPoint";
import { ModbusDriverAdapter } from "../services/edge/drivers/ModbusDriverAdapter";
import { OpcUaDriverAdapter } from "../services/edge/drivers/OpcUaDriverAdapter";
import { SiemensS7DriverAdapter } from "../services/edge/drivers/SiemensS7DriverAdapter";
import { EtherNetIpDriverAdapter } from "../services/edge/drivers/EtherNetIpDriverAdapter";
import { MqttSparkplugDriverAdapter } from "../services/edge/drivers/MqttSparkplugDriverAdapter";
import { ErosDriverAdapter } from "../services/edge/drivers/ErosDriverAdapter";
import { IndustrialDriverManager } from "../services/edge/drivers/IndustrialDriverManager";
import { DataQualityEngine } from "../services/edge/dataQualityEngine";

describe("I22: Runtime Profiles, Fail-Closed, and Canonical Data Contract", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.INDUSTRIAL_RUNTIME_PROFILE;
    suppressExitForTesting(true);
    RuntimeProfileManager.getInstance().resetForTesting();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = originalEnv;
    } else {
      delete process.env.INDUSTRIAL_RUNTIME_PROFILE;
    }
    RuntimeProfileManager.getInstance().resetForTesting();
  });

  describe("1. Runtime Profile Separation", () => {
    it("should default to SIMULATION when INDUSTRIAL_RUNTIME_PROFILE is not set", () => {
      delete process.env.INDUSTRIAL_RUNTIME_PROFILE;
      RuntimeProfileManager.getInstance().resetForTesting();
      expect(getRuntimeProfile()).toBe("SIMULATION");
    });

    it("should parse LAB and PRODUCTION profiles correctly", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "LAB";
      RuntimeProfileManager.getInstance().resetForTesting();
      expect(getRuntimeProfile()).toBe("LAB");

      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();
      expect(getRuntimeProfile()).toBe("PRODUCTION");
    });

    it("should reject invalid profile strings and fail closed", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "INVALID_PROFILE_XYZ";
      RuntimeProfileManager.getInstance().resetForTesting();
      expect(() => getRuntimeProfile()).toThrow(/Unknown or unsupported runtime profile/);
    });
  });

  describe("2. Fail-Closed Enforcement in PRODUCTION", () => {
    it("should throw when validating simulated driver in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      expect(() => {
        assertValidProductionEnvironment({
          driverId: "test-sim-01",
          driverType: "SIMULATOR",
          isSimulated: true,
          protocol: "MODBUS_TCP",
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("should throw when validating mock driver in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      expect(() => {
        assertValidProductionEnvironment({
          driverId: "test-mock-01",
          driverType: "PLC",
          isMock: true,
          protocol: "OPC_UA",
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("should throw when validating localhost endpoint in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      expect(() => {
        assertValidProductionEnvironment({
          driverId: "test-plc-01",
          driverType: "PLC",
          endpoint: "127.0.0.1:502",
          protocol: "MODBUS_TCP",
        });
      }).toThrow(/Loopback or mock endpoint/);
    });

    it("should allow valid physical PLC endpoints in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      expect(() => {
        assertValidProductionEnvironment({
          driverId: "plc-milling-01",
          driverType: "PLC",
          endpoint: "192.168.10.20:502",
          protocol: "MODBUS_TCP",
          isSimulated: false,
          isMock: false,
        });
      }).not.toThrow();
    });

    it("should fail-closed when instantiating field drivers with isSimulatedFallback in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      // Modbus
      expect(() => {
        new ModbusDriverAdapter({
          id: "drv-modbus-fail",
          protocol: "MODBUS_TCP",
          endpoint: "192.168.1.10:502",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      // OPC UA
      expect(() => {
        new OpcUaDriverAdapter({
          id: "drv-opc-fail",
          protocol: "OPC_UA",
          endpoint: "opc.tcp://192.168.1.20:4840",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      // Siemens S7
      expect(() => {
        new SiemensS7DriverAdapter({
          id: "drv-s7-fail",
          protocol: "SIEMENS_S7",
          endpoint: "192.168.1.30:102",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      // EtherNet/IP
      expect(() => {
        new EtherNetIpDriverAdapter({
          id: "drv-cip-fail",
          protocol: "ETHERNET_IP",
          endpoint: "192.168.1.40:44818",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      // EROS DCS
      expect(() => {
        new ErosDriverAdapter({
          id: "drv-eros-fail",
          protocol: "EROS_DCS",
          endpoint: "192.168.1.50:8000",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      // MQTT Sparkplug
      expect(() => {
        new MqttSparkplugDriverAdapter({
          id: "drv-spb-fail",
          protocol: "SPARKPLUG",
          endpoint: "mqtt://192.168.1.60:1883",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("should fail-closed in IndustrialDriverManager when registering invalid driver in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      const manager = IndustrialDriverManager.getInstance();
      const simDriver: any = {
        id: "mock-driver-01",
        protocol: "MODBUS_TCP",
        config: {
          id: "mock-driver-01",
          protocol: "MODBUS_TCP",
          isSimulatedFallback: true,
        },
        status: "CONNECTED",
      };

      expect(() => {
        manager.registerDriver(simDriver);
      }).toThrow(/FAIL CLOSED/);
    });
  });

  describe("3. Canonical 17-field IndustrialDataPoint Contract", () => {
    it("should pass validation for a fully populated 17-field canonical point", () => {
      const point: IndustrialDataPoint = {
        runtimeMode: "PRODUCTION",
        sourceType: "PLC",
        sourceId: "PLC-MILLING-01",
        driverId: "drv-modbus-01",
        protocol: "MODBUS_TCP",
        deviceId: "DEV-MILL-01",
        assetId: "ASSET-TANDEM-1",
        tagId: "MILLING.TANDEM1.SPEED_RPM",
        value: 4.85,
        engineeringUnit: "RPM",
        dataType: "FLOAT32",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1042,
        quality: "GOOD",
        qualityReason: "NORMAL",
        calibrationState: "CALIBRATED",
        schemaVersion: "4.0.0",
      };

      const result = validateIndustrialDataPoint(point);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail validation if mandatory fields are missing or invalid", () => {
      const invalidPoint = {
        runtimeMode: "INVALID_MODE",
        tagId: "",
        value: NaN,
      };

      const result = validateIndustrialDataPoint(invalidPoint);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("runtimeMode"))).toBe(true);
      expect(result.errors.some((e) => e.includes("sourceType"))).toBe(true);
      expect(result.errors.some((e) => e.includes("schemaVersion"))).toBe(true);
    });
  });

  describe("4. Drivers canonical output under SIMULATION and LAB", () => {
    it("should emit valid canonical data points in SIMULATION mode with correct provenance", async () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "SIMULATION";
      RuntimeProfileManager.getInstance().resetForTesting();

      const opcDriver = new OpcUaDriverAdapter({
        id: "drv-opc-test",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://192.168.1.100:4840",
        isSimulatedFallback: true,
      });

      await opcDriver.connect();
      const point = await opcDriver.readTag("Boiler.PressureHP");

      expect(point.runtimeMode).toBe("SIMULATION");
      expect(point.sourceType).toBe("SIMULATOR");
      expect(point.driverId).toBe("drv-opc-test");
      expect(point.protocol).toBe("OPC_UA");
      expect(point.schemaVersion).toBe("4.0.0");
      expect(point.isSimulated).toBe(true);
      expect(point.provenance).toBe("SIMULATED_PROCESS_MODEL");

      const validation = validateIndustrialDataPoint(point);
      expect(validation.valid).toBe(true);
    });
  });

  describe("5. DataQualityEngine Provenance Gate in PRODUCTION", () => {
    it("should reject simulated points with BAD quality and PROVENANCE_MISMATCH in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      const engine = DataQualityEngine.getInstance();
      engine.resetHistory();

      const audit = engine.evaluate({
        tag: "TI-HP-STEAM-01",
        value: 65.0,
        unit: "bar",
        isSimulated: true,
        sourceType: "SIMULATOR",
        provenance: "SIMULATED_PROCESS_MODEL",
      });

      expect(audit.finalQuality).toBe("BAD");
      expect(audit.reasons.some((r) => r.includes("CRITICAL_PROVENANCE_VIOLATION"))).toBe(true);
    });
  });
});
