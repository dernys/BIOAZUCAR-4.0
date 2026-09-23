/**
 * BioAzúcar 4.0 — Iteration I26 Test Suite
 * Siemens S7 Real Client Interoperability & ISO-on-TCP (RFC 1006 / COTP) Protocol Stack
 * 
 * Verifies:
 * 1. RFC 1006 TPKT Framing and packet length validation
 * 2. ISO 8073 COTP TP0 Connection Request (CR), Confirm (CC), and Data Transfer (DT)
 * 3. S7 Communication PDU Framing (Setup Comm, Read Var, Write Var)
 * 4. S7 Address parser (DB, Inputs, Outputs, Flags, Timers, Counters, Symbolic)
 * 5. Endianness conversion for IEEE 754 Big-Endian Float32, Int16, Int32, UInt16, and Bits
 * 6. S7ClientSession lifecycle over decoupled ITransportLayer
 * 7. SiemensS7DriverAdapter contract with frozen 17-field IndustrialDataPoint
 * 8. Interlock & Security enforcement (RBAC clearance level & operational justification)
 * 9. Physical link severance and auto-recovery
 * 10. Fail-Closed enforcement in PRODUCTION runtime profile
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  S7BinaryCodec,
  S7ClientSession,
  parseS7Address,
  computeS7Tsap,
  S7AreaCode,
  S7TransportSize,
  S7ReturnCode,
  CotpPduType,
  S7Rosctr,
  S7FunctionCode,
  getS7ReturnCodeDescription,
} from "../services/edge/s7";
import { SiemensS7DriverAdapter } from "../services/edge/drivers/SiemensS7DriverAdapter";
import { LoopbackVirtualTransport } from "../services/edge/transport/LoopbackVirtualTransport";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

describe("Iteración I26: Siemens S7 Real Protocol Stack & ISO-on-TCP Interoperability", () => {
  beforeEach(() => {
    RuntimeProfileManager.getInstance().setOverride("SIMULATION");
  });

  afterEach(() => {
    RuntimeProfileManager.getInstance().reset();
  });

  // --------------------------------------------------------------------------
  // 1. RFC 1006 TPKT Framing Tests
  // --------------------------------------------------------------------------
  describe("1. RFC 1006 TPKT Framing & Length Handling", () => {
    it("encapsulates payload with correct 4-byte TPKT header (Version 3)", () => {
      const payload = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
      const frame = S7BinaryCodec.buildTpktFrame(payload);

      expect(frame.length).toBe(8); // 4 bytes header + 4 bytes payload
      expect(frame[0]).toBe(0x03); // TPKT Version
      expect(frame[1]).toBe(0x00); // Reserved
      expect(frame[2]).toBe(0x00); // Length high byte
      expect(frame[3]).toBe(0x08); // Length low byte
      expect(frame.subarray(4)).toEqual(payload);
    });

    it("decodes TPKT frame and validates packet integrity", () => {
      const payload = new Uint8Array([0xaa, 0xbb, 0xcc]);
      const frame = S7BinaryCodec.buildTpktFrame(payload);

      const decoded = S7BinaryCodec.decodeTpktFrame(frame);
      expect(decoded.valid).toBe(true);
      expect(decoded.totalLength).toBe(7);
      expect(decoded.payload).toEqual(payload);
    });

    it("rejects incomplete or invalid TPKT frames", () => {
      // Too short
      const shortFrame = new Uint8Array([0x03, 0x00]);
      expect(S7BinaryCodec.decodeTpktFrame(shortFrame).valid).toBe(false);

      // Wrong version
      const badVersion = new Uint8Array([0x04, 0x00, 0x00, 0x04]);
      expect(S7BinaryCodec.decodeTpktFrame(badVersion).valid).toBe(false);

      // Truncated body
      const truncated = new Uint8Array([0x03, 0x00, 0x00, 0x10, 0x01, 0x02]);
      const res = S7BinaryCodec.decodeTpktFrame(truncated);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Fragmented");
    });
  });

  // --------------------------------------------------------------------------
  // 2. ISO 8073 COTP Framing Tests
  // --------------------------------------------------------------------------
  describe("2. ISO 8073 COTP TP0 Framing & TSAP Negotiation", () => {
    it("computes Calling and Called TSAPs correctly from Rack and Slot", () => {
      // S7-1200 / S7-1500 (Rack 0, Slot 1)
      const tsap1200 = computeS7Tsap(0, 1, 0x03);
      expect(tsap1200.callingTsap).toBe(0x0100);
      expect(tsap1200.calledTsap).toBe(0x0301); // ConnectionType 3, (0 << 5) | 1 = 1

      // S7-300 / S7-400 (Rack 0, Slot 2)
      const tsap300 = computeS7Tsap(0, 2, 0x02);
      expect(tsap300.calledTsap).toBe(0x0202);
    });

    it("builds a standard COTP Connection Request (CR)", () => {
      const crFrame = S7BinaryCodec.buildCotpConnectionRequest(0x0100, 0x0301);
      const decodedTpkt = S7BinaryCodec.decodeTpktFrame(crFrame);

      expect(decodedTpkt.valid).toBe(true);
      const cotp = S7BinaryCodec.decodeCotp(decodedTpkt.payload);
      expect(cotp.pduType).toBe(CotpPduType.CR);
      expect(cotp.headerLength).toBe(17);
    });

    it("builds COTP Connection Confirm (CC) and Data Transfer (DT)", () => {
      const ccFrame = S7BinaryCodec.buildCotpConnectionConfirm();
      const decodedTpkt = S7BinaryCodec.decodeTpktFrame(ccFrame);
      const cotp = S7BinaryCodec.decodeCotp(decodedTpkt.payload);
      expect(cotp.pduType).toBe(CotpPduType.CC);

      const dummyPdu = new Uint8Array([0x32, 0x01, 0x00, 0x00]);
      const dtFrame = S7BinaryCodec.buildCotpDataFrame(dummyPdu);
      const decodedDt = S7BinaryCodec.decodeTpktFrame(dtFrame);
      const cotpDt = S7BinaryCodec.decodeCotp(decodedDt.payload);
      expect(cotpDt.pduType).toBe(CotpPduType.DT);
      expect(cotpDt.userData).toEqual(dummyPdu);
    });
  });

  // --------------------------------------------------------------------------
  // 3. S7 Communication PDU Framing Tests
  // --------------------------------------------------------------------------
  describe("3. S7 Communication PDU (Setup Comm, Read, Write)", () => {
    it("serializes and deserializes S7 Setup Communication Request and Ack", () => {
      const pdu = S7BinaryCodec.buildSetupCommunicationPdu(42, 8, 8, 480);
      const decoded = S7BinaryCodec.decodeS7Pdu(pdu);

      expect(decoded.protocolId).toBe(0x32);
      expect(decoded.rosctr).toBe(S7Rosctr.JOB);
      expect(decoded.pduReference).toBe(42);
      expect(decoded.paramLength).toBe(8);

      const ack = S7BinaryCodec.buildSetupCommunicationAck(42, 8, 8, 480);
      const decodedAck = S7BinaryCodec.decodeS7Pdu(ack);
      expect(decodedAck.rosctr).toBe(S7Rosctr.ACK_DATA);
      expect(decodedAck.errorClass).toBe(0);
      expect(decodedAck.errorCode).toBe(0);
    });

    it("serializes Read Var request with bit-level addressing", () => {
      const readPdu = S7BinaryCodec.buildReadVarPdu(100, [
        {
          areaCode: S7AreaCode.DB,
          dbNumber: 1,
          byteOffset: 4,
          bitOffset: 0,
          count: 4,
          transportSize: S7TransportSize.BYTE,
        },
      ]);

      const decoded = S7BinaryCodec.decodeS7Pdu(readPdu);
      expect(decoded.pduReference).toBe(100);
      expect(decoded.paramData[0]).toBe(S7FunctionCode.READ_VAR);
      expect(decoded.paramData[1]).toBe(1); // 1 item

      // Item check: DB1, byte 4 -> 4 * 8 = 32 (0x000020)
      const bitAddr = (decoded.paramData[11] << 16) | (decoded.paramData[12] << 8) | decoded.paramData[13];
      expect(bitAddr).toBe(32);
    });

    it("returns descriptive diagnostic text for S7 return codes", () => {
      expect(getS7ReturnCodeDescription(S7ReturnCode.SUCCESS)).toContain("Success");
      expect(getS7ReturnCodeDescription(S7ReturnCode.ADDRESS_OUT_OF_RANGE)).toContain("Address Out Of Range");
      expect(getS7ReturnCodeDescription(S7ReturnCode.OBJECT_DOES_NOT_EXIST)).toContain("Object Does Not Exist");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Endianness & Data Type Encoding
  // --------------------------------------------------------------------------
  describe("4. Endianness & IEEE 754 Big-Endian Encoding", () => {
    it("encodes and decodes Float32 (Real) in Big-Endian network order", () => {
      const originalValue = 64.5;
      const bytes = S7BinaryCodec.encodeValueToBytes(originalValue, "REAL");
      expect(bytes.length).toBe(4);

      const decodedValue = S7BinaryCodec.decodeBytesToValue(bytes, "REAL");
      expect(decodedValue).toBe(64.5);
    });

    it("encodes and decodes 16-bit and 32-bit signed/unsigned integers", () => {
      const int16Bytes = S7BinaryCodec.encodeValueToBytes(-1250, "INT");
      expect(S7BinaryCodec.decodeBytesToValue(int16Bytes, "INT")).toBe(-1250);

      const dwordBytes = S7BinaryCodec.encodeValueToBytes(100000, "DWORD");
      expect(S7BinaryCodec.decodeBytesToValue(dwordBytes, "DWORD")).toBe(100000);
    });

    it("extracts and sets individual bits for Boolean variables", () => {
      const boolTrueBytes = S7BinaryCodec.encodeValueToBytes(true, "BOOL", 3);
      expect(boolTrueBytes[0]).toBe(1 << 3); // 0b00001000 = 8

      const isBitSet = S7BinaryCodec.decodeBytesToValue(boolTrueBytes, "BOOL", 3);
      expect(isBitSet).toBe(true);

      const isOtherBitSet = S7BinaryCodec.decodeBytesToValue(boolTrueBytes, "BOOL", 2);
      expect(isOtherBitSet).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Canonical Address Parser
  // --------------------------------------------------------------------------
  describe("5. Canonical Siemens S7 Memory Address Parsing", () => {
    it("parses DB process variables (DB1.DBD0, DB10.DBW4, DB2.DBX0.1)", () => {
      const dbReal = parseS7Address("DB1.DBD0");
      expect(dbReal.area).toBe("DB");
      expect(dbReal.dbNumber).toBe(1);
      expect(dbReal.dataType).toBe("REAL");
      expect(dbReal.byteOffset).toBe(0);
      expect(dbReal.lengthBytes).toBe(4);

      const dbWord = parseS7Address("DB10.DBW4");
      expect(dbWord.area).toBe("DB");
      expect(dbWord.dbNumber).toBe(10);
      expect(dbWord.dataType).toBe("WORD");
      expect(dbWord.byteOffset).toBe(4);

      const dbBit = parseS7Address("DB2.DBX0.5");
      expect(dbBit.area).toBe("DB");
      expect(dbBit.dataType).toBe("BOOL");
      expect(dbBit.byteOffset).toBe(0);
      expect(dbBit.bitOffset).toBe(5);
    });

    it("parses Inputs, Outputs, Flags, Timers, and Counters", () => {
      const input = parseS7Address("IW0");
      expect(input.area).toBe("INPUTS");
      expect(input.dataType).toBe("WORD");

      const outputBit = parseS7Address("Q0.2");
      expect(outputBit.area).toBe("OUTPUTS");
      expect(outputBit.dataType).toBe("BOOL");
      expect(outputBit.bitOffset).toBe(2);

      const flag = parseS7Address("MD20");
      expect(flag.area).toBe("FLAGS");
      expect(flag.dataType).toBe("DWORD");

      const timer = parseS7Address("T5");
      expect(timer.area).toBe("TIMERS");
      expect(timer.byteOffset).toBe(5);

      const counter = parseS7Address("C3");
      expect(counter.area).toBe("COUNTERS");
      expect(counter.byteOffset).toBe(3);
    });

    it("treats ISA-95 symbolic names as valid symbolic tags", () => {
      const symbolic = parseS7Address("IngenioCentral.Calderas.Caldera1.PresionVapor");
      expect(symbolic.isSymbolicTag).toBe(true);
      expect(symbolic.symbolicTag).toBe("IngenioCentral.Calderas.Caldera1.PresionVapor");
    });
  });

  // --------------------------------------------------------------------------
  // 6. S7ClientSession Lifecycle & Decoupled Transport
  // --------------------------------------------------------------------------
  describe("6. S7ClientSession over Loopback Transport", () => {
    it("completes COTP and S7 Setup Comm handshakes and transitions to READY", async () => {
      const transport = new LoopbackVirtualTransport("loopback-s7-test", { host: "127.0.0.1", port: 102 });
      
      // Setup loopback responder
      transport.setLoopbackResponder((req) => {
        const decoded = S7BinaryCodec.decodeTpktFrame(req);
        if (!decoded.valid) return null;
        const cotp = S7BinaryCodec.decodeCotp(decoded.payload);

        if (cotp.pduType === CotpPduType.CR) {
          return S7BinaryCodec.buildCotpConnectionConfirm();
        }
        if (cotp.pduType === CotpPduType.DT) {
          const s7Pdu = cotp.userData;
          const header = S7BinaryCodec.decodeS7Pdu(s7Pdu);
          if (header.paramData[0] === S7FunctionCode.SETUP_COMM) {
            const ack = S7BinaryCodec.buildSetupCommunicationAck(header.pduReference, 8, 8, 480);
            return S7BinaryCodec.buildCotpDataFrame(ack);
          }
        }
        return null;
      });

      const session = new S7ClientSession(transport, { rack: 0, slot: 1 });
      expect(session.isConnected).toBe(false);

      const connected = await session.connect();
      expect(connected).toBe(true);
      expect(session.sessionState).toBe("READY");
      expect(session.pduLength).toBe(480);

      await session.disconnect();
      expect(session.sessionState).toBe("DISCONNECTED");
    });
  });

  // --------------------------------------------------------------------------
  // 7. SiemensS7DriverAdapter Full Contract & Telemetry
  // --------------------------------------------------------------------------
  describe("7. SiemensS7DriverAdapter Contract & 17-field Telemetry", () => {
    let driver: SiemensS7DriverAdapter;

    beforeEach(async () => {
      driver = new SiemensS7DriverAdapter({
        id: "drv-s7-cogen",
        name: "Boiler Cogeneration PLC S7-1500",
        protocol: "SIEMENS_S7",
        endpoint: "192.168.10.15:102",
        customParameters: { rack: 0, slot: 1 },
      });
      await driver.connect();
    });

    afterEach(async () => {
      await driver.disconnect();
    });

    it("connects and exposes valid status, rack, and slot", () => {
      expect(driver.status).toBe("AUTHENTICATED");
      expect(driver.getRack()).toBe(0);
      expect(driver.getSlot()).toBe(1);
    });

    it("reads Boiler 1 Main Steam Pressure (DB1.DBD0) as a frozen 17-field data point", async () => {
      const dp = await driver.readTag("DB1.DBD0");

      expect(dp.protocol).toBe("SIEMENS_S7");
      expect(dp.driverId).toBe("drv-s7-cogen");
      expect(dp.tagId).toBe("DB1.DBD0");
      expect(dp.value).toBe(64.5);
      expect(dp.engineeringUnit).toBe("bar");
      expect(dp.quality).toBe("GOOD");
      expect(dp.qualityReason).toBe("NORMAL");
      expect(dp.calibrationState).toBe("CALIBRATED");
      expect(dp.schemaVersion).toBe("4.0.0");
      expect(Object.isFrozen(dp)).toBe(true);
    });

    it("writes new pressure setpoint with valid clearance and justification", async () => {
      const writeOk = await driver.writeTag(
        "DB1.DBD0",
        66.2,
        2,
        "Ajuste de presión por mayor demanda de molienda"
      );
      expect(writeOk).toBe(true);

      const readBack = await driver.readTag("DB1.DBD0");
      expect(readBack.value).toBe(66.2);
    });

    it("enforces clearance level and mandatory operational justification", async () => {
      // Clearance < 2
      await expect(
        driver.writeTag("DB1.DBD0", 60.0, 1, "Ajuste de prueba no autorizado")
      ).rejects.toThrow(/Insufficient clearance/);

      // Justification too short (<5 chars)
      await expect(
        driver.writeTag("DB1.DBD0", 60.0, 2, "ok")
      ).rejects.toThrow(/Operational justification mandatory/);
    });

    it("enforces strict READ_ONLY mode when configured", async () => {
      const readOnlyDriver = new SiemensS7DriverAdapter({
        id: "drv-s7-ro",
        protocol: "SIEMENS_S7",
        endpoint: "192.168.10.16:102",
        readOnly: true,
      });
      await readOnlyDriver.connect();

      await expect(
        readOnlyDriver.writeTag("DB1.DBD0", 50.0, 2, "Intento de escritura en modo lectura")
      ).rejects.toThrow(/strict READ_ONLY/);

      await readOnlyDriver.disconnect();
    });

    it("provides comprehensive diagnostics and health metrics", () => {
      const health = driver.getHealth();
      expect(health.driverId).toBe("drv-s7-cogen");
      expect(health.status).toBe("AUTHENTICATED");
      expect(health.readSuccessCount).toBeGreaterThanOrEqual(0);

      const diag = driver.getDiagnostics();
      expect(diag.details.rack).toBe(0);
      expect(diag.details.slot).toBe(1);
      expect(diag.details.negotiatedPduLength).toBe(480);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Resiliency: Link Severance & Auto-Recovery
  // --------------------------------------------------------------------------
  describe("8. Physical Link Severance & Reconnection", () => {
    it("transitions to FAULTED upon transport severance and recovers upon reconnect", async () => {
      const virtualTransport = new LoopbackVirtualTransport("link-s7-test", { host: "192.168.1.50", port: 102 });
      const driver = new SiemensS7DriverAdapter(
        {
          id: "drv-s7-resilience",
          protocol: "SIEMENS_S7",
          endpoint: "192.168.1.50:102",
        },
        virtualTransport
      );

      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");

      // Sever link
      virtualTransport.simulateDisconnect("Physical fiber break between Purdue L2 and L3");
      expect(driver.status).toBe("FAULTED");

      // Read fails while faulted
      await expect(driver.readTag("DB1.DBD0")).rejects.toThrow(/Driver 'drv-s7-resilience' is FAULTED/);

      // Reconnect
      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");

      const dp = await driver.readTag("DB1.DBD0");
      expect(dp.quality).toBe("GOOD");
      expect(dp.value).toBe(64.5);

      await driver.disconnect();
    });
  });

  // --------------------------------------------------------------------------
  // 9. Fail-Closed Enforcement in PRODUCTION Profile
  // --------------------------------------------------------------------------
  describe("9. Fail-Closed Policy Enforcement in PRODUCTION", () => {
    it("rejects simulated fallback or mock configuration in PRODUCTION", () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

      expect(() => {
        new SiemensS7DriverAdapter({
          id: "drv-s7-prod-fail",
          protocol: "SIEMENS_S7",
          endpoint: "10.0.1.10:102",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      expect(() => {
        new SiemensS7DriverAdapter({
          id: "drv-s7-prod-fail2",
          protocol: "SIEMENS_S7",
          endpoint: "10.0.1.10:102",
          isMock: true,
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("rejects localhost endpoint in PRODUCTION", () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

      expect(() => {
        new SiemensS7DriverAdapter({
          id: "drv-s7-prod-localhost",
          protocol: "SIEMENS_S7",
          endpoint: "127.0.0.1:102",
        });
      }).toThrow(/FAIL CLOSED/);
    });
  });
});
