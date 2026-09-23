/**
 * BioAzúcar 4.0 — Siemens S7 Binary Framing & Codec Engine
 * 
 * Implements byte-level serialization and deserialization for:
 * 1. RFC 1006 TPKT Layer (Version 3, length-prefixed framing over TCP port 102)
 * 2. ISO 8073 / RFC 905 COTP Layer (Connection-Oriented Transport Protocol TP0)
 * 3. Siemens S7 Communication PDU Layer (ROSCTR Job/Ack_Data, Setup Comm, Read/Write Var)
 * 4. Big-Endian / Network Byte Order conversions for IEEE 754 Float32, Int16, Int32, UInt16, UInt32, and Bits.
 */

import {
  S7AreaCode,
  S7TransportSize,
  S7DataTransportSize,
  S7Rosctr,
  S7FunctionCode,
  S7ReturnCode,
  CotpPduType,
  S7DataType,
} from "./S7Types";

export interface S7ReadItem {
  areaCode: S7AreaCode;
  dbNumber: number;
  byteOffset: number;
  bitOffset?: number;
  count: number;
  transportSize: S7TransportSize;
}

export interface S7WriteItem extends S7ReadItem {
  data: Uint8Array;
}

export interface S7ReadResponseItem {
  returnCode: number;
  transportSize: number;
  dataLengthBytes: number;
  data: Uint8Array;
}

export class S7BinaryCodec {
  // --------------------------------------------------------------------------
  // 1. TPKT Framing (RFC 1006)
  // --------------------------------------------------------------------------

  /**
   * Wraps payload in a 4-byte TPKT header.
   * [0x03, 0x00, Length_Hi, Length_Lo]
   */
  public static buildTpktFrame(payload: Uint8Array): Uint8Array {
    const totalLength = 4 + payload.length;
    const frame = new Uint8Array(totalLength);
    frame[0] = 0x03; // TPKT Version 3
    frame[1] = 0x00; // Reserved
    frame[2] = (totalLength >> 8) & 0xff;
    frame[3] = totalLength & 0xff;
    frame.set(payload, 4);
    return frame;
  }

  /**
   * Decodes a TPKT frame and verifies RFC 1006 integrity.
   */
  public static decodeTpktFrame(frame: Uint8Array): {
    valid: boolean;
    payload: Uint8Array;
    totalLength: number;
    error?: string;
  } {
    if (frame.length < 4) {
      return { valid: false, payload: new Uint8Array(0), totalLength: 0, error: "TPKT frame too short (<4 bytes)" };
    }
    if (frame[0] !== 0x03) {
      return { valid: false, payload: new Uint8Array(0), totalLength: 0, error: `Invalid TPKT version 0x${frame[0].toString(16)} (expected 0x03)` };
    }
    const totalLength = (frame[2] << 8) | frame[3];
    if (frame.length < totalLength) {
      return { valid: false, payload: new Uint8Array(0), totalLength, error: `Fragmented TPKT packet (${frame.length} < ${totalLength})` };
    }
    return {
      valid: true,
      payload: frame.subarray(4, totalLength),
      totalLength,
    };
  }

  // --------------------------------------------------------------------------
  // 2. COTP Framing (ISO 8073 / RFC 905 TP0)
  // --------------------------------------------------------------------------

  /**
   * Builds a COTP Connection Request (CR - 0xE0).
   */
  public static buildCotpConnectionRequest(callingTsap: number, calledTsap: number): Uint8Array {
    // COTP CR Header:
    // [0]: Header length (17 bytes)
    // [1]: PDU Type (0xE0 = CR)
    // [2..3]: Destination Ref (0x0000)
    // [4..5]: Source Ref (0x0001)
    // [6]: Class / Options (0x00 = Class 0)
    // [7]: Param Code 0xC0 (TPDU size)
    // [8]: Param Length (0x01)
    // [9]: TPDU Size (0x0A = 1024 bytes)
    // [10]: Param Code 0xC1 (Calling TSAP)
    // [11]: Param Length (0x02)
    // [12..13]: Calling TSAP
    // [14]: Param Code 0xC2 (Called TSAP)
    // [15]: Param Length (0x02)
    // [16..17]: Called TSAP
    const cotp = new Uint8Array(18);
    cotp[0] = 17; // Length of remaining COTP header
    cotp[1] = CotpPduType.CR;
    cotp[2] = 0x00;
    cotp[3] = 0x00;
    cotp[4] = 0x00;
    cotp[5] = 0x01;
    cotp[6] = 0x00;

    // TPDU Size
    cotp[7] = 0xc0;
    cotp[8] = 0x01;
    cotp[9] = 0x0a; // 1024 bytes

    // Calling TSAP
    cotp[10] = 0xc1;
    cotp[11] = 0x02;
    cotp[12] = (callingTsap >> 8) & 0xff;
    cotp[13] = callingTsap & 0xff;

    // Called TSAP
    cotp[14] = 0xc2;
    cotp[15] = 0x02;
    cotp[16] = (calledTsap >> 8) & 0xff;
    cotp[17] = calledTsap & 0xff;

    return this.buildTpktFrame(cotp);
  }

