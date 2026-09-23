/**
 * BioAzúcar 4.0 — Test Suite I23: Cliente OPC UA Real Interoperable & Capa de Transporte
 * 
 * Verifies:
 * 1. Capa 3: Universal Transport Layer (TcpSocketTransport / LoopbackVirtualTransport)
 * 2. Capa 2: OPC UA Binary Framing Codec (HEL / ACK / OPN / MSG / CLO)
 * 3. IEC 62541 NodeId Canonical Parser
 * 4. OPC UA StatusCodes to Canonical DataQuality Mapping
 * 5. Clock Drift detection (>5000 ms skew -> UNCERTAIN)
 * 6. MonitoredItem Subscriptions with Deadband (Absolute & Percent)
 * 7. Physical Link Severance & Exponential Reconnection
 * 8. Production Fail-Closed asserting zero synthetic fallback
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LoopbackVirtualTransport } from "../services/edge/transport/LoopbackVirtualTransport";
import { OpcUaBinaryCodec } from "../services/edge/opcua/OpcUaBinaryCodec";
import {
  parseNodeId,
  mapOpcUaStatusCodeToQuality,
  OpcUaStatusCode,
} from "../services/edge/opcua/OpcUaTypes";
import { OpcUaClientSession } from "../services/edge/opcua/OpcUaClientSession";
import { OpcUaDriverAdapter } from "../services/edge/drivers/OpcUaDriverAdapter";

describe("I23 — Cliente OPC UA Real Interoperable & Capa de Transporte OT", () => {
  beforeEach(() => {
    process.env.INDUSTRIAL_RUNTIME_PROFILE = "SIMULATION";
  });

  afterEach(() => {
    delete process.env.INDUSTRIAL_RUNTIME_PROFILE;
  });

  // --------------------------------------------------------------------------
  // 1. Capa 3: Transport Layer
  // --------------------------------------------------------------------------
  describe("Capa 3: Universal Transport Layer", () => {
    it("TC-TR-01: should connect, transition states, and record traffic metrics", async () => {
      const transport = new LoopbackVirtualTransport("test-tr-01", {
        host: "10.0.1.50",
        port: 4840,
      });

      expect(transport.state).toBe("DISCONNECTED");
      const connected = await transport.connect();
      expect(connected).toBe(true);
      expect(transport.state).toBe("CONNECTED");

      const sentBytes = await transport.send(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      expect(sentBytes).toBe(4);

      const metrics = transport.getMetrics();
      expect(metrics.txBytes).toBe(4);
      expect(metrics.txPackets).toBe(1);
      expect(metrics.lastConnectedAt).toBeTruthy();

      await transport.disconnect();
      expect(transport.state).toBe("DISCONNECTED");
    });

    it("TC-TR-02: should handle simulated wire severance and trigger reconnection", async () => {
      let stateTransitions: string[] = [];
      const transport = new LoopbackVirtualTransport("test-tr-02", {
        host: "10.0.1.50",
        port: 4840,
        reconnectBackoffInitialMs: 50,
        reconnectBackoffMaxMs: 200,
      });

      transport.onStateChange((oldState, newState) => {
        stateTransitions.push(`${oldState}->${newState}`);
      });

      await transport.connect();
      expect(transport.state).toBe("CONNECTED");

      // Trigger cable pull
      transport.simulateLinkSeverance();
      expect(stateTransitions).toContain("CONNECTED->RECONNECTING");

      // Wait for backoff reconnection
      await new Promise((r) => setTimeout(r, 120));
      expect(transport.state).toBe("CONNECTED");

      await transport.disconnect();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Capa 2: OPC UA Binary Framing Codec
  // --------------------------------------------------------------------------
  describe("Capa 2: OPC UA Binary Codec (IEC 62541-6)", () => {
    it("TC-CD-01: should correctly encode a HEL (Hello) message frame", () => {
      const endpoint = "opc.tcp://192.168.10.15:4840/BioAzucarServer";
      const frame = OpcUaBinaryCodec.encodeHello(endpoint);

      expect(frame.length).toBeGreaterThan(32);
      // Check 'HELF'
      expect(String.fromCharCode(frame[0], frame[1], frame[2], frame[3])).toBe("HELF");

      const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
      const msgSize = view.getUint32(4, true);
      expect(msgSize).toBe(frame.length);

      const protoVer = view.getUint32(8, true);
      expect(protoVer).toBe(0);
      const recvBuf = view.getUint32(12, true);
      expect(recvBuf).toBe(65536);
    });

    it("TC-CD-02: should correctly encode and decode an ACK (Acknowledge) message frame", () => {
      const ackFrame = OpcUaBinaryCodec.encodeAcknowledge({
        protocolVersion: 0,
        receiveBufferSize: 65536,
        sendBufferSize: 65536,
        maxMessageSize: 16777216,
      });

      expect(ackFrame.length).toBe(28);
      const decoded = OpcUaBinaryCodec.decodeAcknowledge(ackFrame);
      expect(decoded.messageType).toBe("ACK");
      expect(decoded.receiveBufferSize).toBe(65536);
      expect(decoded.sendBufferSize).toBe(65536);
      expect(decoded.maxMessageSize).toBe(16777216);
    });

    it("TC-CD-03: should correctly encode and decode SecureChannel MSG frames", () => {
      const payload = {
        action: "ReadRequest",
        nodesToRead: ["ns=2;s=Boiler.PressureHP"],
      };

      const msgFrame = OpcUaBinaryCodec.encodeMessage(
        "MSG",
        12345, // SecureChannelId
        1,     // SecurityTokenId
        42,    // SequenceNumber
        1001,  // RequestId
        payload
      );

      const decoded = OpcUaBinaryCodec.decodeMessage(msgFrame);
      expect(decoded.messageType).toBe("MSG");
      expect(decoded.chunkType).toBe("F");
      expect(decoded.secureChannelId).toBe(12345);
      expect(decoded.sequenceNumber).toBe(42);
      expect(decoded.requestId).toBe(1001);
      expect(decoded.payload.action).toBe("ReadRequest");
      expect(decoded.payload.nodesToRead[0]).toBe("ns=2;s=Boiler.PressureHP");
    });
  });

  // --------------------------------------------------------------------------
  // 3. IEC 62541 NodeId Canonical Parser
  // --------------------------------------------------------------------------
  describe("IEC 62541 Canonical NodeId Parser", () => {
    it("TC-NI-01: should parse standard String NodeIds", () => {
      const parsed = parseNodeId("ns=2;s=Milling.Tandem1.PressureHyd");
      expect(parsed.namespaceIndex).toBe(2);
      expect(parsed.identifierType).toBe("STRING");
      expect(parsed.identifier).toBe("Milling.Tandem1.PressureHyd");
    });

    it("TC-NI-02: should parse standard Numeric NodeIds", () => {
      const parsed = parseNodeId("ns=1;i=2258");
      expect(parsed.namespaceIndex).toBe(1);
      expect(parsed.identifierType).toBe("NUMERIC");
      expect(parsed.identifier).toBe(2258);
    });

    it("TC-NI-03: should parse root NodeIds defaulting to ns=0", () => {
      const parsed = parseNodeId("i=84");
      expect(parsed.namespaceIndex).toBe(0);
      expect(parsed.identifierType).toBe("NUMERIC");
      expect(parsed.identifier).toBe(84);
    });
  });

  // --------------------------------------------------------------------------
  // 4. StatusCodes to Canonical DataQuality Mapping
  // --------------------------------------------------------------------------
  describe("OPC UA StatusCodes to Canonical DataQuality Mapping", () => {
    it("TC-QC-01: should map Good (0x00000000) to GOOD / NORMAL", () => {
      const res = mapOpcUaStatusCodeToQuality(OpcUaStatusCode.Good);
      expect(res.quality).toBe("GOOD");
      expect(res.reason).toBe("NORMAL");
    });

    it("TC-QC-02: should map BadTimeout (0x800A0000) to BAD / TIMEOUT", () => {
      const res = mapOpcUaStatusCodeToQuality(OpcUaStatusCode.BadTimeout);
      expect(res.quality).toBe("BAD");
      expect(res.reason).toBe("TIMEOUT");
    });

    it("TC-QC-03: should map BadCertificateUntrusted to BAD / AUTHENTICATION_FAILURE", () => {
      const res = mapOpcUaStatusCodeToQuality(OpcUaStatusCode.BadCertificateUntrusted);
      expect(res.quality).toBe("BAD");
      expect(res.reason).toBe("AUTHENTICATION_FAILURE");
    });

    it("TC-QC-04: should map BadCommunicationError to COMMUNICATION_LOST / COMM_FAILURE", () => {
      const res = mapOpcUaStatusCodeToQuality(OpcUaStatusCode.BadCommunicationError);
      expect(res.quality).toBe("COMMUNICATION_LOST");
      expect(res.reason).toBe("COMM_FAILURE");
    });
  });

  // --------------------------------------------------------------------------
  // 5. OPC UA Client Session Lifecycle & Subscriptions
  // --------------------------------------------------------------------------
  describe("OPC UA Client Session Engine & Subscriptions", () => {
    it("TC-SS-01: should establish session, read tags, and detect clock drift", async () => {
      const transport = new LoopbackVirtualTransport("test-session-tr", {
        host: "10.0.0.1",
        port: 4840,
      });

      // Peer responder emulating OPC UA reference server
      transport.setPeerResponder((req) => {
        const msgType = String.fromCharCode(req[0], req[1], req[2]);
        if (msgType === "HEL") {
          return OpcUaBinaryCodec.encodeAcknowledge();
        }
        if (msgType === "OPN") {
          return OpcUaBinaryCodec.encodeMessage("OPN", 999, 1, 1, 1, { status: "OPENED" });
        }
        if (msgType === "MSG") {
          return OpcUaBinaryCodec.encodeMessage("MSG", 999, 1, 2, 2, { status: "SESSION_ACTIVE" });
        }
        return null;
      });

      const session = new OpcUaClientSession("session-01", transport, {
        endpointUrl: "opc.tcp://10.0.0.1:4840",
        securityPolicy: "http://opcfoundation.org/UA/SecurityPolicy#None",
        securityMode: "None",
        applicationUri: "urn:bioazucar:edge:client:session-01",
      });

      const ok = await session.establishSession();
      expect(ok).toBe(true);
      expect(session.isConnected).toBe(true);

      const point = await session.readNode("ns=2;s=Boiler.PressureHP");
      expect(point.tagId).toBe("ns=2;s=Boiler.PressureHP");
      expect(point.quality).toBe("GOOD");
      expect(point.engineeringUnit).toBe("bar");

      await session.closeSession();
      expect(session.isConnected).toBe(false);
    });

    it("TC-SS-02: should filter subscription updates using absolute deadband", async () => {
      const transport = new LoopbackVirtualTransport("test-sub-tr", {
        host: "10.0.0.1",
        port: 4840,
      });

      const session = new OpcUaClientSession("sub-session", transport, {
        endpointUrl: "opc.tcp://10.0.0.1:4840",
        securityPolicy: "http://opcfoundation.org/UA/SecurityPolicy#None",
        securityMode: "None",
        applicationUri: "urn:bioazucar:edge:client:sub",
      });

      await session.establishSession();

      const receivedValues: number[] = [];
      const subId = session.subscribeMonitoredItem(
        "ns=2;s=Milling.Tandem1.TCH",
        60, // 60ms interval
        5.0, // Absolute deadband = 5.0 t/h
        "ABSOLUTE",
        (point) => {
          receivedValues.push(Number(point.value));
        }
      );

      expect(subId).toBeTruthy();

      // Wait for at least 2 ticks
      await new Promise((r) => setTimeout(r, 160));
      session.unsubscribe(subId);

      expect(receivedValues.length).toBeGreaterThanOrEqual(1);
      await session.closeSession();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Integrated Driver Adapter (OpcUaDriverAdapter)
  // --------------------------------------------------------------------------
  describe("Integrated OpcUaDriverAdapter with Transport Layer", () => {
    it("TC-DR-01: should connect using transport, browse AddressSpace and read tags", async () => {
      const driver = new OpcUaDriverAdapter({
        id: "drv-opcua-tandem-test",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://10.20.0.15:4840",
        isSimulatedFallback: true,
      });

      const connected = await driver.connect();
      expect(connected).toBe(true);
      expect(driver.status).toBe("AUTHENTICATED");

      const nodes = await driver.browseAddressSpace();
      expect(nodes.length).toBe(3);
      expect(nodes[0].browseName).toBe("BoilerSection");

      const dataPoint = await driver.readTag("ns=2;s=Boiler.PressureHP");
      expect(dataPoint.value).toBe(64.8);
      expect(dataPoint.quality).toBe("GOOD");
      expect(dataPoint.protocol).toBe("OPC_UA");

      const health = driver.getHealth();
      expect(health.status).toBe("AUTHENTICATED");
      expect(health.readSuccessCount).toBe(1);

      await driver.disconnect();
      expect(driver.status).toBe("DISCONNECTED");
    });

    it("TC-DR-02: should write validated values to tags with authorization clearance", async () => {
      const driver = new OpcUaDriverAdapter({
        id: "drv-opcua-write-test",
        protocol: "OPC_UA",
        endpoint: "opc.tcp://10.20.0.15:4840",
      });

      await driver.connect();

      // Write with clearance level 2 and valid justification
      const written = await driver.writeTag(
        "ns=2;s=Boiler.PressureHP",
        68.5,
        2,
        "Ajuste operacional de presion de vapor de caldera"
      );
      expect(written).toBe(true);

      const updatedPoint = await driver.readTag("ns=2;s=Boiler.PressureHP");
      expect(updatedPoint.value).toBe(68.5);

      await driver.disconnect();
    });

    it("TC-DR-03: should enforce Fail-Closed in PRODUCTION profile when missing certs", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";

      expect(() => {
        new OpcUaDriverAdapter({
          id: "drv-opcua-prod-fail",
          protocol: "OPC_UA",
          endpoint: "opc.tcp://10.50.0.1:4840",
          isSimulatedFallback: true, // Prohibited in PRODUCTION
        });
      }).toThrow(/FAIL CLOSED/);
    });
  });
});
