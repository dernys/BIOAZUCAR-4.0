/**
 * BioAzúcar 4.0 — Rockwell EtherNet/IP & CIP Binary Codec
 * 
 * High-performance, bit-accurate Little-Endian binary serializer and deserializer
 * for EtherNet/IP Encapsulation (port 44818), Common Packet Format (CPF),
 * CIP Services (0x4C Read Tag, 0x4D Write Tag), and EPATH ANSI Extended Symbol Segments.
 */

import {
  EipCommand,
  EipStatus,
  CpfTypeId,
  CipServiceCode,
  CipGeneralStatus,
  CipDataTypeCode,
  CipStandardDataType,
  EipEncapsulationHeader,
  CpfItem,
  CpfPacket,
  CipResponse,
  getCipDataTypeName,
  getCipDataTypeCode,
} from "./CipTypes";

export class CipBinaryCodec {
  public static readonly ENCAPSULATION_HEADER_LEN = 24;

  // --------------------------------------------------------------------------
  // 1. EtherNet/IP Encapsulation Framing
  // --------------------------------------------------------------------------

  /**
   * Builds a 24-byte EtherNet/IP Encapsulation Header.
   */
  public static buildEncapsulationHeader(
    command: number,
    payloadLength: number,
    sessionHandle: number = 0,
    senderContext?: Uint8Array,
    status: number = EipStatus.SUCCESS,
    options: number = 0
  ): Uint8Array {
    const header = new Uint8Array(this.ENCAPSULATION_HEADER_LEN);
    const view = new DataView(header.buffer);

    view.setUint16(0, command, true);
    view.setUint16(2, payloadLength, true);
    view.setUint32(4, sessionHandle, true);
    view.setUint32(8, status, true);

    if (senderContext && senderContext.length === 8) {
      header.set(senderContext, 12);
    } else {
      // Default 8-byte zero context
      header.fill(0, 12, 20);
    }

    view.setUint32(20, options, true);
    return header;
  }