  /**
   * Builds a COTP Connection Confirm (CC - 0xD0).
   */
  public static buildCotpConnectionConfirm(srcRef: number = 0x0001, dstRef: number = 0x0001): Uint8Array {
    const cotp = new Uint8Array(7);
    cotp[0] = 6;
    cotp[1] = CotpPduType.CC;
    cotp[2] = (dstRef >> 8) & 0xff;
    cotp[3] = dstRef & 0xff;
    cotp[4] = (srcRef >> 8) & 0xff;
    cotp[5] = srcRef & 0xff;
    cotp[6] = 0x00; // Class 0
    return this.buildTpktFrame(cotp);
  }

  /**
   * Wraps S7 PDU in COTP Data Transfer (DT - 0xF0) and TPKT.
   */
  public static buildCotpDataFrame(s7Pdu: Uint8Array): Uint8Array {
    // COTP DT header: [0x02 (Length), 0xF0 (PDU Type), 0x80 (TPDU-NR with EOT)]
    const cotp = new Uint8Array(3 + s7Pdu.length);
    cotp[0] = 0x02; // Header length
    cotp[1] = CotpPduType.DT;
    cotp[2] = 0x80; // TPDU-NR and EOT set
    cotp.set(s7Pdu, 3);
    return this.buildTpktFrame(cotp);
  }

  /**
   * Decodes COTP payload from un-TPKT'd buffer.
   */
  public static decodeCotp(payload: Uint8Array): {
    pduType: CotpPduType;
    headerLength: number;
    userData: Uint8Array;
  } {
    if (payload.length < 2) {
      throw new Error("COTP payload too short (<2 bytes)");
    }
    const headerLength = payload[0];
    const pduType = payload[1] as CotpPduType;
    const userData = payload.subarray(headerLength + 1);
    return { pduType, headerLength, userData };
  }

  // --------------------------------------------------------------------------
  // 3. S7 Communication PDU Framing
  // --------------------------------------------------------------------------

  /**
   * Builds S7 Setup Communication Request (Function 0xF0).
   * Negotiates maximum parallel jobs (AMQ) and PDU buffer size.
   */
  public static buildSetupCommunicationPdu(
    pduReference: number,
    maxAmqCaller: number = 8,
    maxAmqCallee: number = 8,
    pduLength: number = 480
  ): Uint8Array {
    // S7 Header (10 bytes) + Setup Comm Parameter (8 bytes) = 18 bytes
    const pdu = new Uint8Array(18);
    const view = new DataView(pdu.buffer, pdu.byteOffset, pdu.byteLength);

    // S7 Header
    pdu[0] = 0x32; // Protocol Id
    pdu[1] = S7Rosctr.JOB;
    view.setUint16(2, 0x0000, false); // Redundancy
    view.setUint16(4, pduReference, false); // PDU Reference
    view.setUint16(6, 0x0008, false); // Parameter Length (8 bytes)
    view.setUint16(8, 0x0000, false); // Data Length (0 bytes)

    // Setup Comm Parameter (8 bytes)
    pdu[10] = S7FunctionCode.SETUP_COMM;
    pdu[11] = 0x00; // Reserved
    view.setUint16(12, maxAmqCaller, false);
    view.setUint16(14, maxAmqCallee, false);
    view.setUint16(16, pduLength, false);

    return pdu;
  }

