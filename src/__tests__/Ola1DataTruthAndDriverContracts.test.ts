/**
 * BioAzúcar 4.0 — Ola 1 Verification Test Suite
 * 
 * Tests:
 *  - I1: IIndustrialDriver Contract & IndustrialDriverManager Lifecycle
 *  - I14: Industrial Data Quality Engine (Range, Deadband, Skew, Outliers)
 *  - I15: Data Truth Real & Golden Rule ("SIMULATED jamás se vuelve REAL")
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OpcUaDriverAdapter } from "../services/edge/drivers/OpcUaDriverAdapter";
import { ModbusDriverAdapter } from "../services/edge/drivers/ModbusDriverAdapter";
import { MqttSparkplugDriverAdapter } from "../services/edge/drivers/MqttSparkplugDriverAdapter";
import { industrialDriverManager } from "../services/edge/drivers/IndustrialDriverManager";
import { dataQualityEngine } from "../services/edge/dataQualityEngine";

describe("BioAzúcar 4.0 — Ola 1: Driver Contracts & Data Truth Engine", () => {
  beforeEach(() => {
    industrialDriverManager.resetRegistry();
    dataQualityEngine.resetHistory();
  });

  describe("I1: Canonical Driver Contracts & Lifecycle", () => {
    it("should connect, read and report health for OPC UA driver", async () => {
      const opcDriver = new OpcUaDriverAdapter({
        id: "drv-opc-tandem1",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://192.168.10.15:4840",
        readOnly: false,
        isSimulatedFallback: false,
      });

      expect(opcDriver.status).toBe("DISCONNECTED");
      const connected = await opcDriver.connect();
      expect(connected).toBe(true);
      expect(opcDriver.status).toBe("AUTHENTICATED");

      const point = await opcDriver.readTag("ns=2;s=Boiler.PressureHP");
      expect(point.tag).toBe("ns=2;s=Boiler.PressureHP");
      expect(point.quality).toBe("GOOD");
      expect(point.provenance).toBe("PHYSICAL_OT");
      expect(point.isSimulated).toBe(false);

      const health = opcDriver.getHealth();
      expect(health.readSuccessCount).toBe(1);
      expect(health.isPhysical).toBe(true);

      await opcDriver.disconnect();
      expect(opcDriver.status).toBe("DISCONNECTED");
    });

    it("should enforce read-only and clearance security boundaries on writeTag", async () => {
      const readOnlyDriver = new ModbusDriverAdapter({
        id: "drv-modbus-scale",
        protocol: "MODBUS",
        endpoint: "192.168.10.25:502",
        readOnly: true,
      });

      await readOnlyDriver.connect();

      // Expect write to fail on readOnly driver
      await expect(
        readOnlyDriver.writeTag("40001", 1500, 3, "Ajuste de tara de báscula")
      ).rejects.toThrow(/READ_ONLY mode/);

      // Create writable driver
      const writableDriver = new ModbusDriverAdapter({
        id: "drv-modbus-writable",
        protocol: "MODBUS",
        endpoint: "192.168.10.26:502",
        readOnly: false,
      });
      await writableDriver.connect();

      // Expect write to fail if clearance < 2
      await expect(
        writableDriver.writeTag("40002", 700, 1, "Ajuste sin autorización")
      ).rejects.toThrow(/Insufficient clearance/);

      // Expect write to fail if justification is missing
      await expect(
        writableDriver.writeTag("40002", 700, 2, "")
      ).rejects.toThrow(/justification mandatory/);

      // Valid write succeeds
      const writeOk = await writableDriver.writeTag("40002", 700, 2, "Consigna aprobada por jefe de turno");
      expect(writeOk).toBe(true);
    });

    it("should orchestrate multiple drivers via IndustrialDriverManager", async () => {
      const opc = new OpcUaDriverAdapter({
        id: "drv-opc-1",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://192.168.10.15:4840",
      });
      const modbus = new ModbusDriverAdapter({
        id: "drv-modbus-1",
        protocol: "MODBUS",
        endpoint: "192.168.10.20:502",
      });
      const spb = new MqttSparkplugDriverAdapter({
        id: "drv-spb-1",
        protocol: "SPARKPLUG",
        endpoint: "mqtt://192.168.10.30:1883",
      });

      industrialDriverManager.registerDriver(opc);
      industrialDriverManager.registerDriver(modbus);
      industrialDriverManager.registerDriver(spb);

      expect(industrialDriverManager.getAllDrivers().length).toBe(3);

      const connectResults = await industrialDriverManager.connectAll();
      expect(connectResults["drv-opc-1"]).toBe(true);
      expect(connectResults["drv-modbus-1"]).toBe(true);
      expect(connectResults["drv-spb-1"]).toBe(true);

      // Read through driver manager (automatically passes through dataQualityEngine)
      const point = await industrialDriverManager.readTag("drv-opc-1", "ns=2;s=Milling.Tandem1.TCH");
      expect(point.tag).toBe("ns=2;s=Milling.Tandem1.TCH");
      expect(point.schemaVersion).toBe("4.0.0");

      const metrics = industrialDriverManager.getAggregatedMetrics();
      expect(metrics.totalDrivers).toBe(3);
      expect(metrics.activeDrivers).toBe(3);
      expect(metrics.totalReadSuccess).toBe(1);

      await industrialDriverManager.disconnectAll();
    });
  });

  describe("I14 & I15: Data Truth Engine & Quality Rules", () => {
    it("Golden Rule: SIMULATED data must never mutate or be rebranded as physical truth", () => {
      // Input point claiming to be simulated
      const audit1 = dataQualityEngine.evaluate({
        tag: "TI-HP-STEAM-01",
        value: 65.0,
        unit: "bar",
        isSimulated: true,
        provenance: "OBSERVED_OT", // malicious spoof attempt
      });

      expect(audit1.normalizedPoint.isSimulated).toBe(true);
      expect(audit1.normalizedPoint.provenance).toBe("SIMULATED_PROCESS_MODEL");
      expect(audit1.reasons.some((r) => r.includes("PROVENANCE_MUTATION_BLOCKED"))).toBe(true);
    });

    it("should detect out-of-range low and high values and set quality to BAD", () => {
      // Boiler HP steam registered range: [0, 120] bar
      const lowResult = dataQualityEngine.evaluate({
        tag: "TI-HP-STEAM-01",
        value: -2.5,
        unit: "bar",
        isSimulated: false,
      });
      expect(lowResult.finalQuality).toBe("BAD");
      expect(lowResult.reasons.some((r) => r.includes("OUT_OF_RANGE_LOW"))).toBe(true);

      const highResult = dataQualityEngine.evaluate({
        tag: "TI-HP-STEAM-01",
        value: 145.0,
        unit: "bar",
        isSimulated: false,
      });
      expect(highResult.finalQuality).toBe("BAD");
      expect(highResult.reasons.some((r) => r.includes("OUT_OF_RANGE_HIGH"))).toBe(true);
    });

    it("should detect excessive rate-of-change jumps on continuous variables", () => {
      const now = Date.now();
      const t0 = new Date(now - 1000).toISOString();
      const t1 = new Date(now).toISOString();

      // First reading: 65 bar
      dataQualityEngine.evaluate({
        tag: "TI-HP-STEAM-01",
        value: 65.0,
        unit: "bar",
        deviceTimestamp: t0,
      });

      // Second reading 1 second later: 90 bar (delta = 25 bar/s, rule limit is 15 bar/s)
      const audit = dataQualityEngine.evaluate({
        tag: "TI-HP-STEAM-01",
        value: 90.0,
        unit: "bar",
        deviceTimestamp: t1,
      });

      expect(audit.finalQuality).toBe("UNCERTAIN");
      expect(audit.reasons.some((r) => r.includes("EXCESSIVE_RATE_OF_CHANGE"))).toBe(true);
    });

    it("should detect clock skew when device timestamp deviates from ingestion timestamp", () => {
      const now = Date.now();
      const skewedTimestamp = new Date(now - 600000).toISOString(); // 10 minutes old

      const audit = dataQualityEngine.evaluate({
        tag: "MILLING-TCH-01",
        value: 450.0,
        unit: "t/h",
        deviceTimestamp: skewedTimestamp,
        ingestionTimestamp: new Date(now).toISOString(),
      });

      expect(audit.reasons.some((r) => r.includes("DEVICE_CLOCK_SKEW"))).toBe(true);
    });

    it("should correctly populate full canonical metadata on evaluated data points", () => {
      const audit = dataQualityEngine.evaluate({
        tag: "TANDEM-1-EXTRACTION",
        value: 96.8,
        unit: "%",
        isSimulated: false,
        provenance: "PHYSICAL_OT",
      });

      const dp = audit.normalizedPoint;
      expect(dp.tag).toBe("TANDEM-1-EXTRACTION");
      expect(dp.value).toBe(96.8);
      expect(dp.engValue).toBe(96.8);
      expect(dp.unit).toBe("%");
      expect(dp.dataType).toBe("FLOAT");
      expect(dp.quality).toBe("GOOD");
      expect(dp.isSimulated).toBe(false);
      expect(dp.provenance).toBe("PHYSICAL_OT");
      expect(dp.schemaVersion).toBe("4.0.0");
      expect(dp.engMin).toBe(80);
      expect(dp.engMax).toBe(100);
    });
  });
});