  /**
   * Decodes an EtherNet/IP packet into header and payload.
   */
  public static decodeEncapsulationPacket(data: Uint8Array): {
    valid: boolean;
    header: EipEncapsulationHeader;
    payload: Uint8Array;
    remaining?: Uint8Array;
    error?: string;
  } {
    if (data.length < this.ENCAPSULATION_HEADER_LEN) {
      return {
        valid: false,
        header: {
          command: 0,
          length: 0,
          sessionHandle: 0,
          status: 0,
          senderContext: new Uint8Array(8),
          options: 0,
        },
        payload: new Uint8Array(0),
        error: `Incomplete EtherNet/IP header: received ${data.length} bytes, expected at least 24`,
      };
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const command = view.getUint16(0, true);
    const length = view.getUint16(2, true);
    const sessionHandle = view.getUint32(4, true);
    const status = view.getUint32(8, true);
    const senderContext = new Uint8Array(data.buffer, data.byteOffset + 12, 8).slice();
    const options = view.getUint32(20, true);

    const totalExpected = this.ENCAPSULATION_HEADER_LEN + length;
    if (data.length < totalExpected) {
      return {
        valid: false,
        header: { command, length, sessionHandle, status, senderContext, options },
        payload: new Uint8Array(0),
        error: `Fragmented EtherNet/IP frame: received ${data.length} bytes, expected ${totalExpected}`,
      };
    }

    const payload = data.subarray(this.ENCAPSULATION_HEADER_LEN, totalExpected);
    const remaining = data.length > totalExpected ? data.subarray(totalExpected) : undefined;

    return {
      valid: true,
      header: { command, length, sessionHandle, status, senderContext, options },
      payload,
      remaining,
    };
  }

  // --------------------------------------------------------------------------
  // 2. Session Management Commands
  // --------------------------------------------------------------------------

  /**
   * Builds RegisterSession request (Command 0x0065).
   * Payload: Protocol Version (UInt16 LE = 1), Options Flags (UInt16 LE = 0).
   */
  public static buildRegisterSessionPacket(senderContext?: Uint8Array): Uint8Array {
    const payload = new Uint8Array(4);
    const view = new DataView(payload.buffer);
    view.setUint16(0, 1, true); // Protocol version 1
    view.setUint16(2, 0, true); // Options flags 0

    const header = this.buildEncapsulationHeader(
      EipCommand.REGISTER_SESSION,
      payload.length,
      0,
      senderContext,
      EipStatus.SUCCESS,
      0
    );

    const packet = new Uint8Array(header.length + payload.length);
    packet.set(header, 0);
    packet.set(payload, header.length);
    return packet;
  }

  /**
   * Builds RegisterSession response (Command 0x0065) with allocated sessionHandle.
   */
  public static buildRegisterSessionResponse(
    sessionHandle: number,
    senderContext?: Uint8Array
  ): Uint8Array {
    const payload = new Uint8Array(4);
    const view = new DataView(payload.buffer);
    view.setUint16(0, 1, true);
    view.setUint16(2, 0, true);

    const header = this.buildEncapsulationHeader(
      EipCommand.REGISTER_SESSION,
      payload.length,
      sessionHandle,
      senderContext,
      EipStatus.SUCCESS,
      0
    );

    const packet = new Uint8Array(header.length + payload.length);
    packet.set(header, 0);
    packet.set(payload, header.length);
    return packet;
  }

  /**
   * Builds UnRegisterSession request (Command 0x0066).
   */
  public static buildUnRegisterSessionPacket(
    sessionHandle: number,
    senderContext?: Uint8Array
  ): Uint8Array {
    return this.buildEncapsulationHeader(
      EipCommand.UNREGISTER_SESSION,
      0,
      sessionHandle,
      senderContext,
      EipStatus.SUCCESS,
      0
    );
  }

  // --------------------------------------------------------------------------
  // 3. Common Packet Format (CPF) Serialization & Deserialization
  // --------------------------------------------------------------------------

  /**
   * Builds Common Packet Format (CPF) buffer.
   */
  public static buildCpfPacket(
    items: CpfItem[],
    interfaceHandle: number = 0,
    timeout: number = 0
  ): Uint8Array {
    let itemsTotalLen = 0;
    for (const it of items) {
      itemsTotalLen += 4 + it.data.length; // 2 bytes TypeId + 2 bytes Length + data
    }

    const totalLen = 4 + 2 + 2 + itemsTotalLen; // InterfaceHandle (4) + Timeout (2) + ItemCount (2) + items
    const buffer = new Uint8Array(totalLen);
    const view = new DataView(buffer.buffer);

    view.setUint32(0, interfaceHandle, true);
    view.setUint16(4, timeout, true);
    view.setUint16(6, items.length, true);

    let offset = 8;
    for (const it of items) {
      view.setUint16(offset, it.typeId, true);
      view.setUint16(offset + 2, it.data.length, true);
      buffer.set(it.data, offset + 4);
      offset += 4 + it.data.length;
    }

    return buffer;
  }

  /**
   * Decodes a Common Packet Format (CPF) packet.
   */
  public static decodeCpfPacket(data: Uint8Array): CpfPacket {
    if (data.length < 8) {
      throw new Error(`CPF packet too small: ${data.length} bytes (expected >= 8)`);
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const interfaceHandle = view.getUint32(0, true);
    const timeout = view.getUint16(4, true);
    const itemCount = view.getUint16(6, true);

    const items: CpfItem[] = [];
    let offset = 8;

    for (let i = 0; i < itemCount; i++) {
      if (offset + 4 > data.length) {
        throw new Error(`Malformed CPF packet: truncated item header at offset ${offset}`);
      }
      const typeId = view.getUint16(offset, true);
      const length = view.getUint16(offset + 2, true);
      offset += 4;

      if (offset + length > data.length) {
        throw new Error(`Malformed CPF packet: truncated item data at offset ${offset}`);
      }
      const itemData = data.subarray(offset, offset + length);
      items.push({ typeId, length, data: itemData });
      offset += length;
    }

    return { interfaceHandle, timeout, items };
  }

  // --------------------------------------------------------------------------
  // 4. EPATH Generation (ANSI Extended Symbol Segment)
  // --------------------------------------------------------------------------

  /**
   * Encodes a ControlLogix / CompactLogix tag path into EPATH bytes.
   * Handles:
   * - Simple tag: "Boiler_1_Pressure" -> 0x91 [len] [chars...] [pad if odd]
   * - Array index: "Tandem_Drives[2]" -> 0x91 [len] "Tandem_Drives" [pad] + 0x28 [index]
   * - Nested structure: "Boiler.Steam.Flow" -> chained 0x91 segments
   */
  public static encodeEpath(tagPath: string): Uint8Array {
    const parts = tagPath.split(".");
    const segments: Uint8Array[] = [];

    for (const part of parts) {
      const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
      const tagName = arrayMatch ? arrayMatch[1] : part;
      const arrayIndex = arrayMatch ? parseInt(arrayMatch[2], 10) : null;

      // ANSI Extended Symbol Segment (0x91)
      const asciiBytes = new TextEncoder().encode(tagName);
      const len = asciiBytes.length;
      const hasPad = len % 2 !== 0;
      const symbolSegLen = 2 + len + (hasPad ? 1 : 0);
      const symbolSeg = new Uint8Array(symbolSegLen);

      symbolSeg[0] = 0x91;
      symbolSeg[1] = len;
      symbolSeg.set(asciiBytes, 2);
      if (hasPad) {
        symbolSeg[2 + len] = 0x00;
      }
      segments.push(symbolSeg);

      // Element Segment (if array index present)
      if (arrayIndex !== null) {
        if (arrayIndex <= 255) {
          // 8-bit Member ID: 0x28, index
          segments.push(new Uint8Array([0x28, arrayIndex]));
        } else if (arrayIndex <= 65535) {
          // 16-bit Member ID: 0x29, 0x00 (pad), UInt16 LE
          const arrSeg = new Uint8Array(4);
          arrSeg[0] = 0x29;
          arrSeg[1] = 0x00;
          const v = new DataView(arrSeg.buffer);
          v.setUint16(2, arrayIndex, true);
          segments.push(arrSeg);
        } else {
          // 32-bit Member ID: 0x2A, 0x00 (pad), UInt32 LE
          const arrSeg = new Uint8Array(6);
          arrSeg[0] = 0x2a;
          arrSeg[1] = 0x00;
          const v = new DataView(arrSeg.buffer);
          v.setUint32(2, arrayIndex, true);
          segments.push(arrSeg);
        }
      }
    }

    let totalLen = 0;
    for (const seg of segments) {
      totalLen += seg.length;
    }

    const epath = new Uint8Array(totalLen);
    let offset = 0;
    for (const seg of segments) {
      epath.set(seg, offset);
      offset += seg.length;
    }

    return epath;
  }

  // --------------------------------------------------------------------------
  // 5. CIP Service Requests (Read Tag / Write Tag)
  // --------------------------------------------------------------------------

  /**
   * Builds CIP Read Tag Request (Service 0x4C).
   */
  public static buildReadTagRequest(tagName: string, elementCount: number = 1): Uint8Array {
    const epath = this.encodeEpath(tagName);
    const pathWords = Math.floor(epath.length / 2);

    const req = new Uint8Array(2 + epath.length + 2);
    req[0] = CipServiceCode.READ_TAG;
    req[1] = pathWords;
    req.set(epath, 2);

    const view = new DataView(req.buffer);
    view.setUint16(2 + epath.length, elementCount, true);
    return req;
  }

  /**
   * Builds CIP Write Tag Request (Service 0x4D).
   */
  public static buildWriteTagRequest(
    tagName: string,
    value: number | boolean | string,
    dataType: CipStandardDataType,
    elementCount: number = 1
  ): Uint8Array {
    const epath = this.encodeEpath(tagName);
    const pathWords = Math.floor(epath.length / 2);
    const dataTypeCode = getCipDataTypeCode(dataType);
    const encodedValue = this.encodeValueToBytes(value, dataType);

    const req = new Uint8Array(2 + epath.length + 2 + 2 + encodedValue.length);
    req[0] = CipServiceCode.WRITE_TAG;
    req[1] = pathWords;
    req.set(epath, 2);

    const view = new DataView(req.buffer);
    const offset = 2 + epath.length;
    view.setUint16(offset, dataTypeCode, true);
    view.setUint16(offset + 2, elementCount, true);
    req.set(encodedValue, offset + 4);

    return req;
  }

  /**
   * Encloses a CIP payload into an EtherNet/IP SendRRData (Command 0x006F) frame.
   */
  public static buildSendRRDataPacket(
    sessionHandle: number,
    cipPayload: Uint8Array,
    senderContext?: Uint8Array,
    timeout: number = 0
  ): Uint8Array {
    // Standard SendRRData CPF:
    // Item 0: Null Address Item (0x0000, len 0)
    // Item 1: Unconnected Data Item (0x00B2, len cipPayload.length)
    const items: CpfItem[] = [
      { typeId: CpfTypeId.NULL_ADDRESS, length: 0, data: new Uint8Array(0) },
      { typeId: CpfTypeId.UNCONNECTED_DATA, length: cipPayload.length, data: cipPayload },
    ];

    const cpfBuffer = this.buildCpfPacket(items, 0, timeout);

    const header = this.buildEncapsulationHeader(
      EipCommand.SEND_RR_DATA,
      cpfBuffer.length,
      sessionHandle,
      senderContext,
      EipStatus.SUCCESS,
      0
    );

    const packet = new Uint8Array(header.length + cpfBuffer.length);
    packet.set(header, 0);
    packet.set(cpfBuffer, header.length);
    return packet;
  }

  /**
   * Encloses a CIP response into an EtherNet/IP SendRRData response frame.
   */
  public static buildSendRRDataResponse(
    sessionHandle: number,
    cipResponsePayload: Uint8Array,
    senderContext?: Uint8Array
  ): Uint8Array {
    return this.buildSendRRDataPacket(sessionHandle, cipResponsePayload, senderContext);
  }

  // --------------------------------------------------------------------------
  // 6. CIP Service Responses Decoding
  // --------------------------------------------------------------------------

  /**
   * Decodes a raw CIP response payload (e.g. extracted from CPF Unconnected Data Item).
   */
  public static decodeCipResponse(data: Uint8Array): CipResponse {
    if (data.length < 4) {
      throw new Error(`Truncated CIP response: received ${data.length} bytes (expected >= 4)`);
    }

    const service = data[0];
    const generalStatus = data[2];
    const extStatusWordCount = data[3];

    const extendedStatus: number[] = [];
    let offset = 4;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    for (let i = 0; i < extStatusWordCount; i++) {
      if (offset + 2 > data.length) break;
      extendedStatus.push(view.getUint16(offset, true));
      offset += 2;
    }

    if (generalStatus !== CipGeneralStatus.SUCCESS) {
      return {
        service,
        generalStatus,
        extendedStatus,
        data: data.subarray(offset),
      };
    }

    // For Read Tag Response (Service 0xCC = 0x4C | 0x80)
    if (service === (CipServiceCode.READ_TAG | 0x80)) {
      if (offset + 2 <= data.length) {
        const dataType = view.getUint16(offset, true);
        offset += 2;
        return {
          service,
          generalStatus,
          extendedStatus,
          dataType,
          data: data.subarray(offset),
        };
      }
    }

    return {
      service,
      generalStatus,
      extendedStatus,
      data: data.subarray(offset),
    };
  }

  // --------------------------------------------------------------------------
  // 7. Endianness & Data Type Encoding / Decoding (Little-Endian)
  // --------------------------------------------------------------------------

  /**
   * Serializes a JavaScript value to Little-Endian CIP bytes.
   */
  public static encodeValueToBytes(
    value: number | boolean | string,
    dataType: CipStandardDataType
  ): Uint8Array {
    switch (dataType) {
      case "BOOL": {
        const boolVal = typeof value === "boolean" ? value : Number(value) !== 0;
        return new Uint8Array([boolVal ? 0x01 : 0x00]);
      }
      case "SINT": {
        const buf = new Uint8Array(1);
        new DataView(buf.buffer).setInt8(0, Number(value));
        return buf;
      }
      case "USINT": {
        return new Uint8Array([Number(value) & 0xff]);
      }
      case "INT": {
        const buf = new Uint8Array(2);
        new DataView(buf.buffer).setInt16(0, Number(value), true);
        return buf;
      }
      case "UINT": {
        const buf = new Uint8Array(2);
        new DataView(buf.buffer).setUint16(0, Number(value), true);
        return buf;
      }
      case "DINT": {
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setInt32(0, Number(value), true);
        return buf;
      }
      case "UDINT": {
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setUint32(0, Number(value), true);
        return buf;
      }
      case "REAL": {
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setFloat32(0, Number(value), true);
        return buf;
      }
      case "STRING": {
        const str = String(value);
        const ascii = new TextEncoder().encode(str);
        const len = ascii.length;
        const buf = new Uint8Array(4 + len + (len % 2 !== 0 ? 1 : 0));
        const view = new DataView(buf.buffer);
        view.setUint32(0, len, true);
        buf.set(ascii, 4);
        return buf;
      }
      default: {
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setFloat32(0, Number(value), true);
        return buf;
      }
    }
  }

  /**
   * Deserializes Little-Endian CIP bytes to JavaScript values.
   */
  public static decodeBytesToValue(
    bytes: Uint8Array,
    dataType: CipStandardDataType
  ): number | boolean | string {
    if (bytes.length === 0) return 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    switch (dataType) {
      case "BOOL":
        return bytes[0] !== 0;
      case "SINT":
        return view.getInt8(0);
      case "USINT":
        return bytes[0];
      case "INT":
        return view.getInt16(0, true);
      case "UINT":
        return view.getUint16(0, true);
      case "DINT":
        return view.getInt32(0, true);
      case "UDINT":
        return view.getUint32(0, true);
      case "REAL":
        return Number(view.getFloat32(0, true).toFixed(4));
      case "STRING": {
        if (bytes.length < 4) return "";
        const len = view.getUint32(0, true);
        const strBytes = bytes.subarray(4, 4 + Math.min(len, bytes.length - 4));
        return new TextDecoder().decode(strBytes);
      }
      default:
        return Number(view.getFloat32(0, true).toFixed(4));
    }
  }

  /**
   * Decodes bytes using a CIP Data Type Code (e.g. 0x00CA -> REAL).
   */
  public static decodeByType(dataTypeCode: number, bytes: Uint8Array): number | boolean | string {
    const typeName = getCipDataTypeName(dataTypeCode);
    return this.decodeBytesToValue(bytes, typeName);
  }
}