  /**
   * Builds S7 Setup Communication Response (Ack_Data).
   */
  public static buildSetupCommunicationAck(
    pduReference: number,
    maxAmqCaller: number = 8,
    maxAmqCallee: number = 8,
    pduLength: number = 480
  ): Uint8Array {
    // Header (12 bytes for Ack_Data) + Parameter (8 bytes) = 20 bytes
    const pdu = new Uint8Array(20);
    const view = new DataView(pdu.buffer, pdu.byteOffset, pdu.byteLength);

    pdu[0] = 0x32;
    pdu[1] = S7Rosctr.ACK_DATA;
    view.setUint16(2, 0x0000, false);
    view.setUint16(4, pduReference, false);
    view.setUint16(6, 0x0008, false); // Parameter length
    view.setUint16(8, 0x0000, false); // Data length
    pdu[10] = 0x00; // Error Class (0 = no error)
    pdu[11] = 0x00; // Error Code

    // Setup Comm Ack Parameter
    pdu[12] = S7FunctionCode.SETUP_COMM;
    pdu[13] = 0x00;
    view.setUint16(14, maxAmqCaller, false);
    view.setUint16(16, maxAmqCallee, false);
    view.setUint16(18, pduLength, false);

    return pdu;
  }

  /**
   * Builds S7 Read Variable Request (Function 0x04).
   */
  public static buildReadVarPdu(pduReference: number, items: S7ReadItem[]): Uint8Array {
    // Header: 10 bytes
    // Parameter: 2 bytes (FC 0x04 + Item Count) + 12 bytes per item
    const paramLength = 2 + (items.length * 12);
    const pdu = new Uint8Array(10 + paramLength);
    const view = new DataView(pdu.buffer, pdu.byteOffset, pdu.byteLength);

    // S7 Header
    pdu[0] = 0x32;
    pdu[1] = S7Rosctr.JOB;
    view.setUint16(2, 0x0000, false);
    view.setUint16(4, pduReference, false);
    view.setUint16(6, paramLength, false);
    view.setUint16(8, 0x0000, false); // Data Length = 0

    // Parameter
    pdu[10] = S7FunctionCode.READ_VAR;
    pdu[11] = items.length;

    let offset = 12;
    for (const item of items) {
      pdu[offset] = 0x12; // Variable specification
      pdu[offset + 1] = 0x0a; // Length of remaining address specification
      pdu[offset + 2] = 0x10; // Syntax ID: S7Any (standard addressing)
      pdu[offset + 3] = item.transportSize;
      view.setUint16(offset + 4, item.count, false); // Length / Word Count
      view.setUint16(offset + 6, item.dbNumber || 0, false);
      pdu[offset + 8] = item.areaCode;

      // 3-byte address offset: (byteOffset * 8) + (bitOffset || 0)
      const bitAddr = (item.byteOffset * 8) + (item.bitOffset || 0);
      pdu[offset + 9] = (bitAddr >> 16) & 0xff;
      pdu[offset + 10] = (bitAddr >> 8) & 0xff;
      pdu[offset + 11] = bitAddr & 0xff;

      offset += 12;
    }

    return pdu;
  }

  /**
   * Builds S7 Write Variable Request (Function 0x05).
   */
  public static buildWriteVarPdu(pduReference: number, items: S7WriteItem[]): Uint8Array {
    const paramLength = 2 + (items.length * 12);
    let dataLength = 0;

    for (const item of items) {
      // 4 bytes header (Return Code, Transport Size, Length in bits) + data bytes (+ pad byte if odd)
      const itemLen = 4 + item.data.length + (item.data.length % 2 !== 0 ? 1 : 0);
      dataLength += itemLen;
    }

    const pdu = new Uint8Array(10 + paramLength + dataLength);
    const view = new DataView(pdu.buffer, pdu.byteOffset, pdu.byteLength);

    // S7 Header
    pdu[0] = 0x32;
    pdu[1] = S7Rosctr.JOB;
    view.setUint16(2, 0x0000, false);
    view.setUint16(4, pduReference, false);
    view.setUint16(6, paramLength, false);
    view.setUint16(8, dataLength, false);

    // Parameter
    pdu[10] = S7FunctionCode.WRITE_VAR;
    pdu[11] = items.length;

    let pOffset = 12;
    for (const item of items) {
      pdu[pOffset] = 0x12;
      pdu[pOffset + 1] = 0x0a;
      pdu[pOffset + 2] = 0x10;
      pdu[pOffset + 3] = item.transportSize;
      view.setUint16(pOffset + 4, item.count, false);
      view.setUint16(pOffset + 6, item.dbNumber || 0, false);
      pdu[pOffset + 8] = item.areaCode;

      const bitAddr = (item.byteOffset * 8) + (item.bitOffset || 0);
      pdu[pOffset + 9] = (bitAddr >> 16) & 0xff;
      pdu[pOffset + 10] = (bitAddr >> 8) & 0xff;
      pdu[pOffset + 11] = bitAddr & 0xff;

      pOffset += 12;
    }

    // Data section
    let dOffset = 10 + paramLength;
    for (const item of items) {
      pdu[dOffset] = 0x00; // Return Code (Reserved in request)
      
      const isBit = item.transportSize === S7TransportSize.BIT;
      pdu[dOffset + 1] = isBit ? S7DataTransportSize.BIT : S7DataTransportSize.BYTE_WORD_DWORD;

      // Length in bits (for bit or byte data in S7 Comm)
      const lengthBits = isBit ? item.data.length : item.data.length * 8;
      view.setUint16(dOffset + 2, lengthBits, false);

      pdu.set(item.data, dOffset + 4);
      dOffset += 4 + item.data.length;

      // Add pad byte if length is odd to align to 16-bit word
      if (item.data.length % 2 !== 0) {
        pdu[dOffset] = 0x00;
        dOffset += 1;
      }
    }

    return pdu;
  }

