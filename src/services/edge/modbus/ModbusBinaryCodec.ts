/**
 * BioAzúcar 4.0 — Modbus Binary Codec (Capa 2 de Protocolo OT)
 * 
 * High-performance binary encoder/decoder for Modbus TCP and Modbus RTU frames.
 * Complies with Modbus Application Protocol Specification V1.1b3.
 */

import {
  ModbusFunctionCode,
  ModbusExceptionCode,
  ModbusByteOrder,
  ModbusDataType,
  ModbusTcpResponse,
  ModbusRtuResponse,
} from "./ModbusTypes";

export class ModbusBinaryCodec {
  /**
   * Computes standard Modbus RTU CRC-16 checksum (polynomial 0xA001).
   */
  public static calculateCRC16(buffer: Uint8Array): number {
    let crc = 0xffff;
    for (let pos = 0; pos < buffer.length; pos++) {
      crc ^= buffer[pos];
      for (let i = 8; i !== 0; i--) {
        if ((crc & 0x0001) !== 0) {
          crc = (crc >> 1) ^ 0xa001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }

  // ==========================================
  // MODBUS TCP MBAP ENCODERS
  // ==========================================

  /**
   * Builds an MBAP header + PDU buffer.
   * MBAP: TransactionId (2B) + ProtocolId (2B = 0) + Length (2B) + UnitId (1B)
   */
  public static buildTcpFrame(
    transactionId: number,
    unitId: number,
    pdu: Uint8Array
  ): Uint8Array {
    const frame = new Uint8Array(7 + pdu.length);
    const view = new DataView(frame.buffer);

    view.setUint16(0, transactionId, false); // Big endian
    view.setUint16(2, 0, false);            // Modbus Protocol ID = 0
    view.setUint16(4, 1 + pdu.length, false); // Length = Unit ID (1) + PDU length
    frame[6] = unitId & 0xff;

    frame.set(pdu, 7);
    return frame;
  }

  /**
   * FC 01: Read Coils
   */
  public static encodeReadCoils(
    transactionId: number,
    unitId: number,
    startAddress: number,
    quantity: number
  ): Uint8Array {
    const pdu = new Uint8Array(5);
    const view = new DataView(pdu.buffer);
    pdu[0] = ModbusFunctionCode.READ_COILS;
    view.setUint16(1, startAddress, false);
    view.setUint16(3, quantity, false);
    return this.buildTcpFrame(transactionId, unitId, pdu);
  }

  /**
   * FC 02: Read Discrete Inputs
   */
  public static encodeReadDiscreteInputs(
    transactionId: number,
    unitId: number,
    startAddress: number,
    quantity: number
  ): Uint8Array {
    const pdu = new Uint8Array(5);
    const view = new DataView(pdu.buffer);
    pdu[0] = ModbusFunctionCode.READ_DISCRETE_INPUTS;
    view.setUint16(1, startAddress, false);
    view.setUint16(3, quantity, false);
    return this.buildTcpFrame(transactionId, unitId, pdu);
  }

  /**
   * FC 03: Read Holding Registers
   */
  public static encodeReadHoldingRegisters(
    transactionId: number,
    unitId: number,
    startAddress: number,
    quantity: number
  ): Uint8Array {
    const pdu = new Uint8Array(5);
    const view = new DataView(pdu.buffer);
    pdu[0] = ModbusFunctionCode.READ_HOLDING_REGISTERS;
    view.setUint16(1, startAddress, false);
    view.setUint16(3, quantity, false);
    return this.buildTcpFrame(transactionId, unitId, pdu);
  }

  /**
   * FC 04: Read Input Registers
   */
  public static encodeReadInputRegisters(
    transactionId: number,
    unitId: number,
    startAddress: number,
    quantity: number
  ): Uint8Array {
    const pdu = new Uint8Array(5);
    const view = new DataView(pdu.buffer);
    pdu[0] = ModbusFunctionCode.READ_INPUT_REGISTERS;
    view.setUint16(1, startAddress, false);
    view.setUint16(3, quantity, false);
    return this.buildTcpFrame(transactionId, unitId, pdu);
  }

  /**
   * FC 05: Write Single Coil (0xFF00 = ON, 0x0000 = OFF)
   */
  public static encodeWriteSingleCoil(
    transactionId: number,
    unitId: number,
    address: number,
    state: boolean
  ): Uint8Array {
    const pdu = new Uint8Array(5);
    const view = new DataView(pdu.buffer);
    pdu[0] = ModbusFunctionCode.WRITE_SINGLE_COIL;
    view.setUint16(1, address, false);
    view.setUint16(3, state ? 0xff00 : 0x0000, false);
    return this.buildTcpFrame(transactionId, unitId, pdu);
  }

  /**
   * FC 06: Write Single Register (16-bit)
   */
  public static encodeWriteSingleRegister(
    transactionId: number,
    unitId: number,
    address: number,
    value: number
  ): Uint8Array {
    const pdu = new Uint8Array(5);
    const view = new DataView(pdu.buffer);
    pdu[0] = ModbusFunctionCode.WRITE_SINGLE_REGISTER;
    view.setUint16(1, address, false);
    view.setUint16(3, value & 0xffff, false);
    return this.buildTcpFrame(transactionId, unitId, pdu);
  }

  /**
   * FC 16 (0x10): Write Multiple Registers
   */
  public static encodeWriteMultipleRegisters(
    transactionId: number,
    unitId: number,
    startAddress: number,
    registers: number[]
  ): Uint8Array {
    const byteCount = registers.length * 2;
    const pdu = new Uint8Array(6 + byteCount);
    const view = new DataView(pdu.buffer);

    pdu[0] = ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS;
    view.setUint16(1, startAddress, false);
    view.setUint16(3, registers.length, false);
    pdu[5] = byteCount;

    for (let i = 0; i < registers.length; i++) {
      view.setUint16(6 + i * 2, registers[i] & 0xffff, false);
    }

    return this.buildTcpFrame(transactionId, unitId, pdu);
  }

  // ==========================================
  // MODBUS RTU ENCODERS
  // ==========================================

  public static buildRtuFrame(unitId: number, pdu: Uint8Array): Uint8Array {
    const frame = new Uint8Array(1 + pdu.length + 2);
    frame[0] = unitId & 0xff;
    frame.set(pdu, 1);

    const crc = this.calculateCRC16(frame.subarray(0, 1 + pdu.length));
    frame[1 + pdu.length] = crc & 0xff;          // Low byte first
    frame[1 + pdu.length + 1] = (crc >> 8) & 0xff; // High byte second
    return frame;
  }

  // ==========================================
  // DECODERS
  // ==========================================

  /**
   * Decodes a raw incoming TCP byte buffer into a ModbusTcpResponse.
   */
  public static decodeTcpResponse(frame: Uint8Array): ModbusTcpResponse {
    if (frame.length < 8) {
      throw new Error(`Modbus TCP frame too short (${frame.length} bytes, minimum 8 required).`);
    }

    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const transactionId = view.getUint16(0, false);
    const protocolId = view.getUint16(2, false);
    const length = view.getUint16(4, false);
    const unitId = frame[6];
    const functionCode = frame[7];

    if (protocolId !== 0) {
      throw new Error(`Invalid Modbus TCP Protocol Identifier: ${protocolId} (expected 0)`);
    }

    const isException = (functionCode & 0x80) !== 0;
    if (isException) {
      const exceptionCode = frame[8] as ModbusExceptionCode;
      return {
        transactionId,
        protocolId,
        length,
        unitId,
        functionCode,
        isException: true,
        exceptionCode,
        data: frame.subarray(9),
      };
    }

    return {
      transactionId,
      protocolId,
      length,
      unitId,
      functionCode,
      isException: false,
      data: frame.subarray(8),
    };
  }

  /**
   * Decodes a raw incoming RTU byte buffer into a ModbusRtuResponse.
   */
  public static decodeRtuResponse(frame: Uint8Array): ModbusRtuResponse {
    if (frame.length < 4) {
      throw new Error(`Modbus RTU frame too short (${frame.length} bytes, minimum 4 required).`);
    }

    const unitId = frame[0];
    const functionCode = frame[1];
    const payloadLength = frame.length - 2; // Subtract 2 bytes CRC
    const receivedCrc = frame[frame.length - 2] | (frame[frame.length - 1] << 8);
    const computedCrc = this.calculateCRC16(frame.subarray(0, payloadLength));
    const crcValid = receivedCrc === computedCrc;

    const isException = (functionCode & 0x80) !== 0;
    if (isException) {
      const exceptionCode = frame[2] as ModbusExceptionCode;
      return {
        unitId,
        functionCode,
        isException: true,
        exceptionCode,
        data: frame.subarray(3, payloadLength),
        crcValid,
      };
    }

    return {
      unitId,
      functionCode,
      isException: false,
      data: frame.subarray(2, payloadLength),
      crcValid,
    };
  }

  /**
   * Extracts 16-bit register values from a Read Holding/Input Registers response payload.
   */
  public static parseRegistersFromResponse(data: Uint8Array): number[] {
    if (data.length < 1) return [];
    const byteCount = data[0];
    const registers: number[] = [];
    const view = new DataView(data.buffer, data.byteOffset + 1, byteCount);

    for (let i = 0; i < byteCount; i += 2) {
      registers.push(view.getUint16(i, false));
    }
    return registers;
  }

  /**
   * Extracts boolean statuses from a Read Coils / Discrete Inputs response payload.
   */
  public static parseBitsFromResponse(data: Uint8Array, quantity: number): boolean[] {
    if (data.length < 1) return [];
    const byteCount = data[0];
    const bits: boolean[] = [];

    for (let b = 0; b < byteCount; b++) {
      const byteVal = data[1 + b];
      for (let bit = 0; bit < 8; bit++) {
        if (bits.length < quantity) {
          bits.push(((byteVal >> bit) & 1) === 1);
        }
      }
    }
    return bits;
  }

  // ==========================================
  // DATA CONVERSION & ENDIANNESS
  // ==========================================

  /**
   * Decodes 16-bit registers into a typed number according to byte order.
   */
  public static decodeRegisters(
    registers: number[],
    dataType: ModbusDataType,
    byteOrder: ModbusByteOrder = "ABCD"
  ): number {
    if (registers.length === 0) return 0;

    if (dataType === "UINT16") {
      return registers[0] & 0xffff;
    }

    if (dataType === "INT16") {
      const raw = registers[0] & 0xffff;
      return raw >= 0x8000 ? raw - 0x10000 : raw;
    }

    if (registers.length < 2) {
      return registers[0];
    }

    const reg0 = registers[0];
    const reg1 = registers[1];

    const b0 = (reg0 >> 8) & 0xff;
    const b1 = reg0 & 0xff;
    const b2 = (reg1 >> 8) & 0xff;
    const b3 = reg1 & 0xff;

    let orderedBytes: number[];
    switch (byteOrder) {
      case "ABCD": // Big Endian
        orderedBytes = [b0, b1, b2, b3];
        break;
      case "CDAB": // Mid-Little Endian (Word swap)
        orderedBytes = [b2, b3, b0, b1];
        break;
      case "BADC": // Byte Swap
        orderedBytes = [b1, b0, b3, b2];
        break;
      case "DCBA": // Little Endian
        orderedBytes = [b3, b2, b1, b0];
        break;
    }

    const buffer = new Uint8Array(orderedBytes);
    const view = new DataView(buffer.buffer);

    if (dataType === "FLOAT32") {
      return Number(view.getFloat32(0, false).toFixed(4));
    }
    if (dataType === "INT32") {
      return view.getInt32(0, false);
    }
    if (dataType === "UINT32") {
      return view.getUint32(0, false);
    }

    return registers[0];
  }

  /**
   * Encodes a typed number into 16-bit registers according to byte order.
   */
  public static encodeToRegisters(
    value: number,
    dataType: ModbusDataType,
    byteOrder: ModbusByteOrder = "ABCD"
  ): number[] {
    if (dataType === "UINT16") {
      return [value & 0xffff];
    }
    if (dataType === "INT16") {
      return [value < 0 ? (value + 0x10000) & 0xffff : value & 0xffff];
    }

    const buffer = new Uint8Array(4);
    const view = new DataView(buffer.buffer);

    if (dataType === "FLOAT32") {
      view.setFloat32(0, value, false);
    } else if (dataType === "INT32") {
      view.setInt32(0, value, false);
    } else if (dataType === "UINT32") {
      view.setUint32(0, value, false);
    } else {
      return [value & 0xffff];
    }

    const b0 = buffer[0];
    const b1 = buffer[1];
    const b2 = buffer[2];
    const b3 = buffer[3];

    let reg0 = 0;
    let reg1 = 0;

    switch (byteOrder) {
      case "ABCD":
        reg0 = (b0 << 8) | b1;
        reg1 = (b2 << 8) | b3;
        break;
      case "CDAB":
        reg0 = (b2 << 8) | b3;
        reg1 = (b0 << 8) | b1;
        break;
      case "BADC":
        reg0 = (b1 << 8) | b0;
        reg1 = (b3 << 8) | b2;
        break;
      case "DCBA":
        reg0 = (b3 << 8) | b2;
        reg1 = (b1 << 8) | b0;
        break;
    }

    return [reg0, reg1];
  }
}
