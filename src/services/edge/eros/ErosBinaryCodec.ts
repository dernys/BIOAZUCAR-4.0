/**
 * BioAzúcar 4.0 — DCS EROS Binary Codec & Framing Engine
 * 
 * Frame-level serializer and deserializer for the EROS-NET industrial protocol:
 * - 9-byte header framing with SYNC_WORD 0x4552 ("ER")
 * - CRC-16 Modbus/IBM integrity verification
 * - Big-Endian IEEE 754 Float32, Int32, Int16, and Bit memory addressing
 * - Variable read/write services and heartbeat commands
 */

import {
  EROS_SYNC_WORD,
  EROS_PROTOCOL_VERSION,
  EROS_HEADER_SIZE,
  EROS_CHECKSUM_SIZE,
  ErosCommandCode,
  ErosStatusCode,
  ErosAreaType,
  ErosDataType,
  ErosHeader,
  ErosPacket,
  ErosParsedAddress,
} from "./ErosTypes";

export class ErosBinaryCodec {
  /**
   * Calculates CRC-16 Modbus (polynomial 0xA001, init 0xFFFF).
   */
  public static calculateCrc16(data: Uint8Array): number {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x0001) !== 0) {
          crc = (crc >> 1) ^ 0xa001;
        } else {
          crc = crc >> 1;
        }
      }
    }
    return crc & 0xffff;
  }

  /**
   * Builds an EROS frame header (9 bytes).
   */
  public static buildHeader(
    command: ErosCommandCode,
    sequence: number,
    payloadLength: number,
    stationId: number = 1
  ): Uint8Array {
    const header = new Uint8Array(EROS_HEADER_SIZE);
    const view = new DataView(header.buffer);

    view.setUint16(0, EROS_SYNC_WORD, false); // Big-Endian
    header[2] = EROS_PROTOCOL_VERSION;
    header[3] = stationId & 0xff;
    header[4] = command & 0xff;
    view.setUint16(5, sequence & 0xffff, false);
    view.setUint16(7, payloadLength & 0xffff, false);

    return header;
  }

  /**
   * Builds a complete EROS packet: Header (9) + Payload (n) + CRC16 (2).
   */
  public static buildPacket(
    command: ErosCommandCode,
    sequence: number,
    payload: Uint8Array,
    stationId: number = 1
  ): Uint8Array {
    const header = this.buildHeader(command, sequence, payload.length, stationId);
    const body = new Uint8Array(header.length + payload.length);
    body.set(header, 0);
    body.set(payload, header.length);

    const crc = this.calculateCrc16(body);
    const packet = new Uint8Array(body.length + EROS_CHECKSUM_SIZE);
    packet.set(body, 0);
    const view = new DataView(packet.buffer);
    view.setUint16(body.length, crc, false); // Big-Endian CRC

    return packet;
  }

  /**
   * Decodes an EROS packet from a stream buffer, validating sync word and CRC-16.
   */
  public static decodePacket(data: Uint8Array): {
    valid: boolean;
    packet?: ErosPacket;
    remaining?: Uint8Array;
    error?: string;
  } {
    // 1. Find sync word (0x45, 0x52)
    let syncIndex = -1;
    for (let i = 0; i <= data.length - 2; i++) {
      if (data[i] === 0x45 && data[i + 1] === 0x52) {
        syncIndex = i;
        break;
      }
    }

    if (syncIndex === -1) {
      return {
        valid: false,
        error: "EROS Sync Word (0x4552) not found in stream buffer",
        remaining: data.length > 1 ? data.subarray(data.length - 1) : data,
      };
    }

    const aligned = data.subarray(syncIndex);
    if (aligned.length < EROS_HEADER_SIZE) {
      return {
        valid: false,
        error: `Incomplete header: ${aligned.length} bytes (expected >= ${EROS_HEADER_SIZE})`,
        remaining: aligned,
      };
    }

    const view = new DataView(aligned.buffer, aligned.byteOffset, aligned.byteLength);
    const syncWord = view.getUint16(0, false);
    const version = aligned[2];
    const stationId = aligned[3];
    const command = aligned[4] as ErosCommandCode;
    const sequence = view.getUint16(5, false);
    const payloadLength = view.getUint16(7, false);

    const totalPacketSize = EROS_HEADER_SIZE + payloadLength + EROS_CHECKSUM_SIZE;
    if (aligned.length < totalPacketSize) {
      return {
        valid: false,
        error: `Fragmented packet: received ${aligned.length} bytes, expected ${totalPacketSize}`,
        remaining: aligned,
      };
    }

    const bodyBytes = aligned.subarray(0, EROS_HEADER_SIZE + payloadLength);
    const expectedCrc = this.calculateCrc16(bodyBytes);
    const packetCrc = view.getUint16(EROS_HEADER_SIZE + payloadLength, false);

    if (expectedCrc !== packetCrc) {
      return {
        valid: false,
        error: `CRC-16 mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${packetCrc.toString(16)}`,
        remaining: aligned.subarray(totalPacketSize),
      };
    }

    const payload = aligned.subarray(EROS_HEADER_SIZE, EROS_HEADER_SIZE + payloadLength);
    const remaining = aligned.length > totalPacketSize ? aligned.subarray(totalPacketSize) : undefined;

    const header: ErosHeader = {
      syncWord,
      version,
      stationId,
      command,
      sequence,
      payloadLength,
    };

    return {
      valid: true,
      packet: { header, payload, checksum: packetCrc },
      remaining,
    };
  }

  // --------------------------------------------------------------------------
  // Variable Services Serialization
  // --------------------------------------------------------------------------

  /**
   * Builds Read Variable Request (Command 0x03).
   * Payload: DB_NUMBER(2) + AREA_TYPE(1) + OFFSET(2) + BIT_INDEX(1) = 6 bytes.
   */
  public static buildReadVariableRequest(
    sequence: number,
    dbNumber: number,
    areaType: ErosAreaType,
    offset: number,
    bitIndex: number = 0,
    stationId: number = 1
  ): Uint8Array {
    const payload = new Uint8Array(6);
    const view = new DataView(payload.buffer);
    view.setUint16(0, dbNumber, false);
    payload[2] = areaType;
    view.setUint16(3, offset, false);
    payload[5] = bitIndex;

    return this.buildPacket(ErosCommandCode.READ_VARIABLE, sequence, payload, stationId);
  }

  /**
   * Builds Read Variable Response (Command 0x83).
   * Payload: STATUS(1) + DATA_TYPE(1) + VALUE_BYTES(n).
   */
  public static buildReadVariableResponse(
    sequence: number,
    status: ErosStatusCode,
    dataType: ErosDataType,
    valueBytes: Uint8Array,
    stationId: number = 1
  ): Uint8Array {
    const payload = new Uint8Array(2 + valueBytes.length);
    payload[0] = status;
    payload[1] = dataType;
    payload.set(valueBytes, 2);

    return this.buildPacket(ErosCommandCode.READ_VARIABLE_RESPONSE, sequence, payload, stationId);
  }

  /**
   * Builds Write Variable Request (Command 0x04).
   * Payload: DB_NUMBER(2) + AREA_TYPE(1) + OFFSET(2) + BIT_INDEX(1) + DATA_TYPE(1) + VALUE_BYTES(n).
   */
  public static buildWriteVariableRequest(
    sequence: number,
    dbNumber: number,
    areaType: ErosAreaType,
    offset: number,
    dataType: ErosDataType,
    valueBytes: Uint8Array,
    bitIndex: number = 0,
    stationId: number = 1
  ): Uint8Array {
    const payload = new Uint8Array(7 + valueBytes.length);
    const view = new DataView(payload.buffer);
    view.setUint16(0, dbNumber, false);
    payload[2] = areaType;
    view.setUint16(3, offset, false);
    payload[5] = bitIndex;
    payload[6] = dataType;
    payload.set(valueBytes, 7);

    return this.buildPacket(ErosCommandCode.WRITE_VARIABLE, sequence, payload, stationId);
  }

  /**
   * Builds Write Variable Response (Command 0x84).
   * Payload: STATUS(1).
   */
  public static buildWriteVariableResponse(
    sequence: number,
    status: ErosStatusCode,
    stationId: number = 1
  ): Uint8Array {
    const payload = new Uint8Array([status]);
    return this.buildPacket(ErosCommandCode.WRITE_VARIABLE_RESPONSE, sequence, payload, stationId);
  }

  /**
   * Builds Heartbeat Request (Command 0x05).
   */
  public static buildHeartbeatPacket(sequence: number, stationId: number = 1): Uint8Array {
    return this.buildPacket(ErosCommandCode.HEARTBEAT, sequence, new Uint8Array(0), stationId);
  }

  /**
   * Builds Heartbeat Response (Command 0x85).
   */
  public static buildHeartbeatResponse(
    sequence: number,
    status: ErosStatusCode = ErosStatusCode.SUCCESS,
    stationId: number = 1
  ): Uint8Array {
    return this.buildPacket(ErosCommandCode.HEARTBEAT_RESPONSE, sequence, new Uint8Array([status]), stationId);
  }

  // --------------------------------------------------------------------------
  // Data Encoding & Decoding (Big-Endian)
  // --------------------------------------------------------------------------

  public static encodeValue(value: number | boolean | string, dataType: ErosDataType): Uint8Array {
    switch (dataType) {
      case ErosDataType.BOOL: {
        const b = typeof value === "boolean" ? value : Number(value) !== 0;
        return new Uint8Array([b ? 0x01 : 0x00]);
      }
      case ErosDataType.INT16: {
        const buf = new Uint8Array(2);
        new DataView(buf.buffer).setInt16(0, Number(value), false);
        return buf;
      }
      case ErosDataType.INT32: {
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setInt32(0, Number(value), false);
        return buf;
      }
      case ErosDataType.FLOAT32: {
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setFloat32(0, Number(value), false);
        return buf;
      }
      case ErosDataType.STRING: {
        const strBytes = new TextEncoder().encode(String(value));
        const buf = new Uint8Array(2 + strBytes.length);
        new DataView(buf.buffer).setUint16(0, strBytes.length, false);
        buf.set(strBytes, 2);
        return buf;
      }
      default: {
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setFloat32(0, Number(value), false);
        return buf;
      }
    }
  }

  public static decodeValue(bytes: Uint8Array, dataType: ErosDataType): number | boolean | string {
    if (bytes.length === 0) return 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    switch (dataType) {
      case ErosDataType.BOOL:
        return bytes[0] !== 0;
      case ErosDataType.INT16:
        return view.getInt16(0, false);
      case ErosDataType.INT32:
        return view.getInt32(0, false);
      case ErosDataType.FLOAT32:
        return Number(view.getFloat32(0, false).toFixed(4));
      case ErosDataType.STRING: {
        if (bytes.length < 2) return "";
        const len = view.getUint16(0, false);
        const sub = bytes.subarray(2, 2 + Math.min(len, bytes.length - 2));
        return new TextDecoder().decode(sub);
      }
      default:
        return Number(view.getFloat32(0, false).toFixed(4));
    }
  }

  /**
   * Parses standard EROS memory address syntax: "DB10.DBD14" or "DB10.DBX0.1".
   */
  public static parseAddress(rawAddress: string): ErosParsedAddress {
    const match = rawAddress.trim().match(/^DB(\d+)\.DB([XBWDbxd])(\d+)(?:\.(\d+))?$/i);
    if (!match) {
      throw new Error(
        `Invalid EROS memory address syntax: '${rawAddress}'. Expected format: DB<n>.DB<X|B|W|D><offset>[.<bit>]`
      );
    }

    const dbNumber = parseInt(match[1], 10);
    const areaType = match[2].toUpperCase() as "X" | "B" | "W" | "D";
    const offset = parseInt(match[3], 10);
    const bitIndex = match[4] !== undefined ? parseInt(match[4], 10) : undefined;

    if (areaType === "X" && (bitIndex === undefined || bitIndex < 0 || bitIndex > 7)) {
      throw new Error(`Invalid bit index in EROS bit address: '${rawAddress}'. Bit must be 0-7.`);
    }

    return { dbNumber, areaType, offset, bitIndex };
  }
}