  /**
   * Decodes S7 PDU and extracts header information.
   */
  public static decodeS7Pdu(pdu: Uint8Array): {
    protocolId: number;
    rosctr: S7Rosctr;
    pduReference: number;
    paramLength: number;
    dataLength: number;
    errorClass: number;
    errorCode: number;
    paramData: Uint8Array;
    data: Uint8Array;
  } {
    if (pdu.length < 10) {
      throw new Error(`S7 PDU too short (${pdu.length} < 10 bytes)`);
    }
    const view = new DataView(pdu.buffer, pdu.byteOffset, pdu.byteLength);
    const protocolId = pdu[0];
    const rosctr = pdu[1] as S7Rosctr;
    const pduReference = view.getUint16(4, false);
    const paramLength = view.getUint16(6, false);
    const dataLength = view.getUint16(8, false);

    let errorClass = 0;
    let errorCode = 0;
    let headerOffset = 10;

    if (rosctr === S7Rosctr.ACK_DATA || rosctr === S7Rosctr.ACK) {
      if (pdu.length < 12) {
        throw new Error(`S7 Ack PDU too short (${pdu.length} < 12 bytes)`);
      }
      errorClass = pdu[10];
      errorCode = pdu[11];
      headerOffset = 12;
    }

    const paramEnd = headerOffset + paramLength;
    const paramData = pdu.subarray(headerOffset, paramEnd);
    const data = pdu.subarray(paramEnd, paramEnd + dataLength);

    return {
      protocolId,
      rosctr,
      pduReference,
      paramLength,
      dataLength,
      errorClass,
      errorCode,
      paramData,
      data,
    };
  }

  /**
   * Decodes S7 Read Variable response (Ack_Data).
   */
  public static decodeReadVarResponse(pdu: Uint8Array): S7ReadResponseItem[] {
    const decoded = this.decodeS7Pdu(pdu);
    if (decoded.errorClass !== 0 || decoded.errorCode !== 0) {
      throw new Error(`S7 CPU Error: Class 0x${decoded.errorClass.toString(16)}, Code 0x${decoded.errorCode.toString(16)}`);
    }

    const { paramData, data } = decoded;
    if (paramData.length < 2) {
      throw new Error("Invalid S7 Read Var parameter length");
    }
    const functionCode = paramData[0];
    if (functionCode !== S7FunctionCode.READ_VAR) {
      throw new Error(`Expected Read Var function 0x04, got 0x${functionCode.toString(16)}`);
    }
    const itemCount = paramData[1];

    const results: S7ReadResponseItem[] = [];
    let offset = 0;
    const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

    for (let i = 0; i < itemCount; i++) {
      if (offset + 4 > data.length) {
        throw new Error("Truncated S7 Read Var data item");
      }
      const returnCode = data[offset];
      const transportSize = data[offset + 1];
      let lengthInBitsOrBytes = dataView.getUint16(offset + 2, false);

      let byteCount = lengthInBitsOrBytes;
      if (transportSize === S7DataTransportSize.BIT) {
        byteCount = Math.ceil(lengthInBitsOrBytes / 8);
      } else if (transportSize === S7DataTransportSize.BYTE_WORD_DWORD || transportSize === S7DataTransportSize.INTEGER || transportSize === S7DataTransportSize.REAL) {
        byteCount = Math.floor(lengthInBitsOrBytes / 8);
      }

      const itemPayload = data.subarray(offset + 4, offset + 4 + byteCount);
      results.push({
        returnCode,
        transportSize,
        dataLengthBytes: byteCount,
        data: new Uint8Array(itemPayload),
      });

      offset += 4 + byteCount;
      if (byteCount % 2 !== 0 && offset < data.length) {
        offset += 1; // Skip pad byte
      }
    }

    return results;
  }

