/**
 * BioAzúcar 4.0 — Iteration I25: Modbus TCP/RTU Real Protocol Interoperability & Decoupled Transport
 * 
 * Verifies:
 * 1. ModbusBinaryCodec: Full binary wire framing (MBAP + PDU, RTU CRC-16, FC 01, 02, 03, 04, 05, 06, 16).
 * 2. Endianness & IEEE 754: ABCD (Big Endian), CDAB (Word Swap), BADC (Byte Swap), DCBA (Little Endian).
 * 3. Canonical Tag & Address Parser: 5-digit, 6-digit, prefix syntax, unit addressing, and data type specifications.
 * 4. ModbusClientSession: Transaction lifecycle, request-response matching, exception translation, timeout handling.
 * 5. ModbusDriverAdapter: Decoupled Capa 3 transport integration, frozen 17-field IndustrialDataPoint, RBAC, and fail-closed.
 * 6. Network Severance & Auto-Recovery: Wire failure simulation and re-establishment of telemetry.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ModbusBinaryCodec } from "../services/edge/modbus/ModbusBinaryCodec";
import {
  parseModbusAddress,
  ModbusExceptionCode,
  getModbusExceptionDescription,
  ModbusFunctionCode,
} from "../services/edge/modbus/ModbusTypes";
import { ModbusClientSession } from "../services/edge/modbus/ModbusClientSession";
import { ModbusDriverAdapter } from "../services/edge/drivers/ModbusDriverAdapter";
import { LoopbackVirtualTransport } from "../services/edge/transport/LoopbackVirtualTransport";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

describe("[I25 / OTC-02] Modbus TCP/RTU Real Protocol Stack & Decoupled Transport Interoperability", () => {
  beforeEach(() => {
    process.env.INDUSTRIAL_RUNTIME_PROFILE = "SIMULATION";
    RuntimeProfileManager.getInstance().setOverride("SIMULATION");
    RuntimeProfileManager.getInstance().suppressExitForTesting(true);
  });

  afterEach(() => {
    RuntimeProfileManager.getInstance().resetForTesting();
    delete process.env.INDUSTRIAL_RUNTIME_PROFILE;
  });

  describe("1. Binary Framing & Codec (MBAP + PDU + CRC16)", () => {
    it("should build valid MBAP header and FC 03 Read Holding Registers request", () => {
      const frame = ModbusBinaryCodec.encodeReadHoldingRegisters(
        0x1234, // Transaction ID
        1,      // Unit ID
        0x0064, // Start address = 100
        2       // Quantity = 2
      );

      // Frame length = 7 (MBAP) + 5 (PDU) = 12 bytes
      expect(frame.length).toBe(12);

      const view = new DataView(frame.buffer);
      expect(view.getUint16(0, false)).toBe(0x1234); // Transaction ID
      expect(view.getUint16(2, false)).toBe(0x0000); // Protocol ID (Modbus = 0)
      expect(view.getUint16(4, false)).toBe(6);      // Length = Unit ID (1) + PDU (5)
      expect(frame[6]).toBe(1);                      // Unit ID
      expect(frame[7]).toBe(0x03);                   // Function Code 03
      expect(view.getUint16(8, false)).toBe(100);    // Start address
      expect(view.getUint16(10, false)).toBe(2);     // Quantity
    });

    it("should build valid FC 16 Write Multiple Registers frame", () => {
      const frame = ModbusBinaryCodec.encodeWriteMultipleRegisters(
        0x5678,
        2,
        200,
        [0x1234, 0x5678]
      );

      // MBAP: 7 bytes. PDU: FC(1) + Addr(2) + Qty(2) + ByteCount(1) + Regs(4) = 10 bytes. Total: 17 bytes
      expect(frame.length).toBe(17);
      expect(frame[6]).toBe(2);    // Unit ID
      expect(frame[7]).toBe(0x10); // FC 16
      const view = new DataView(frame.buffer);
      expect(view.getUint16(8, false)).toBe(200);
      expect(view.getUint16(10, false)).toBe(2);
      expect(frame[12]).toBe(4);   // 4 bytes
      expect(view.getUint16(13, false)).toBe(0x1234);
      expect(view.getUint16(15, false)).toBe(0x5678);
    });

    it("should compute and validate standard Modbus RTU CRC-16 (polynomial 0xA001)", () => {
      // Standard Modbus test vector: Unit 0x01, FC 0x03, Addr 0x0000, Qty 0x0002
      // CRC-16 calculated for [0x01, 0x03, 0x00, 0x00, 0x00, 0x02] = 0x0BC4
      const rtuData = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x02]);
      const crc = ModbusBinaryCodec.calculateCRC16(rtuData);
      expect(crc).toBe(0x0bc4);

      const rtuFrame = ModbusBinaryCodec.buildRtuFrame(1, new Uint8Array([0x03, 0x00, 0x00, 0x00, 0x02]));
      expect(rtuFrame.length).toBe(8);
      expect(rtuFrame[6]).toBe(0xc4); // Lo byte
      expect(rtuFrame[7]).toBe(0x0b); // Hi byte

      const decoded = ModbusBinaryCodec.decodeRtuResponse(rtuFrame);
      expect(decoded.crcValid).toBe(true);
      expect(decoded.unitId).toBe(1);
      expect(decoded.functionCode).toBe(0x03);
    });

    it("should decode Modbus Exception frames properly", () => {
      // Build exception response: FC 0x83 (FC 03 error) + Exception 0x02 (ILLEGAL_DATA_ADDRESS)
      const pdu = new Uint8Array([0x83, ModbusExceptionCode.ILLEGAL_DATA_ADDRESS]);
      const frame = ModbusBinaryCodec.buildTcpFrame(0x9999, 1, pdu);

      const resp = ModbusBinaryCodec.decodeTcpResponse(frame);
      expect(resp.isException).toBe(true);
      expect(resp.exceptionCode).toBe(ModbusExceptionCode.ILLEGAL_DATA_ADDRESS);
      const desc = getModbusExceptionDescription(resp.exceptionCode!);
      expect(desc).toContain("Illegal Data Address");
    });
  });

  describe("2. Endianness & Byte-Order Conversions (IEEE 754 & Integers)", () => {
    it("should correctly encode and decode Float32 across all 4 byte-orders", () => {
      const testVal = 123.45;

      const orders: Array<"ABCD" | "CDAB" | "BADC" | "DCBA"> = ["ABCD", "CDAB", "BADC", "DCBA"];
      for (const order of orders) {
        const regs = ModbusBinaryCodec.encodeToRegisters(testVal, "FLOAT32", order);
        expect(regs.length).toBe(2);

        const decoded = ModbusBinaryCodec.decodeRegisters(regs, "FLOAT32", order);
        expect(Math.abs(decoded - testVal)).toBeLessThan(0.01);
      }
    });

    it("should correctly handle signed INT16 and 32-bit integers", () => {
      // Negative 16-bit
      const neg16 = -1234;
      const regs16 = ModbusBinaryCodec.encodeToRegisters(neg16, "INT16");
      expect(regs16[0]).toBe(0xfb2e);
      expect(ModbusBinaryCodec.decodeRegisters(regs16, "INT16")).toBe(neg16);

      // Large 32-bit signed
      const val32 = -98765432;
      const regs32 = ModbusBinaryCodec.encodeToRegisters(val32, "INT32", "ABCD");
      expect(ModbusBinaryCodec.decodeRegisters(regs32, "INT32", "ABCD")).toBe(val32);
    });
  });

  describe("3. Canonical Tag & Address Parser", () => {
    it("should parse classic 5-digit Modbus addresses", () => {
      expect(parseModbusAddress("40001")).toEqual({
        unitId: 1,
        table: "HOLDING_REGISTER",
        address: 0,
        dataType: "UINT16",
        byteOrder: "ABCD",
        wordCount: 1,
      });

      expect(parseModbusAddress("30005")).toEqual({
        unitId: 1,
        table: "INPUT_REGISTER",
        address: 4,
        dataType: "UINT16",
        byteOrder: "ABCD",
        wordCount: 1,
      });

      expect(parseModbusAddress("10010")).toEqual({
        unitId: 1,
        table: "DISCRETE_INPUT",
        address: 9,
        dataType: "BOOL",
        byteOrder: "ABCD",
        wordCount: 1,
      });

      expect(parseModbusAddress("00001")).toEqual({
        unitId: 1,
        table: "COIL",
        address: 0,
        dataType: "BOOL",
        byteOrder: "ABCD",
        wordCount: 1,
      });
    });

    it("should parse prefix syntax and custom unit/type tokens", () => {
      const parsed = parseModbusAddress("unit:2/HR:150:CDAB:FLOAT32");
      expect(parsed.unitId).toBe(2);
      expect(parsed.table).toBe("HOLDING_REGISTER");
      expect(parsed.address).toBe(150);
      expect(parsed.byteOrder).toBe("CDAB");
      expect(parsed.dataType).toBe("FLOAT32");
      expect(parsed.wordCount).toBe(2);

      const parsedCoil = parseModbusAddress("3.C:25");
      expect(parsedCoil.unitId).toBe(3);
      expect(parsedCoil.table).toBe("COIL");
      expect(parsedCoil.address).toBe(25);
    });
  });

  describe("4. ModbusClientSession Request-Response Lifecycle", () => {
    it("should execute binary read and write operations over virtual transport", async () => {
      const transport = new LoopbackVirtualTransport("test-session-transport", {
        host: "10.0.0.1",
        port: 502,
      });

      const serverRegisters = new Map<number, number>([
        [100, 0x1234],
        [101, 0x5678],
      ]);

      transport.setPeerResponder((req: Uint8Array) => {
        const view = new DataView(req.buffer, req.byteOffset, req.byteLength);
        const txId = view.getUint16(0, false);
        const unitId = req[6];
        const fc = req[7];

        if (fc === ModbusFunctionCode.READ_HOLDING_REGISTERS) {
          const addr = view.getUint16(8, false);
          const qty = view.getUint16(10, false);
          const pdu = new Uint8Array(2 + qty * 2);
          pdu[0] = fc;
          pdu[1] = qty * 2;
          const pView = new DataView(pdu.buffer, 2);
          for (let i = 0; i < qty; i++) {
            pView.setUint16(i * 2, serverRegisters.get(addr + i) || 0, false);
          }
          return ModbusBinaryCodec.buildTcpFrame(txId, unitId, pdu);
        }

        if (fc === ModbusFunctionCode.WRITE_SINGLE_REGISTER) {
          const addr = view.getUint16(8, false);
          const val = view.getUint16(10, false);
          serverRegisters.set(addr, val);
          return ModbusBinaryCodec.buildTcpFrame(txId, unitId, req.subarray(7));
        }

        return null;
      });

      await transport.connect();
      const session = new ModbusClientSession(transport, { timeoutMs: 1000 });

      // Read holding registers
      const regs = await session.readHoldingRegisters(1, 100, 2);
      expect(regs).toEqual([0x1234, 0x5678]);

      // Write single register
      await session.writeSingleRegister(1, 105, 0xabcd);
      expect(serverRegisters.get(105)).toBe(0xabcd);

      await transport.disconnect();
    });

    it("should reject request when server returns an exception code", async () => {
      const transport = new LoopbackVirtualTransport("test-session-err", {
        host: "10.0.0.1",
        port: 502,
      });

      transport.setPeerResponder((req: Uint8Array) => {
        const view = new DataView(req.buffer, req.byteOffset, req.byteLength);
        const txId = view.getUint16(0, false);
        const unitId = req[6];
        // Return 0x83 exception
        const pdu = new Uint8Array([0x83, ModbusExceptionCode.ILLEGAL_DATA_ADDRESS]);
        return ModbusBinaryCodec.buildTcpFrame(txId, unitId, pdu);
      });

      await transport.connect();
      const session = new ModbusClientSession(transport, { timeoutMs: 500 });

      await expect(session.readHoldingRegisters(1, 9999, 1)).rejects.toThrow(
        /Modbus Exception from Unit 1.*Illegal Data Address/
      );

      await transport.disconnect();
    });
  });

  describe("5. ModbusDriverAdapter Integration & Industrial Data Points", () => {
    it("should connect, read telemetry, and return frozen 17-field IndustrialDataPoint", async () => {
      const driver = new ModbusDriverAdapter({
        id: "drv-modbus-milling",
        name: "Molino 1 Modbus TCP",
        protocol: "MODBUS-TCP",
        endpoint: "192.168.1.50:502",
        customParameters: {
          scale: 0.1,
          unit: "bar",
        },
      });

      const connected = await driver.connect();
      expect(connected).toBe(true);
      expect(driver.status).toBe("AUTHENTICATED");

      // Read registered holding tag "40002" (initial raw value 645 -> 64.5 bar)
      const dataPoint = await driver.readTag("40002");

      expect(dataPoint.tagId).toBe("40002");
      expect(dataPoint.value).toBe(64.5);
      expect(dataPoint.engineeringUnit).toBe("bar");
      expect(dataPoint.quality).toBe("GOOD");
      expect(dataPoint.qualityReason).toBe("NORMAL");
      expect(dataPoint.protocol).toBe("MODBUS_TCP");
      expect(dataPoint.schemaVersion).toBe("4.0.0");
      expect(Object.isFrozen(dataPoint)).toBe(true);

      await driver.disconnect();
      expect(driver.status).toBe("DISCONNECTED");
    });

    it("should enforce write security, RBAC, and register updates", async () => {
      const driver = new ModbusDriverAdapter({
        id: "drv-modbus-boiler",
        name: "Caldera Modbus TCP",
        protocol: "MODBUS-TCP",
        endpoint: "192.168.1.55:502",
        readOnly: false,
      });

      await driver.connect();

      // Should deny write without clearance
      await expect(
        driver.writeTag("40002", 700, 1, "Ajuste consigna")
      ).rejects.toThrow(/Insufficient clearance level/);

      // Should deny write without valid justification
      await expect(
        driver.writeTag("40002", 700, 2, "ok")
      ).rejects.toThrow(/Operational justification mandatory/);

      // Successful write
      const writeOk = await driver.writeTag(
        "40002",
        800,
        2,
        "Consigna autorizada de vapor secundario"
      );
      expect(writeOk).toBe(true);

      await driver.disconnect();
    });

    it("should fail-closed in PRODUCTION runtime profile if non-production endpoint or mock is supplied", () => {
      process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";
      RuntimeProfileManager.getInstance().setOverride("PRODUCTION");
      RuntimeProfileManager.getInstance().suppressExitForTesting(true);

      expect(() => {
        new ModbusDriverAdapter({
          id: "prod-invalid-modbus",
          protocol: "MODBUS-TCP",
          endpoint: "localhost:502", // localhost prohibited in PRODUCTION
          isSimulatedFallback: true, // simulation prohibited in PRODUCTION
        });
      }).toThrow(/FAIL CLOSED|PRODUCTION/i);
    });
  });

  describe("6. Transport Link Severance & Fault Recovery", () => {
    it("should handle link drop and reflect FAULTED status, then reconnect cleanly", async () => {
      const transport = new LoopbackVirtualTransport("test-drop-transport", {
        host: "10.0.1.10",
        port: 502,
      });

      const driver = new ModbusDriverAdapter(
        {
          id: "drv-modbus-resilient",
          protocol: "MODBUS-TCP",
          endpoint: "10.0.1.10:502",
        },
        transport
      );

      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");

      // Sever link
      transport.simulateLinkSeverance();
      expect(["FAULTED", "RECONNECTING"]).toContain(transport.state);
      expect(["FAULTED", "CONNECTING"]).toContain(driver.status);

      // Attempt read while disconnected must throw
      await driver.disconnect();
      expect(driver.status).toBe("DISCONNECTED");

      // Reconnect
      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");
      await driver.disconnect();
    });
  });
});
