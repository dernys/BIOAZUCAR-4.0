/**
 * BioAzúcar 4.0 — Iteration I27 Test Suite
 * Rockwell Allen-Bradley EtherNet/IP & CIP Protocol Stack Interoperability
 * 
 * Verifies:
 * 1. EtherNet/IP 24-byte Encapsulation Header framing and packet validation
 * 2. RegisterSession and UnRegisterSession lifecycle
 * 3. Common Packet Format (CPF) serialization and deserialization
 * 4. EPATH ANSI Extended Symbol Segment (0x91) encoding with alignment and array indexing
 * 5. Endianness conversion for Little-Endian IEEE 754 Float32, DINT, INT, and BOOL
 * 6. CIP Service Requests (0x4C Read Tag, 0x4D Write Tag) and general status decoding
 * 7. CipClientSession state machine and explicit messaging over ITransportLayer
 * 8. EtherNetIpDriverAdapter contract with frozen 17-field IndustrialDataPoint
 * 9. RBAC clearance level and operational justification enforcement
 * 10. Physical link severance and auto-recovery
 * 11. Fail-Closed enforcement in PRODUCTION runtime profile
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CipBinaryCodec,
  CipClientSession,
  EipCommand,
  EipStatus,
  CpfTypeId,
  CipServiceCode,
  CipGeneralStatus,
  CipDataTypeCode,
  getCipStatusDescription,
  getCipDataTypeName,
  getCipDataTypeCode,
} from "../services/edge/cip";
import { EtherNetIpDriverAdapter } from "../services/edge/drivers/EtherNetIpDriverAdapter";
import { LoopbackVirtualTransport } from "../services/edge/transport/LoopbackVirtualTransport";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

describe("Iteración I27: Rockwell EtherNet/IP & CIP Real Protocol Stack Interoperability", () => {
  beforeEach(() => {
    RuntimeProfileManager.getInstance().setOverride("SIMULATION");
  });

  afterEach(() => {
    RuntimeProfileManager.getInstance().reset();
  });

  // --------------------------------------------------------------------------
  // 1. EtherNet/IP Encapsulation Header Framing
  // --------------------------------------------------------------------------
  describe("1. EtherNet/IP 24-byte Encapsulation Header Framing", () => {
    it("serializes 24-byte header with Little-Endian fields and context", () => {
      const context = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const header = CipBinaryCodec.buildEncapsulationHeader(
        EipCommand.REGISTER_SESSION,
        4,
        0x12345678,
        context,
        EipStatus.SUCCESS,
        0
      );

      expect(header.length).toBe(24);
      const view = new DataView(header.buffer);
      expect(view.getUint16(0, true)).toBe(EipCommand.REGISTER_SESSION);
      expect(view.getUint16(2, true)).toBe(4);
      expect(view.getUint32(4, true)).toBe(0x12345678);
      expect(view.getUint32(8, true)).toBe(EipStatus.SUCCESS);
      expect(header.subarray(12, 20)).toEqual(context);
    });

    it("decodes valid encapsulation packets correctly", () => {
      const payload = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
      const header = CipBinaryCodec.buildEncapsulationHeader(
        EipCommand.SEND_RR_DATA,
        payload.length,
        0x5a1e0001
      );
      const packet = new Uint8Array(24 + payload.length);
      packet.set(header, 0);
      packet.set(payload, 24);

      const res = CipBinaryCodec.decodeEncapsulationPacket(packet);
      expect(res.valid).toBe(true);
      expect(res.header.command).toBe(EipCommand.SEND_RR_DATA);
      expect(res.header.sessionHandle).toBe(0x5a1e0001);
      expect(res.payload).toEqual(payload);
    });

    it("rejects incomplete or truncated encapsulation packets", () => {
      const truncated = new Uint8Array([0x65, 0x00, 0x04]);
      const res = CipBinaryCodec.decodeEncapsulationPacket(truncated);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Incomplete EtherNet/IP header");

      // Valid header claiming 10 bytes, but packet only has 24 bytes
      const header = CipBinaryCodec.buildEncapsulationHeader(EipCommand.SEND_RR_DATA, 10);
      const res2 = CipBinaryCodec.decodeEncapsulationPacket(header);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("Fragmented EtherNet/IP frame");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Session Management (Register / UnRegister)
  // --------------------------------------------------------------------------
  describe("2. EtherNet/IP Session Management", () => {
    it("builds RegisterSession request with Protocol Version 1", () => {
      const packet = CipBinaryCodec.buildRegisterSessionPacket();
      expect(packet.length).toBe(28); // 24 header + 4 payload

      const decoded = CipBinaryCodec.decodeEncapsulationPacket(packet);
      expect(decoded.valid).toBe(true);
      expect(decoded.header.command).toBe(EipCommand.REGISTER_SESSION);

      const view = new DataView(decoded.payload.buffer, decoded.payload.byteOffset);
      expect(view.getUint16(0, true)).toBe(1); // Protocol Version 1
      expect(view.getUint16(2, true)).toBe(0); // Options
    });

    it("builds RegisterSession response with assigned session handle", () => {
      const resp = CipBinaryCodec.buildRegisterSessionResponse(0x99887766);
      const decoded = CipBinaryCodec.decodeEncapsulationPacket(resp);
      expect(decoded.header.sessionHandle).toBe(0x99887766);
      expect(decoded.header.status).toBe(EipStatus.SUCCESS);
    });

    it("builds UnRegisterSession request", () => {
      const packet = CipBinaryCodec.buildUnRegisterSessionPacket(0x99887766);
      expect(packet.length).toBe(24);
      const decoded = CipBinaryCodec.decodeEncapsulationPacket(packet);
      expect(decoded.header.command).toBe(EipCommand.UNREGISTER_SESSION);
      expect(decoded.header.sessionHandle).toBe(0x99887766);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Common Packet Format (CPF) Serialization
  // --------------------------------------------------------------------------
  describe("3. Common Packet Format (CPF) Handling", () => {
    it("encodes and decodes multi-item CPF buffer", () => {
      const dummyData = new Uint8Array([0x4c, 0x02, 0x91, 0x04, 0x54, 0x65, 0x73, 0x74]);
      const cpfBuf = CipBinaryCodec.buildCpfPacket([
        { typeId: CpfTypeId.NULL_ADDRESS, length: 0, data: new Uint8Array(0) },
        { typeId: CpfTypeId.UNCONNECTED_DATA, length: dummyData.length, data: dummyData },
      ]);

      const decoded = CipBinaryCodec.decodeCpfPacket(cpfBuf);
      expect(decoded.interfaceHandle).toBe(0);
      expect(decoded.items.length).toBe(2);
      expect(decoded.items[0].typeId).toBe(CpfTypeId.NULL_ADDRESS);
      expect(decoded.items[0].length).toBe(0);
      expect(decoded.items[1].typeId).toBe(CpfTypeId.UNCONNECTED_DATA);
      expect(decoded.items[1].data).toEqual(dummyData);
    });
  });

  // --------------------------------------------------------------------------
  // 4. EPATH ANSI Extended Symbol Segment (0x91) Encoding
  // --------------------------------------------------------------------------
  describe("4. EPATH ANSI Extended Symbol Segment Generation", () => {
    it("encodes even-length tag names without padding", () => {
      // "FLOW" -> 4 bytes (even) -> 0x91 0x04 'F' 'L' 'O' 'W' (6 bytes total)
      const epath = CipBinaryCodec.encodeEpath("FLOW");
      expect(epath.length).toBe(6);
      expect(epath[0]).toBe(0x91);
      expect(epath[1]).toBe(4);
      expect(new TextDecoder().decode(epath.subarray(2, 6))).toBe("FLOW");
    });

    it("encodes odd-length tag names with mandatory 0x00 padding byte", () => {
      // "SPEED" -> 5 bytes (odd) -> 0x91 0x05 'S' 'P' 'E' 'E' 'D' 0x00 (8 bytes total)
      const epath = CipBinaryCodec.encodeEpath("SPEED");
      expect(epath.length).toBe(8);
      expect(epath[0]).toBe(0x91);
      expect(epath[1]).toBe(5);
      expect(new TextDecoder().decode(epath.subarray(2, 7))).toBe("SPEED");
      expect(epath[7]).toBe(0x00); // 16-bit word alignment pad
    });

    it("encodes array indexing with Member ID segment (0x28)", () => {
      const epath = CipBinaryCodec.encodeEpath("Tandem[2]");
      // "Tandem" is 6 bytes (even) -> 2 + 6 = 8 bytes
      // [2] is 1-byte member ID -> 0x28 0x02 = 2 bytes
      // Total 10 bytes
      expect(epath.length).toBe(10);
      expect(epath[0]).toBe(0x91);
      expect(epath[1]).toBe(6);
      expect(epath[8]).toBe(0x28);
      expect(epath[9]).toBe(2);
    });

    it("encodes nested structures with chained ANSI Extended Symbol segments", () => {
      const epath = CipBinaryCodec.encodeEpath("Boiler.Steam");
      expect(epath.length).toBe(8 + 8); // "Boiler" (6) + "Steam" (5 + pad)
      expect(epath[0]).toBe(0x91);
      expect(epath[8]).toBe(0x91);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Endianness & Little-Endian Data Type Conversion
  // --------------------------------------------------------------------------
  describe("5. Endianness & Little-Endian IEEE 754 Encoding", () => {
    it("encodes and decodes Float32 (Real) in Little-Endian byte order", () => {
      const val = 64.2;
      const bytes = CipBinaryCodec.encodeValueToBytes(val, "REAL");
      expect(bytes.length).toBe(4);

      const decoded = CipBinaryCodec.decodeBytesToValue(bytes, "REAL");
      expect(decoded).toBe(64.2);
    });

    it("encodes and decodes DINT (Int32) and INT (Int16)", () => {
      const dintBytes = CipBinaryCodec.encodeValueToBytes(-250000, "DINT");
      expect(CipBinaryCodec.decodeBytesToValue(dintBytes, "DINT")).toBe(-250000);

      const intBytes = CipBinaryCodec.encodeValueToBytes(1250, "INT");
      expect(CipBinaryCodec.decodeBytesToValue(intBytes, "INT")).toBe(1250);
    });

    it("encodes and decodes Boolean values", () => {
      const trueBytes = CipBinaryCodec.encodeValueToBytes(true, "BOOL");
      expect(trueBytes[0]).toBe(0x01);
      expect(CipBinaryCodec.decodeBytesToValue(trueBytes, "BOOL")).toBe(true);

      const falseBytes = CipBinaryCodec.encodeValueToBytes(false, "BOOL");
      expect(falseBytes[0]).toBe(0x00);
      expect(CipBinaryCodec.decodeBytesToValue(falseBytes, "BOOL")).toBe(false);
    });

    it("maps CIP data type codes to canonical type names", () => {
      expect(getCipDataTypeName(CipDataTypeCode.REAL)).toBe("REAL");
      expect(getCipDataTypeName(CipDataTypeCode.DINT)).toBe("DINT");
      expect(getCipDataTypeName(CipDataTypeCode.BOOL)).toBe("BOOL");
      expect(getCipDataTypeCode("REAL")).toBe(CipDataTypeCode.REAL);
    });
  });

  // --------------------------------------------------------------------------
  // 6. CIP Service Requests & Status Codes
  // --------------------------------------------------------------------------
  describe("6. CIP Service Requests (0x4C Read, 0x4D Write) & Status Codes", () => {
    it("builds Read Tag request (0x4C) with path word length", () => {
      const req = CipBinaryCodec.buildReadTagRequest("Boiler_Pressure");
      expect(req[0]).toBe(CipServiceCode.READ_TAG);
      const pathWords = req[1];
      expect(pathWords).toBeGreaterThan(0);
      expect(req.length).toBe(2 + pathWords * 2 + 2); // Service + WordLen + Path + ElementCount (UInt16)
    });

    it("builds Write Tag request (0x4D) with type code and element value", () => {
      const req = CipBinaryCodec.buildWriteTagRequest("Boiler_Pressure", 65.5, "REAL");
      expect(req[0]).toBe(CipServiceCode.WRITE_TAG);
      const pathWords = req[1];
      const offset = 2 + pathWords * 2;
      const view = new DataView(req.buffer);
      expect(view.getUint16(offset, true)).toBe(CipDataTypeCode.REAL);
    });

    it("decodes successful and error CIP responses", () => {
      // Success response for Read Tag
      const successData = new Uint8Array([
        CipServiceCode.READ_TAG | 0x80, // 0xCC
        0x00,                           // Reserved
        CipGeneralStatus.SUCCESS,       // 0x00
        0x00,                           // Ext status word count
        0xca, 0x00,                     // DataType REAL (0x00CA)
        0xcd, 0xcc, 0x80, 0x42,         // 64.4 in Little-Endian Float32
      ]);
      const res = CipBinaryCodec.decodeCipResponse(successData);
      expect(res.service).toBe(0xcc);
      expect(res.generalStatus).toBe(CipGeneralStatus.SUCCESS);
      expect(res.dataType).toBe(CipDataTypeCode.REAL);

      // Error response: Path Destination Unknown (0x05)
      const errData = new Uint8Array([
        CipServiceCode.READ_TAG | 0x80,
        0x00,
        CipGeneralStatus.PATH_DESTINATION_UNKNOWN,
        0x00,
      ]);
      const errRes = CipBinaryCodec.decodeCipResponse(errData);
      expect(errRes.generalStatus).toBe(CipGeneralStatus.PATH_DESTINATION_UNKNOWN);
      expect(getCipStatusDescription(errRes.generalStatus)).toContain("Tag Not Found");
    });
  });

  // --------------------------------------------------------------------------
  // 7. CipClientSession Lifecycle over Transport
  // --------------------------------------------------------------------------
  describe("7. CipClientSession Lifecycle over Loopback Transport", () => {
    it("completes RegisterSession and transitions to READY", async () => {
      const transport = new LoopbackVirtualTransport("loopback-cip-test", { host: "127.0.0.1", port: 44818 });

      transport.setLoopbackResponder((req) => {
        const decoded = CipBinaryCodec.decodeEncapsulationPacket(req);
        if (!decoded.valid) return null;
        if (decoded.header.command === EipCommand.REGISTER_SESSION) {
          return CipBinaryCodec.buildRegisterSessionResponse(0x77665544, decoded.header.senderContext);
        }
        return null;
      });

      const session = new CipClientSession(transport);
      expect(session.isConnected).toBe(false);

      const connected = await session.connect();
      expect(connected).toBe(true);
      expect(session.sessionState).toBe("READY");
      expect(session.activeSessionHandle).toBe(0x77665544);

      await session.disconnect();
      expect(session.sessionState).toBe("DISCONNECTED");
      expect(session.activeSessionHandle).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 8. EtherNetIpDriverAdapter Full Contract & Telemetry
  // --------------------------------------------------------------------------
  describe("8. EtherNetIpDriverAdapter Contract & 17-field Telemetry", () => {
    let driver: EtherNetIpDriverAdapter;

    beforeEach(async () => {
      driver = new EtherNetIpDriverAdapter({
        id: "drv-ab-control-logix",
        name: "Rockwell ControlLogix Sugar Mill Tandem 1",
        protocol: "ETHERNET_IP",
        endpoint: "192.168.20.10:44818",
      });
      await driver.connect();
    });

    afterEach(async () => {
      await driver.disconnect();
    });

    it("connects and exposes valid status and session handle", () => {
      expect(driver.status).toBe("AUTHENTICATED");
      expect(driver.getSessionHandle()).toBeGreaterThan(0);
    });

    it("reads Boiler_1_Main_Steam_Pressure as a frozen 17-field data point", async () => {
      const dp = await driver.readTag("Boiler_1_Main_Steam_Pressure");

      expect(dp.protocol).toBe("ETHERNET_IP");
      expect(dp.driverId).toBe("drv-ab-control-logix");
      expect(dp.tagId).toBe("Boiler_1_Main_Steam_Pressure");
      expect(dp.value).toBe(64.2);
      expect(dp.engineeringUnit).toBe("bar");
      expect(dp.quality).toBe("GOOD");
      expect(dp.qualityReason).toBe("NORMAL");
      expect(dp.calibrationState).toBe("CALIBRATED");
      expect(dp.schemaVersion).toBe("4.0.0");
      expect(Object.isFrozen(dp)).toBe(true);
    });

    it("writes new speed setpoint with valid clearance and operational justification", async () => {
      const writeOk = await driver.writeTag(
        "Tandem_1_Main_Drive_Speed",
        5.15,
        2,
        "Incremento de velocidad de molienda zafra 2026"
      );
      expect(writeOk).toBe(true);

      const readBack = await driver.readTag("Tandem_1_Main_Drive_Speed");
      expect(readBack.value).toBe(5.15);
    });

    it("enforces clearance level and operational justification guards", async () => {
      // Clearance < 2
      await expect(
        driver.writeTag("Turbine_1_Governor_Setpoint", 19.5, 1, "Ajuste no autorizado")
      ).rejects.toThrow(/Insufficient clearance/);

      // Justification too short (<5 chars)
      await expect(
        driver.writeTag("Turbine_1_Governor_Setpoint", 19.5, 2, "test")
      ).rejects.toThrow(/Operational justification mandatory/);
    });

    it("enforces strict READ_ONLY mode when configured", async () => {
      const roDriver = new EtherNetIpDriverAdapter({
        id: "drv-ab-ro",
        protocol: "ETHERNET_IP",
        endpoint: "192.168.20.11:44818",
        readOnly: true,
      });
      await roDriver.connect();

      await expect(
        roDriver.writeTag("Boiler_1_Main_Steam_Pressure", 60.0, 2, "Escritura denegada en modo lectura")
      ).rejects.toThrow(/strict READ_ONLY/);

      await roDriver.disconnect();
    });

    it("provides comprehensive diagnostics and health telemetry", () => {
      const health = driver.getHealth();
      expect(health.driverId).toBe("drv-ab-control-logix");
      expect(health.status).toBe("AUTHENTICATED");
      expect(health.readSuccessCount).toBeGreaterThanOrEqual(0);

      const diag = driver.getDiagnostics();
      expect(diag.details.sessionHandle).toBeGreaterThan(0);
      expect(diag.details.readOnly).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Link Severance & Auto-Recovery
  // --------------------------------------------------------------------------
  describe("9. Physical Link Severance & Reconnection", () => {
    it("transitions to FAULTED upon transport severance and recovers upon reconnect", async () => {
      const virtualTransport = new LoopbackVirtualTransport("link-ab-test", { host: "192.168.20.50", port: 44818 });
      const driver = new EtherNetIpDriverAdapter(
        {
          id: "drv-ab-resilience",
          protocol: "ETHERNET_IP",
          endpoint: "192.168.20.50:44818",
        },
        virtualTransport
      );

      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");

      // Sever link
      virtualTransport.simulateDisconnect("Physical Ethernet unplugged from ControlLogix 1756-EN2T");
      expect(driver.status).toBe("FAULTED");

      // Reads fail while faulted
      await expect(driver.readTag("Boiler_1_Main_Steam_Pressure")).rejects.toThrow(
        /Driver 'drv-ab-resilience' is FAULTED/
      );

      // Reconnect
      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");

      const dp = await driver.readTag("Boiler_1_Main_Steam_Pressure");
      expect(dp.quality).toBe("GOOD");
      expect(dp.value).toBe(64.2);

      await driver.disconnect();
    });
  });

  // --------------------------------------------------------------------------
  // 10. Fail-Closed Enforcement in PRODUCTION Profile
  // --------------------------------------------------------------------------
  describe("10. Fail-Closed Policy Enforcement in PRODUCTION", () => {
    it("rejects simulated fallback or mock configuration in PRODUCTION", () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

      expect(() => {
        new EtherNetIpDriverAdapter({
          id: "drv-ab-prod-fail1",
          protocol: "ETHERNET_IP",
          endpoint: "10.0.2.10:44818",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      expect(() => {
        new EtherNetIpDriverAdapter({
          id: "drv-ab-prod-fail2",
          protocol: "ETHERNET_IP",
          endpoint: "10.0.2.10:44818",
          isMock: true,
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("rejects localhost endpoint in PRODUCTION", () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

      expect(() => {
        new EtherNetIpDriverAdapter({
          id: "drv-ab-prod-localhost",
          protocol: "ETHERNET_IP",
          endpoint: "127.0.0.1:44818",
        });
      }).toThrow(/FAIL CLOSED/);
    });
  });
});