  /**
   * Decodes S7 Write Variable response (Ack_Data).
   */
  public static decodeWriteVarResponse(pdu: Uint8Array): number[] {
    const decoded = this.decodeS7Pdu(pdu);
    if (decoded.errorClass !== 0 || decoded.errorCode !== 0) {
      throw new Error(`S7 CPU Error on Write: Class 0x${decoded.errorClass.toString(16)}, Code 0x${decoded.errorCode.toString(16)}`);
    }

    const { paramData, data } = decoded;
    if (paramData.length < 2) {
      throw new Error("Invalid S7 Write Var parameter length");
    }
    const itemCount = paramData[1];
    const returnCodes: number[] = [];

    for (let i = 0; i < itemCount; i++) {
      if (i < data.length) {
        returnCodes.push(data[i]);
      } else {
        returnCodes.push(S7ReturnCode.RESERVED);
      }
    }

    return returnCodes;
  }

  // --------------------------------------------------------------------------
  // 4. Data Conversion Utilities (Big-Endian S7 Formats)
  // --------------------------------------------------------------------------

  /**
   * Decodes raw bytes from S7 PLC into JavaScript numeric or boolean value.
   */
  public static decodeBytesToValue(bytes: Uint8Array, dataType: S7DataType, bitOffset: number = 0): number | boolean {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    switch (dataType) {
      case "BOOL": {
        const byte = bytes[0] || 0;
        return ((byte >> (bitOffset % 8)) & 0x01) === 1;
      }
      case "BYTE":
        return bytes[0] || 0;
      case "WORD":
        return view.getUint16(0, false); // Big-Endian
      case "INT":
        return view.getInt16(0, false);  // Big-Endian
      case "DWORD":
        return view.getUint32(0, false); // Big-Endian
      case "DINT":
        return view.getInt32(0, false);  // Big-Endian
      case "REAL": {
        const val = view.getFloat32(0, false); // Big-Endian IEEE 754
        return Number(val.toFixed(4));
      }
      default:
        return view.getUint16(0, false);
    }
  }

  /**
   * Encodes a value into raw bytes ready for S7 Write Var.
   */
  public static encodeValueToBytes(value: number | boolean, dataType: S7DataType, bitOffset: number = 0): Uint8Array {
    switch (dataType) {
      case "BOOL": {
        const out = new Uint8Array(1);
        if (value) {
          out[0] = 1 << (bitOffset % 8);
        }
        return out;
      }
      case "BYTE": {
        const out = new Uint8Array(1);
        out[0] = Number(value) & 0xff;
        return out;
      }
      case "WORD": {
        const out = new Uint8Array(2);
        const view = new DataView(out.buffer);
        view.setUint16(0, Number(value) & 0xffff, false);
        return out;
      }
      case "INT": {
        const out = new Uint8Array(2);
        const view = new DataView(out.buffer);
        view.setInt16(0, Number(value), false);
        return out;
      }
      case "DWORD": {
        const out = new Uint8Array(4);
        const view = new DataView(out.buffer);
        view.setUint32(0, Number(value) >>> 0, false);
        return out;
      }
      case "DINT": {
        const out = new Uint8Array(4);
        const view = new DataView(out.buffer);
        view.setInt32(0, Number(value), false);
        return out;
      }
      case "REAL": {
        const out = new Uint8Array(4);
        const view = new DataView(out.buffer);
        view.setFloat32(0, Number(value), false);
        return out;
      }
      default: {
        const out = new Uint8Array(2);
        const view = new DataView(out.buffer);
        view.setUint16(0, Number(value), false);
        return out;
      }
    }
  }
}
