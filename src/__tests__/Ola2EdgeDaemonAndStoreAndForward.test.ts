import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OpcUaDriverAdapter } from "../services/edge/drivers/OpcUaDriverAdapter";
import { ModbusDriverAdapter } from "../services/edge/drivers/ModbusDriverAdapter";
import { MqttSparkplugDriverAdapter } from "../services/edge/drivers/MqttSparkplugDriverAdapter";
import { SparkplugBProtocol } from "../services/edge/drivers/SparkplugBProtocol";
import { EdgeRuntimeSupervisor } from "../services/edge/supervisor/EdgeRuntimeSupervisor";
import { IndustrialDriverManager } from "../services/edge/drivers/IndustrialDriverManager";
import { LocalTimeSeriesDatabase } from "../services/edge/history/LocalTimeSeriesDatabase";
import { IndustrialDataPoint } from "../types";

describe("OLA 2: Edge Daemon Físico y Store & Forward", () => {
  // -------------------------------------------------------------
  // I2: OPC UA Real en Edge Daemon (IEC 62541)
  // -------------------------------------------------------------
  describe("I2: OPC UA Client & AddressSpace (IEC 62541)", () => {
    it("should connect with valid endpoint and authenticate session", async () => {
      const driver = new OpcUaDriverAdapter({
        id: "opcua-test-01",
        name: "Test OPC UA Node",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://192.168.10.50:4840/BioAzucarServer",
        timeoutMs: 3000,
        securityProfile: {
          securityMode: "SignAndEncrypt",
          securityPolicy: "Basic256Sha256",
          certificateRef: "vault://certs/opcua-edge.der",
        },
      });

      const connected = await driver.connect();
      expect(connected).toBe(true);
      expect(driver.status).toBe("AUTHENTICATED");
    });

    it("should reject invalid OPC UA endpoint protocol", async () => {
      const driver = new OpcUaDriverAdapter({
        id: "opcua-invalid",
        name: "Invalid OPC UA",
        protocol: "OPC_UA",
        endpoint: "http://192.168.10.50:4840",
        timeoutMs: 3000,
      });

      const connected = await driver.connect();
      expect(connected).toBe(false);
      expect(driver.status).toBe("FAULTED");
    });

    it("should browse AddressSpace hierarchical nodes", async () => {
      const driver = new OpcUaDriverAdapter({
        id: "opcua-browse",
        name: "Browse OPC UA",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://192.168.10.50:4840/BioAzucarServer",
        timeoutMs: 3000,
      });

      await driver.connect();
      const nodes = await driver.browseAddressSpace("ns=2;s=Root");

      expect(nodes.length).toBeGreaterThanOrEqual(3);
      expect(nodes.some((n) => n.browseName === "BoilerSection")).toBe(true);
      expect(nodes.some((n) => n.browseName === "MillingTandem")).toBe(true);
      expect(nodes.some((n) => n.browseName === "Turbogenerator")).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // I4: Driver Modbus TCP / RTU Físico
  // -------------------------------------------------------------
  describe("I4: Modbus TCP/RTU & Endianness Engine", () => {
    it("should compute correct Modbus CRC-16 checksum", () => {
      // Standard Modbus RTU test frame: Read 1 holding register from Slave 1
      // [0x01, 0x03, 0x00, 0x00, 0x00, 0x01] -> CRC should be 0x840A (or 0x0A84 depending on endianness)
      const frame = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x01]);
      const crc = ModbusDriverAdapter.calculateCRC16(frame);
      expect(crc).toBeDefined();
      expect(typeof crc).toBe("number");
      expect(crc).toBe(0x0a84);
    });

    it("should decode 32-bit float in all 4 endianness configurations", () => {
      // Float value 123.45 in IEEE 754:
      // Big Endian (ABCD): 0x42, 0xF6, 0xE6, 0x66 -> Reg0=0x42F6 (17142), Reg1=0xE666 (58982)
      const reg0 = 0x42f6;
      const reg1 = 0xe666;

      const valABCD = ModbusDriverAdapter.decode32BitRegisters(reg0, reg1, "FLOAT32", "ABCD");
      expect(Math.abs(valABCD - 123.45)).toBeLessThan(0.05);

      // Word Swap (CDAB): Reg0=0xE666, Reg1=0x42F6
      const valCDAB = ModbusDriverAdapter.decode32BitRegisters(reg1, reg0, "FLOAT32", "CDAB");
      expect(Math.abs(valCDAB - 123.45)).toBeLessThan(0.05);

      // Byte Swap (BADC): Reg0=0xF642, Reg1=0x66E6
      const reg0_badc = 0xf642;
      const reg1_badc = 0x66e6;
      const valBADC = ModbusDriverAdapter.decode32BitRegisters(reg0_badc, reg1_badc, "FLOAT32", "BADC");
      expect(Math.abs(valBADC - 123.45)).toBeLessThan(0.05);
    });

    it("should decode 32-bit integers correctly", () => {
      // 305419896 = 0x12345678 -> Reg0=0x1234, Reg1=0x5678
      const val = ModbusDriverAdapter.decode32BitRegisters(0x1234, 0x5678, "INT32", "ABCD");
      expect(val).toBe(305419896);
    });
  });

  // -------------------------------------------------------------
  // I6: Cliente MQTT con Perfil Sparkplug B
  // -------------------------------------------------------------
  describe("I6: MQTT Sparkplug B Protocol Compliance", () => {
    it("should format standardized Sparkplug B topic paths", () => {
      const topicNode = SparkplugBProtocol.buildTopic("BioAzucar", "NBIRTH", "Central-01");
      expect(topicNode).toBe("spBv1.0/BioAzucar/NBIRTH/Central-01");

      const topicDevice = SparkplugBProtocol.buildTopic("BioAzucar", "DDATA", "Central-01", "Scale-Moxa-01");
      expect(topicDevice).toBe("spBv1.0/BioAzucar/DDATA/Central-01/Scale-Moxa-01");
    });

    it("should parse Sparkplug B topics accurately", () => {
      const parsed = SparkplugBProtocol.parseTopic("spBv1.0/BioAzucar/NDATA/Central-01");
      expect(parsed).not.toBeNull();
      expect(parsed?.groupId).toBe("BioAzucar");
      expect(parsed?.messageType).toBe("NDATA");
      expect(parsed?.edgeNodeId).toBe("Central-01");
      expect(parsed?.deviceId).toBeUndefined();
    });

    it("should maintain monotonic sequence counter between 0 and 255", () => {
      let seq = 254;
      seq = SparkplugBProtocol.nextSequence(seq);
      expect(seq).toBe(255);
      seq = SparkplugBProtocol.nextSequence(seq);
      expect(seq).toBe(0); // Wraps around
    });

    it("should construct compliant NBIRTH and LWT NDEATH payloads", () => {
      const adapter = new MqttSparkplugDriverAdapter({
        id: "sparkplug-driver-01",
        name: "Sparkplug B Driver",
        protocol: "SPARKPLUG",
        endpoint: "mqtt://192.168.10.60:1883",
        timeoutMs: 3000,
        customParameters: {
          groupId: "BioAzucar",
          edgeNodeId: "Central-01",
        },
      });

      const death = adapter.getLWTDeathMessage();
      expect(death.topic).toBe("spBv1.0/BioAzucar/NDEATH/Central-01");
      expect(death.payload.metrics.some((m) => m.name === "bdSeq")).toBe(true);

      const birth = adapter.publishNBirth();
      expect(birth.topic).toBe("spBv1.0/BioAzucar/NBIRTH/Central-01");
      expect(birth.payload.seq).toBe(0);
      expect(adapter.getSequence()).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // I8: Edge Runtime 2.0 (Supervisor y Watchdog)
  // -------------------------------------------------------------
  describe("I8: Edge Runtime 2.0 Supervisor & Watchdog", () => {
    let driverManager: IndustrialDriverManager;
    let supervisor: EdgeRuntimeSupervisor;

    beforeEach(() => {
      driverManager = IndustrialDriverManager.getInstance();
      driverManager.clearAll();
      supervisor = EdgeRuntimeSupervisor.getInstance();
      supervisor.resetSupervisor();
    });

    afterEach(() => {
      supervisor.stop();
      driverManager.clearAll();
    });

    it("should detect a faulted driver and execute isolated recovery", async () => {
      const faultedDriver = new OpcUaDriverAdapter({
        id: "driver-failing",
        name: "Faulting Driver",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://192.168.10.50:4840",
        timeoutMs: 1000,
      });

      // Healthy sibling driver
      const healthyDriver = new ModbusDriverAdapter({
        id: "driver-healthy",
        name: "Healthy Modbus Driver",
        protocol: "MODBUS",
        endpoint: "192.168.20.15:502",
        timeoutMs: 1000,
      });

      driverManager.registerDriver(faultedDriver);
      driverManager.registerDriver(healthyDriver);

      await healthyDriver.connect();
      expect(healthyDriver.status).toBe("AUTHENTICATED");

      // Force faulted status on the first driver
      (faultedDriver as any)._status = "FAULTED";

      // Configure fast watchdog
      supervisor.configure({
        watchdogIntervalMs: 50,
        watchdogTimeoutMs: 100,
        baseBackoffMs: 10,
        maxBackoffMs: 50,
      });

      await supervisor.runWatchdogCycle();

      const status = supervisor.getSupervisionStatus();
      expect(status.totalWatchdogChecks).toBe(1);
      expect(status.totalAutomaticRestarts).toBe(1);

      // Crucial: The healthy sibling driver was never touched or faulted
      expect(healthyDriver.status).toBe("AUTHENTICATED");
    });
  });

  // -------------------------------------------------------------
  // I9: Historiador Local On-Premise (TSDB Local & Store & Forward)
  // -------------------------------------------------------------
  describe("I9: Local Time Series Database (TSDB)", () => {
    let tsdb: LocalTimeSeriesDatabase;

    beforeEach(() => {
      tsdb = LocalTimeSeriesDatabase.getInstance();
      tsdb.reset();
    });

    it("should ingest telemetry points and query historical range", () => {
      const now = Date.now();
      const tag = "Boiler.SteamPressure";

      for (let i = 0; i < 10; i++) {
        const point: IndustrialDataPoint = {
          id: `pt-${i}`,
          tag,
          value: 60 + i,
          unit: "bar",
          quality: "GOOD",
          source: "OPC_UA",
          protocol: "OPC-UA",
          deviceTimestamp: new Date(now - (10 - i) * 1000).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        };
        tsdb.record(point);
      }

      const results = tsdb.queryRange(tag, now - 15000, now + 1000);
      expect(results.length).toBe(10);
      expect(results[0].value).toBe(60);
      expect(results[9].value).toBe(69);
    });

    it("should calculate windowed aggregations: AVG, MIN, MAX, P95", () => {
      const now = Date.now();
      const tag = "Turbine.PowerMW";

      const values = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38];
      values.forEach((v, idx) => {
        tsdb.record({
          id: `turb-${idx}`,
          tag,
          value: v,
          unit: "MW",
          quality: "GOOD",
          source: "OPC_UA",
          protocol: "OPC-UA",
          deviceTimestamp: new Date(now - (10 - idx) * 1000).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: idx,
          isSimulated: false,
        });
      });

      // Query whole 10-second window in a single bucket
      const avgQuery = tsdb.queryRange(tag, now - 11000, now + 1000, {
        stepMs: 15000,
        aggregation: "AVG",
      });
      expect(avgQuery.length).toBe(1);
      expect(avgQuery[0].value).toBe(29); // (20+38)/2 = 29
      expect(avgQuery[0].min).toBe(20);
      expect(avgQuery[0].max).toBe(38);

      const maxQuery = tsdb.queryRange(tag, now - 11000, now + 1000, {
        stepMs: 15000,
        aggregation: "MAX",
      });
      expect(maxQuery[0].value).toBe(38);

      const p95Query = tsdb.queryRange(tag, now - 11000, now + 1000, {
        stepMs: 15000,
        aggregation: "P95",
      });
      expect(p95Query[0].value).toBe(38);
    });

    it("should apply retention policy and purge expired samples", () => {
      const now = Date.now();
      const tag = "RetentionTag";

      // Insert point 40 days old
      tsdb.record({
        id: "old-pt",
        tag,
        value: 100,
        unit: "kg",
        quality: "GOOD",
        source: "OPC_UA",
        protocol: "OPC-UA",
        deviceTimestamp: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1,
        isSimulated: false,
      });

      // Insert fresh point 1 minute ago
      tsdb.record({
        id: "fresh-pt",
        tag,
        value: 105,
        unit: "kg",
        quality: "GOOD",
        source: "OPC_UA",
        protocol: "OPC-UA",
        deviceTimestamp: new Date(now - 60000).toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 2,
        isSimulated: false,
      });

      tsdb.setRetention(30); // 30 days retention
      const purged = tsdb.purgeExpiredSamples();
      expect(purged).toBe(1);

      const stats = tsdb.getStats();
      expect(stats.totalPointsStored).toBe(1);
    });
  });
});
