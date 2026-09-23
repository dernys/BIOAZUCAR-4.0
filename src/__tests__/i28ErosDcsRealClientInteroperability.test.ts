/**
 * BioAzúcar 4.0 — Iteration I28 Test Suite
 * DCS EROS Gateway Protocol Stack Interoperability & Decoupled Transport
 * 
 * Verifies:
 * 1. EROS 9-byte binary header framing and CRC-16 Modbus checksum
 * 2. Big-Endian IEEE 754 Float32, Int32, Int16, and Bit encoding/decoding
 * 3. EROS memory address parser (DB<n>.DB<X|B|W|D><offset>[.<bit>])
 * 4. Read Variable (0x03) and Write Variable (0x04) framing & response decoding
 * 5. Heartbeat (0x05) verification handshake
 * 6. ErosClientSession lifecycle over decoupled ITransportLayer
 * 7. ErosDriverAdapter contract with frozen 17-field IndustrialDataPoint
 * 8. ISA-95 tag alias resolution for sugar milling tandems and evaporation
 * 9. RBAC clearance level and operational justification enforcement
 * 10. Physical link severance and auto-recovery
 * 11. Fail-Closed enforcement in PRODUCTION runtime profile
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ErosBinaryCodec,
  ErosClientSession,
  ErosCommandCode,
  ErosStatusCode,
  ErosAreaType,
  ErosDataType,
  getErosStatusDescription,
  getErosAreaCode,
  getErosAreaChar,
} from "../services/edge/eros";
import { ErosDriverAdapter } from "../services/edge/drivers/ErosDriverAdapter";
import { LoopbackVirtualTransport } from "../services/edge/transport/LoopbackVirtualTransport";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

describe("Iteración I28: DCS EROS Gateway Real Protocol Stack Interoperability", () => {
  beforeEach(() => {
    RuntimeProfileManager.getInstance().setOverride("SIMULATION");
  });

  afterEach(() => {
    RuntimeProfileManager.getInstance().reset();
  });

  // --------------------------------------------------------------------------
  // 1. EROS Binary Codec & Header Framing
  // --------------------------------------------------------------------------
  describe("1. EROS 9-byte Header Framing & CRC-16 Checksum", () => {
    it("builds 9-byte header with sync word 0x4552 ('ER') and big-endian sequence", () => {
      const header = ErosBinaryCodec.buildHeader(ErosCommandCode.READ_VARIABLE, 0x1234, 6, 2);
      expect(header.length).toBe(9);

      const view = new DataView(header.buffer);
      expect(view.getUint16(0, false)).toBe(0x4552); // "ER"
      expect(header[2]).toBe(1);                    // Version 1
      expect(header[3]).toBe(2);                    // Station 2
      expect(header[4]).toBe(ErosCommandCode.READ_VARIABLE);
      expect(view.getUint16(5, false)).toBe(0x1234); // Sequence
      expect(view.getUint16(7, false)).toBe(6);      // Payload length
    });

    it("calculates CRC-16 Modbus and validates full packet decoding", () => {
      const payload = new Uint8Array([0x00, 0x0a, 0x04, 0x00, 0x0e, 0x00]); // DB10.DBD14
      const packet = ErosBinaryCodec.buildPacket(ErosCommandCode.READ_VARIABLE, 100, payload, 1);

      expect(packet.length).toBe(9 + payload.length + 2);

      const res = ErosBinaryCodec.decodePacket(packet);
      expect(res.valid).toBe(true);
      expect(res.packet).toBeDefined();
      expect(res.packet!.header.command).toBe(ErosCommandCode.READ_VARIABLE);
      expect(res.packet!.header.sequence).toBe(100);
      expect(res.packet!.payload).toEqual(payload);
    });

    it("rejects packet with corrupt CRC-16 checksum", () => {
      const payload = new Uint8Array([1, 2, 3, 4]);
      const packet = ErosBinaryCodec.buildPacket(ErosCommandCode.HEARTBEAT, 1, payload);

      // Corrupt CRC (last 2 bytes)
      packet[packet.length - 1] ^= 0xff;

      const res = ErosBinaryCodec.decodePacket(packet);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("CRC-16 mismatch");
    });

    it("finds sync word 0x4552 even with preamble noise bytes", () => {
      const noise = new Uint8Array([0xaa, 0xbb, 0xcc]);
      const valid = ErosBinaryCodec.buildHeartbeatPacket(5, 1);

      const noisyStream = new Uint8Array(noise.length + valid.length);
      noisyStream.set(noise, 0);
      noisyStream.set(valid, noise.length);

      const res = ErosBinaryCodec.decodePacket(noisyStream);
      expect(res.valid).toBe(true);
      expect(res.packet!.header.command).toBe(ErosCommandCode.HEARTBEAT);
      expect(res.packet!.header.sequence).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Data Types & Big-Endian Conversion
  // --------------------------------------------------------------------------
  describe("2. Data Encoding & Big-Endian Endianness", () => {
    it("encodes and decodes Float32 IEEE 754 in Big-Endian order", () => {
      const val = 210.5; // Top roll hydraulic pressure
      const bytes = ErosBinaryCodec.encodeValue(val, ErosDataType.FLOAT32);
      expect(bytes.length).toBe(4);

      const decoded = ErosBinaryCodec.decodeValue(bytes, ErosDataType.FLOAT32);
      expect(decoded).toBe(210.5);
    });

    it("encodes and decodes Int16 and Int32 in Big-Endian order", () => {
      const i16Bytes = ErosBinaryCodec.encodeValue(1850, ErosDataType.INT16);
      expect(ErosBinaryCodec.decodeValue(i16Bytes, ErosDataType.INT16)).toBe(1850);

      const i32Bytes = ErosBinaryCodec.encodeValue(450000, ErosDataType.INT32);
      expect(ErosBinaryCodec.decodeValue(i32Bytes, ErosDataType.INT32)).toBe(450000);
    });

    it("encodes and decodes Booleans", () => {
      const trueBytes = ErosBinaryCodec.encodeValue(true, ErosDataType.BOOL);
      expect(trueBytes[0]).toBe(0x01);
      expect(ErosBinaryCodec.decodeValue(trueBytes, ErosDataType.BOOL)).toBe(true);

      const falseBytes = ErosBinaryCodec.encodeValue(false, ErosDataType.BOOL);
      expect(falseBytes[0]).toBe(0x00);
      expect(ErosBinaryCodec.decodeValue(falseBytes, ErosDataType.BOOL)).toBe(false);
    });

    it("encodes and decodes Strings with length prefix", () => {
      const strBytes = ErosBinaryCodec.encodeValue("CENTRAL-EROS-1", ErosDataType.STRING);
      expect(ErosBinaryCodec.decodeValue(strBytes, ErosDataType.STRING)).toBe("CENTRAL-EROS-1");
    });
  });

  // --------------------------------------------------------------------------
  // 3. EROS Address Parsing
  // --------------------------------------------------------------------------
  describe("3. EROS Memory Address Syntax Parsing", () => {
    it("parses double word addresses correctly (DB10.DBD14)", () => {
      const addr = ErosBinaryCodec.parseAddress("DB10.DBD14");
      expect(addr.dbNumber).toBe(10);
      expect(addr.areaType).toBe("D");
      expect(addr.offset).toBe(14);
      expect(addr.bitIndex).toBeUndefined();
    });

    it("parses bit addresses with bit index (DB10.DBX0.1)", () => {
      const addr = ErosBinaryCodec.parseAddress("DB10.DBX0.1");
      expect(addr.dbNumber).toBe(10);
      expect(addr.areaType).toBe("X");
      expect(addr.offset).toBe(0);
      expect(addr.bitIndex).toBe(1);
    });

    it("rejects invalid syntax or out-of-range bit index", () => {
      expect(() => ErosBinaryCodec.parseAddress("INVALID_TAG")).toThrow(/Invalid EROS memory address syntax/);
      expect(() => ErosBinaryCodec.parseAddress("DB10.DBX0.9")).toThrow(/Bit must be 0-7/);
    });

    it("maps area types to characters and codes", () => {
      expect(getErosAreaCode("D")).toBe(ErosAreaType.DWORD);
      expect(getErosAreaCode("X")).toBe(ErosAreaType.BIT);
      expect(getErosAreaChar(ErosAreaType.DWORD)).toBe("D");
      expect(getErosAreaChar(ErosAreaType.WORD)).toBe("W");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Variable Services & Heartbeat Framing
  // --------------------------------------------------------------------------
  describe("4. EROS Variable Services & Heartbeat", () => {
    it("builds Read Variable request and response", () => {
      const req = ErosBinaryCodec.buildReadVariableRequest(1, 10, ErosAreaType.DWORD, 14, 0, 1);
      const decReq = ErosBinaryCodec.decodePacket(req);
      expect(decReq.valid).toBe(true);
      expect(decReq.packet!.header.command).toBe(ErosCommandCode.READ_VARIABLE);

      const valBytes = ErosBinaryCodec.encodeValue(4.8, ErosDataType.FLOAT32);
      const resp = ErosBinaryCodec.buildReadVariableResponse(1, ErosStatusCode.SUCCESS, ErosDataType.FLOAT32, valBytes, 1);
      const decResp = ErosBinaryCodec.decodePacket(resp);
      expect(decResp.valid).toBe(true);
      expect(decResp.packet!.header.command).toBe(ErosCommandCode.READ_VARIABLE_RESPONSE);
      expect(decResp.packet!.payload[0]).toBe(ErosStatusCode.SUCCESS);
    });

    it("builds Write Variable request and response", () => {
      const valBytes = ErosBinaryCodec.encodeValue(5.2, ErosDataType.FLOAT32);
      const req = ErosBinaryCodec.buildWriteVariableRequest(2, 10, ErosAreaType.DWORD, 14, ErosDataType.FLOAT32, valBytes, 0, 1);
      const decReq = ErosBinaryCodec.decodePacket(req);
      expect(decReq.valid).toBe(true);
      expect(decReq.packet!.header.command).toBe(ErosCommandCode.WRITE_VARIABLE);

      const resp = ErosBinaryCodec.buildWriteVariableResponse(2, ErosStatusCode.SUCCESS, 1);
      const decResp = ErosBinaryCodec.decodePacket(resp);
      expect(decResp.valid).toBe(true);
      expect(decResp.packet!.header.command).toBe(ErosCommandCode.WRITE_VARIABLE_RESPONSE);
    });

    it("provides human-readable status descriptions", () => {
      expect(getErosStatusDescription(ErosStatusCode.SUCCESS)).toContain("Success");
      expect(getErosStatusDescription(ErosStatusCode.DB_NOT_FOUND)).toContain("Data Block Not Found");
      expect(getErosStatusDescription(ErosStatusCode.CRC_ERROR)).toContain("CRC-16");
    });
  });

  // --------------------------------------------------------------------------
  // 5. ErosClientSession Lifecycle
  // --------------------------------------------------------------------------
  describe("5. ErosClientSession Lifecycle over Transport", () => {
    it("completes heartbeat ping and transitions to READY", async () => {
      const transport = new LoopbackVirtualTransport("loopback-eros-test", { host: "127.0.0.1", port: 5020 });

      transport.setLoopbackResponder((req) => {
        const decoded = ErosBinaryCodec.decodePacket(req);
        if (!decoded.valid || !decoded.packet) return null;
        if (decoded.packet.header.command === ErosCommandCode.HEARTBEAT) {
          return ErosBinaryCodec.buildHeartbeatResponse(decoded.packet.header.sequence, ErosStatusCode.SUCCESS, 1);
        }
        return null;
      });

      const session = new ErosClientSession(transport, 1);
      expect(session.isConnected).toBe(false);

      const connected = await session.connect();
      expect(connected).toBe(true);
      expect(session.sessionState).toBe("READY");

      await session.disconnect();
      expect(session.sessionState).toBe("DISCONNECTED");
    });
  });

  // --------------------------------------------------------------------------
  // 6. ErosDriverAdapter Contract & Telemetry
  // --------------------------------------------------------------------------
  describe("6. ErosDriverAdapter Full Contract & 17-field Telemetry", () => {
    let driver: ErosDriverAdapter;

    beforeEach(async () => {
      driver = new ErosDriverAdapter({
        id: "drv-dcs-eros-tandem",
        name: "DCS EROS Central Tandem 1",
        protocol: "EROS",
        endpoint: "192.168.30.20:5020",
      });
      await driver.connect();
    });

    afterEach(async () => {
      await driver.disconnect();
    });

    it("connects and exposes valid status and session", () => {
      expect(driver.status).toBe("AUTHENTICATED");
      expect(driver.getSession().isConnected).toBe(true);
    });

    it("reads Tandem Speed via tag alias returning a frozen 17-field data point", async () => {
      const dp = await driver.readTag("Milling.EROS.Tandem_Speed_RPM");

      expect(dp.protocol).toBe("EROS_DCS");
      expect(dp.driverId).toBe("drv-dcs-eros-tandem");
      expect(dp.tagId).toBe("Milling.EROS.Tandem_Speed_RPM");
      expect(dp.value).toBe(4.8);
      expect(dp.engineeringUnit).toBe("RPM");
      expect(dp.quality).toBe("GOOD");
      expect(dp.qualityReason).toBe("NORMAL");
      expect(dp.calibrationState).toBe("CALIBRATED");
      expect(dp.schemaVersion).toBe("4.0.0");
      expect(Object.isFrozen(dp)).toBe(true);
    });

    it("reads Evaporator Calandria steam pressure via direct address (DB20.DBD08)", async () => {
      const dp = await driver.readTag("DB20.DBD08");

      expect(dp.value).toBe(1.85);
      expect(dp.engineeringUnit).toBe("bar");
      expect(dp.quality).toBe("GOOD");
    });

    it("writes hydraulic pressure with valid clearance and operational justification", async () => {
      const writeOk = await driver.writeTag(
        "Milling.EROS.Hydraulic_Pressure_Bar",
        215.0,
        2,
        "Ajuste de presión hidráulica cilindro superior molino 1"
      );
      expect(writeOk).toBe(true);

      const readBack = await driver.readTag("Milling.EROS.Hydraulic_Pressure_Bar");
      expect(readBack.value).toBe(215.0);
    });

    it("enforces clearance level and operational justification guards", async () => {
      // Clearance < 2
      await expect(
        driver.writeTag("DB10.DBD14", 5.0, 1, "Ajuste sin nivel suficiente")
      ).rejects.toThrow(/Insufficient clearance/);

      // Justification too short (<5 chars)
      await expect(
        driver.writeTag("DB10.DBD14", 5.0, 2, "test")
      ).rejects.toThrow(/Operational justification mandatory/);
    });

    it("enforces strict READ_ONLY mode when configured", async () => {
      const roDriver = new ErosDriverAdapter({
        id: "drv-eros-ro",
        protocol: "EROS",
        endpoint: "192.168.30.21:5020",
        readOnly: true,
      });
      await roDriver.connect();

      await expect(
        roDriver.writeTag("Milling.EROS.Tandem_Speed_RPM", 5.0, 2, "Escritura denegada en modo lectura")
      ).rejects.toThrow(/strict READ_ONLY/);

      await roDriver.disconnect();
    });

    it("provides comprehensive diagnostics and health telemetry", () => {
      const health = driver.getHealth();
      expect(health.driverId).toBe("drv-dcs-eros-tandem");
      expect(health.status).toBe("AUTHENTICATED");
      expect(health.readSuccessCount).toBeGreaterThanOrEqual(0);

      const diag = driver.getDiagnostics();
      expect(diag.details.memoryMapSize).toBeGreaterThan(0);
      expect(diag.details.readOnly).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Link Severance & Auto-Recovery
  // --------------------------------------------------------------------------
  describe("7. Physical Link Severance & Reconnection", () => {
    it("transitions to FAULTED upon transport severance and recovers upon reconnect", async () => {
      const virtualTransport = new LoopbackVirtualTransport("link-eros-test", { host: "192.168.30.50", port: 5020 });
      const driver = new ErosDriverAdapter(
        {
          id: "drv-eros-resilience",
          protocol: "EROS",
          endpoint: "192.168.30.50:5020",
        },
        virtualTransport
      );

      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");

      // Sever link
      virtualTransport.simulateDisconnect("Physical RS-485/Ethernet Gateway disconnected");
      expect(driver.status).toBe("FAULTED");

      // Reads fail while faulted
      await expect(driver.readTag("Milling.EROS.Tandem_Speed_RPM")).rejects.toThrow(
        /Driver 'drv-eros-resilience' is FAULTED/
      );

      // Reconnect
      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");

      const dp = await driver.readTag("Milling.EROS.Tandem_Speed_RPM");
      expect(dp.quality).toBe("GOOD");
      expect(dp.value).toBe(4.8);

      await driver.disconnect();
    });
  });

  // --------------------------------------------------------------------------
  // 8. Fail-Closed Enforcement in PRODUCTION Profile
  // --------------------------------------------------------------------------
  describe("8. Fail-Closed Policy Enforcement in PRODUCTION", () => {
    it("rejects simulated fallback or mock configuration in PRODUCTION", () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

      expect(() => {
        new ErosDriverAdapter({
          id: "drv-eros-prod-fail1",
          protocol: "EROS",
          endpoint: "10.0.3.10:5020",
          isSimulatedFallback: true,
        });
      }).toThrow(/FAIL CLOSED/);

      expect(() => {
        new ErosDriverAdapter({
          id: "drv-eros-prod-fail2",
          protocol: "EROS",
          endpoint: "10.0.3.10:5020",
          isMock: true,
        });
      }).toThrow(/FAIL CLOSED/);
    });

    it("rejects localhost endpoint in PRODUCTION", () => {
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

      expect(() => {
        new ErosDriverAdapter({
          id: "drv-eros-prod-localhost",
          protocol: "EROS",
          endpoint: "127.0.0.1:5020",
        });
      }).toThrow(/FAIL CLOSED/);
    });
  });
});
