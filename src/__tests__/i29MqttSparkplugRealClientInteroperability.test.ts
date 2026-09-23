/**
 * BioAzúcar 4.0 — Iteración I29: UNS-02 MQTT 3.1.1 / 5.0 & Sparkplug B Protocol Stack Interoperability Tests
 * 
 * Verifies the 4-layer decoupled architecture of MQTT Sparkplug B:
 * 1. Wire Framing & Variable Byte Integer Codec
 * 2. UTF-8 & Packet Builders / Decoders
 * 3. Sparkplug B UNS Topic & Payload Encoding
 * 4. MqttClientSession Lifecycle, Heartbeat & Wildcard Routing
 * 5. MqttSparkplugDriverAdapter Canonical 17-Field Inmutable Telemetry
 * 6. RBAC & Operational Justifications
 * 7. Fail-Closed Safety & Production Environment Validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MqttPacketType,
  MqttConnectReturnCode,
  MqttBinaryCodec,
  MqttClientSession,
  getMqttConnectReturnCodeDescription,
} from "../services/edge/mqtt";
import { SparkplugBProtocol } from "../services/edge/drivers/SparkplugBProtocol";
import { MqttSparkplugDriverAdapter } from "../services/edge/drivers/MqttSparkplugDriverAdapter";
import { LoopbackVirtualTransport } from "../services/edge/transport/LoopbackVirtualTransport";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

describe("Iteración I29: UNS-02 MQTT 3.1.1 & Sparkplug B Protocol Stack Interoperability", () => {
  const originalEnv = process.env.INDUSTRIAL_RUNTIME_PROFILE;

  beforeEach(() => {
    delete process.env.INDUSTRIAL_RUNTIME_PROFILE;
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

  // ==========================================================================
  // 1. Variable Byte Integer & Codec Framing
  // ==========================================================================
  describe("1. MQTT Variable Byte Integer & UTF-8 Codec", () => {
    it("encodes and decodes 1-byte length values (0 to 127)", () => {
      const b0 = MqttBinaryCodec.encodeVariableByteInteger(0);
      expect(b0.length).toBe(1);
      expect(b0[0]).toBe(0);
      expect(MqttBinaryCodec.decodeVariableByteInteger(b0, 0)).toEqual({ value: 0, bytesRead: 1 });

      const b127 = MqttBinaryCodec.encodeVariableByteInteger(127);
      expect(b127.length).toBe(1);
      expect(b127[0]).toBe(127);
      expect(MqttBinaryCodec.decodeVariableByteInteger(b127, 0)).toEqual({ value: 127, bytesRead: 1 });
    });

    it("encodes and decodes multi-byte length values (128 to 268435455)", () => {
      const b128 = MqttBinaryCodec.encodeVariableByteInteger(128);
      expect(b128.length).toBe(2);
      expect(MqttBinaryCodec.decodeVariableByteInteger(b128, 0)).toEqual({ value: 128, bytesRead: 2 });

      const b16383 = MqttBinaryCodec.encodeVariableByteInteger(16383);
      expect(b16383.length).toBe(2);
      expect(MqttBinaryCodec.decodeVariableByteInteger(b16383, 0)).toEqual({ value: 16383, bytesRead: 2 });

      const b65535 = MqttBinaryCodec.encodeVariableByteInteger(65535);
      expect(b65535.length).toBe(3);
      expect(MqttBinaryCodec.decodeVariableByteInteger(b65535, 0)).toEqual({ value: 65535, bytesRead: 3 });

      const bMax = MqttBinaryCodec.encodeVariableByteInteger(268435455);
      expect(bMax.length).toBe(4);
      expect(MqttBinaryCodec.decodeVariableByteInteger(bMax, 0)).toEqual({ value: 268435455, bytesRead: 4 });
    });

    it("rejects out of range or malformed variable byte integer", () => {
      expect(() => MqttBinaryCodec.encodeVariableByteInteger(-1)).toThrow(/out of range/);
      expect(() => MqttBinaryCodec.encodeVariableByteInteger(268435456)).toThrow(/out of range/);

      // Incomplete buffer
      const incomplete = new Uint8Array([0x80]); // continuation bit set without next byte
      expect(() => MqttBinaryCodec.decodeVariableByteInteger(incomplete, 0)).toThrow(/exhausted/);
    });

    it("encodes and decodes UTF-8 strings with 2-byte Big-Endian length prefix", () => {
      const encoded = MqttBinaryCodec.encodeUtf8String("BioAzucar/Central01");
      expect(encoded.length).toBe(2 + 19);
      const view = new DataView(encoded.buffer);
      expect(view.getUint16(0, false)).toBe(19);

      const decoded = MqttBinaryCodec.decodeUtf8String(encoded, 0);
      expect(decoded.str).toBe("BioAzucar/Central01");
      expect(decoded.bytesRead).toBe(21);
    });
  });

  // ==========================================================================
  // 2. MQTT Packet Builders & Stream Decoding
  // ==========================================================================
  describe("2. MQTT Packet Builders & Stream Decoding", () => {
    it("builds and decodes CONNECT and CONNACK packets", () => {
      const connectPacket = MqttBinaryCodec.buildConnectPacket({
        clientId: "node-edge-01",
        cleanSession: true,
        keepAliveSeconds: 45,
        username: "admin-edge",
        password: "secure-token",
        willTopic: "spBv1.0/BioAzucar/NDEATH/Central01",
        willMessage: '{"metrics":[]}',
        willQoS: 1,
      });

      expect(connectPacket[0] >> 4).toBe(MqttPacketType.CONNECT);

      const connack = MqttBinaryCodec.buildConnackPacket(false, MqttConnectReturnCode.ACCEPTED);
      const decodedConnack = MqttBinaryCodec.decodePacket(connack);
      expect(decodedConnack.valid).toBe(true);
      expect(decodedConnack.packet?.type).toBe(MqttPacketType.CONNACK);
      expect(decodedConnack.packet?.returnCode).toBe(MqttConnectReturnCode.ACCEPTED);
      expect(decodedConnack.packet?.sessionPresent).toBe(false);
    });

    it("builds and decodes PUBLISH (QoS 0 & 1) and PUBACK packets", () => {
      const pubQos0 = MqttBinaryCodec.buildPublishPacket({
        topic: "spBv1.0/BioAzucar/NDATA/Central01",
        payload: "test-payload",
        qos: 0,
      });
      const decQos0 = MqttBinaryCodec.decodePacket(pubQos0);
      expect(decQos0.valid).toBe(true);
      expect(decQos0.packet?.type).toBe(MqttPacketType.PUBLISH);
      expect(decQos0.packet?.topic).toBe("spBv1.0/BioAzucar/NDATA/Central01");
      expect(new TextDecoder().decode(decQos0.packet?.payload)).toBe("test-payload");

      const pubQos1 = MqttBinaryCodec.buildPublishPacket({
        topic: "spBv1.0/BioAzucar/NDATA/Central01",
        payload: "critical-payload",
        qos: 1,
        packetId: 42,
      });
      const decQos1 = MqttBinaryCodec.decodePacket(pubQos1);
      expect(decQos1.valid).toBe(true);
      expect(decQos1.packet?.packetId).toBe(42);

      const puback = MqttBinaryCodec.buildPubackPacket(42);
      const decPuback = MqttBinaryCodec.decodePacket(puback);
      expect(decPuback.valid).toBe(true);
      expect(decPuback.packet?.type).toBe(MqttPacketType.PUBACK);
      expect(decPuback.packet?.packetId).toBe(42);
    });

    it("builds and decodes SUBSCRIBE, SUBACK, PINGREQ, PINGRESP, and DISCONNECT", () => {
      const sub = MqttBinaryCodec.buildSubscribePacket(101, [
        { topic: "spBv1.0/BioAzucar/NCMD/+", qos: 1 },
      ]);
      expect(sub[0] >> 4).toBe(MqttPacketType.SUBSCRIBE);

      const suback = MqttBinaryCodec.buildSubackPacket(101, [1]);
      const decSuback = MqttBinaryCodec.decodePacket(suback);
      expect(decSuback.valid).toBe(true);
      expect(decSuback.packet?.type).toBe(MqttPacketType.SUBACK);
      expect(decSuback.packet?.packetId).toBe(101);
      expect(decSuback.packet?.grantedQos).toEqual([1]);

      const pingreq = MqttBinaryCodec.buildPingreqPacket();
      expect(pingreq[0] >> 4).toBe(MqttPacketType.PINGREQ);

      const pingresp = MqttBinaryCodec.buildPingrespPacket();
      const decPingresp = MqttBinaryCodec.decodePacket(pingresp);
      expect(decPingresp.valid).toBe(true);
      expect(decPingresp.packet?.type).toBe(MqttPacketType.PINGRESP);

      const disconnect = MqttBinaryCodec.buildDisconnectPacket();
      expect(disconnect[0] >> 4).toBe(MqttPacketType.DISCONNECT);
    });

    it("handles fragmented packets and pipelines multiple packets in one buffer", () => {
      const p1 = MqttBinaryCodec.buildPingreqPacket();
      const p2 = MqttBinaryCodec.buildPingrespPacket();

      // Concatenated stream
      const stream = new Uint8Array(p1.length + p2.length);
      stream.set(p1, 0);
      stream.set(p2, p1.length);

      const dec1 = MqttBinaryCodec.decodePacket(stream);
      expect(dec1.valid).toBe(true);
      expect(dec1.packet?.type).toBe(MqttPacketType.PINGREQ);
      expect(dec1.remaining?.length).toBe(p2.length);

      const dec2 = MqttBinaryCodec.decodePacket(dec1.remaining!);
      expect(dec2.valid).toBe(true);
      expect(dec2.packet?.type).toBe(MqttPacketType.PINGRESP);
      expect(dec2.remaining).toBeUndefined();
    });

    it("returns human-readable connect return code descriptions", () => {
      expect(getMqttConnectReturnCodeDescription(MqttConnectReturnCode.ACCEPTED)).toContain("Accepted");
      expect(getMqttConnectReturnCodeDescription(MqttConnectReturnCode.BAD_USERNAME_OR_PASSWORD)).toContain("Bad Username");
      expect(getMqttConnectReturnCodeDescription(MqttConnectReturnCode.SERVER_UNAVAILABLE)).toContain("Server Unavailable");
    });
  });

  // ==========================================================================
  // 3. Sparkplug B Specification Integration
  // ==========================================================================
  describe("3. Sparkplug B Unified Namespace Architecture", () => {
    it("constructs and parses Eclipse Sparkplug B compliant topic hierarchies", () => {
      const topic = SparkplugBProtocol.buildTopic("BioAzucar", "NDATA", "Central-01");
      expect(topic).toBe("spBv1.0/BioAzucar/NDATA/Central-01");

      const parsed = SparkplugBProtocol.parseTopic(topic);
      expect(parsed).not.toBeNull();
      expect(parsed?.namespace).toBe("spBv1.0");
      expect(parsed?.groupId).toBe("BioAzucar");
      expect(parsed?.messageType).toBe("NDATA");
      expect(parsed?.edgeNodeId).toBe("Central-01");

      const devTopic = SparkplugBProtocol.buildTopic("BioAzucar", "DDATA", "Central-01", "Mill-01");
      expect(devTopic).toBe("spBv1.0/BioAzucar/DDATA/Central-01/Mill-01");
      const devParsed = SparkplugBProtocol.parseTopic(devTopic);
      expect(devParsed?.deviceId).toBe("Mill-01");
    });

    it("enforces monotonic sequence numbering 0..255 wrapping strictly", () => {
      let seq = 0;
      for (let i = 0; i < 255; i++) {
        seq = SparkplugBProtocol.nextSequence(seq);
      }
      expect(seq).toBe(255);
      seq = SparkplugBProtocol.nextSequence(seq);
      expect(seq).toBe(0); // Wraps around
    });
  });

  // ==========================================================================
  // 4. MqttClientSession & Wildcard Routing
  // ==========================================================================
  describe("4. MqttClientSession & Wildcard Subscription Routing", () => {
    it("executes CONNECT handshake and publishes QoS 1 with PUBACK confirmation", async () => {
      const transport = new LoopbackVirtualTransport("test-spb-transport", { host: "127.0.0.1", port: 1883 });
      
      // Setup virtual broker responder
      transport.setLoopbackResponder((data) => {
        const decoded = MqttBinaryCodec.decodePacket(data);
        if (!decoded.valid || !decoded.packet) return null;

        if (decoded.packet.type === MqttPacketType.CONNECT) {
          return MqttBinaryCodec.buildConnackPacket(false, MqttConnectReturnCode.ACCEPTED);
        }
        if (decoded.packet.type === MqttPacketType.PUBLISH && decoded.packet.packetId !== undefined) {
          return MqttBinaryCodec.buildPubackPacket(decoded.packet.packetId);
        }
        if (decoded.packet.type === MqttPacketType.PINGREQ) {
          return MqttBinaryCodec.buildPingrespPacket();
        }
        return null;
      });

      const session = new MqttClientSession(transport, {
        clientId: "test-client",
        keepAliveSeconds: 10,
      });

      const connected = await session.connect(2000);
      expect(connected).toBe(true);
      expect(session.status).toBe("READY");

      // Publish QoS 1
      await expect(
        session.publish("spBv1.0/BioAzucar/NDATA/Central01", '{"seq":1}', 1, false, 2000)
      ).resolves.toBeUndefined();

      // Ping
      await expect(session.ping(2000)).resolves.toBeUndefined();

      await session.disconnect();
      expect(session.status).toBe("DISCONNECTED");
    });

    it("matches MQTT topic filters with wildcards (+ and #)", () => {
      const transport = new LoopbackVirtualTransport("test-spb-filter", { host: "127.0.0.1", port: 1883 });
      const session = new MqttClientSession(transport, { clientId: "test-wildcard" });

      expect(session.matchesTopicFilter("spBv1.0/BioAzucar/NDATA/Central-01", "spBv1.0/BioAzucar/NDATA/Central-01")).toBe(true);
      expect(session.matchesTopicFilter("spBv1.0/BioAzucar/NDATA/Central-01", "spBv1.0/+/NDATA/+")).toBe(true);
      expect(session.matchesTopicFilter("spBv1.0/BioAzucar/NDATA/Central-01", "spBv1.0/#")).toBe(true);
      expect(session.matchesTopicFilter("spBv1.0/BioAzucar/NDATA/Central-01", "spBv1.0/Ingenio/#")).toBe(false);
      expect(session.matchesTopicFilter("spBv1.0/BioAzucar/NDATA/Central-01", "spBv1.0/+/+/Central-02")).toBe(false);
    });
  });

  // ==========================================================================
  // 5. MqttSparkplugDriverAdapter Full Contract & 17-field Telemetry
  // ==========================================================================
  describe("5. MqttSparkplugDriverAdapter Full Contract & 17-field Telemetry", () => {
    it("connects, publishes NBIRTH and configures LWT NDEATH certificate", async () => {
      const adapter = new MqttSparkplugDriverAdapter({
        id: "drv-spb-central",
        protocol: "SPARKPLUG",
        endpoint: "mqtt://192.168.10.60:1883",
        customParameters: {
          groupId: "BioAzucar",
          edgeNodeId: "Central-01",
        },
      });

      const death = adapter.getLWTDeathMessage();
      expect(death.topic).toBe("spBv1.0/BioAzucar/NDEATH/Central-01");
      expect(death.payload.metrics.some((m) => m.name === "bdSeq")).toBe(true);

      const connected = await adapter.connect();
      expect(connected).toBe(true);
      expect(adapter.status).toBe("AUTHENTICATED");
      expect(adapter.getSequence()).toBeGreaterThanOrEqual(1);

      await adapter.disconnect();
      expect(adapter.status).toBe("DISCONNECTED");
    });

    it("reads telemetry returning a frozen 17-field canonical data point", async () => {
      const adapter = new MqttSparkplugDriverAdapter({
        id: "drv-spb-telemetry",
        protocol: "SPARKPLUG",
        endpoint: "mqtt://192.168.10.60:1883",
      });

      await adapter.connect();

      const dp = await adapter.readTag("Boiler/FeedwaterFlow");
      expect(dp.tagId).toBe("Boiler/FeedwaterFlow");
      expect(dp.value).toBe(185.4);
      expect(dp.engineeringUnit).toBe("m3/h");
      expect(dp.quality).toBe("GOOD");
      expect(dp.qualityReason).toBe("NORMAL");
      expect(dp.calibrationState).toBe("CALIBRATED");
      expect(dp.schemaVersion).toBe("4.0.0");
      expect(Object.isFrozen(dp)).toBe(true);

      await adapter.disconnect();
    });

    it("writes tag updating payload cache and sequence under valid RBAC", async () => {
      const adapter = new MqttSparkplugDriverAdapter({
        id: "drv-spb-write",
        protocol: "SPARKPLUG",
        endpoint: "mqtt://192.168.10.60:1883",
      });

      await adapter.connect();

      const success = await adapter.writeTag(
        "Milling.Tandem1.TCH",
        410.5,
        2,
        "Ajuste operativo de molienda zafra 2026"
      );
      expect(success).toBe(true);

      const readBack = await adapter.readTag("Milling.Tandem1.TCH");
      expect(readBack.value).toBe(410.5);

      await adapter.disconnect();
    });

    it("enforces clearance level and operational justification guards", async () => {
      const adapter = new MqttSparkplugDriverAdapter({
        id: "drv-spb-guards",
        protocol: "SPARKPLUG",
        endpoint: "mqtt://192.168.10.60:1883",
      });

      await adapter.connect();

      // Insufficient clearance (< 2)
      await expect(
        adapter.writeTag("Milling.Tandem1.TCH", 400.0, 1, "Justification valida")
      ).rejects.toThrow(/Insufficient clearance/);

      // Empty / missing justification (< 5 chars)
      await expect(
        adapter.writeTag("Milling.Tandem1.TCH", 400.0, 2, "abc")
      ).rejects.toThrow(/Operational justification mandatory/);

      await adapter.disconnect();
    });

    it("enforces strict READ_ONLY mode when configured", async () => {
      const adapter = new MqttSparkplugDriverAdapter({
        id: "drv-spb-ro",
        protocol: "SPARKPLUG",
        endpoint: "mqtt://192.168.10.60:1883",
        readOnly: true,
      });

      await adapter.connect();

      await expect(
        adapter.writeTag("Milling.Tandem1.TCH", 400.0, 3, "Intentando escribir en RO")
      ).rejects.toThrow(/strict READ_ONLY mode/);

      await adapter.disconnect();
    });

    it("transitions to FAULTED upon transport severance and recovers upon reconnect", async () => {
      const transport = new LoopbackVirtualTransport("test-spb-fault", { host: "127.0.0.1", port: 1883 });
      const adapter = new MqttSparkplugDriverAdapter(
        {
          id: "drv-spb-fault",
          protocol: "SPARKPLUG",
          endpoint: "mqtt://127.0.0.1:1883",
        },
        transport
      );

      await adapter.connect();
      expect(adapter.status).toBe("AUTHENTICATED");

      // Inject transport severance
      transport.simulateDisconnect("Physical link down: fiber cut");
      expect(adapter.status).toBe("FAULTED");

      // Read fails when faulted
      await expect(adapter.readTag("Boiler/FeedwaterFlow")).rejects.toThrow(/is FAULTED/);

      // Reconnect
      await adapter.connect();
      expect(adapter.status).toBe("AUTHENTICATED");

      await adapter.disconnect();
    });
  });

  // ==========================================================================
  // 6. Fail-Closed Safety & Production Checks
  // ==========================================================================
  describe("6. Fail-Closed Safety & Production Environment Validation", () => {
    it("rejects simulated fallback or mock configuration in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      expect(() => {
        new MqttSparkplugDriverAdapter({
          id: "drv-spb-prod-fail",
          protocol: "SPARKPLUG",
          endpoint: "mqtt://192.168.10.60:1883",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("rejects localhost endpoint in PRODUCTION", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().resetForTesting();

      expect(() => {
        new MqttSparkplugDriverAdapter({
          id: "drv-spb-prod-local",
          protocol: "SPARKPLUG",
          endpoint: "mqtt://127.0.0.1:1883",
        });
      }).toThrow(/FAIL CLOSED/);
    });
  });
});
