/**
 * BioAzúcar 4.0 — Siemens S7 Protocol Types & Address Specifications
 * 
 * Defines canonical data types, area codes, transport sizes, COTP PDU types,
 * S7 Comm function codes, return codes, and address parser according to
 * ISO-on-TCP (RFC 1006), COTP (ISO 8073 / RFC 905), and Siemens S7 Comm specification.
 */

export type S7AreaType =
  | "DB"        // Data Block (0x84)
  | "INPUTS"    // Process Inputs PE / I (0x81)
  | "OUTPUTS"   // Process Outputs PA / Q (0x82)
  | "FLAGS"     // Merkers / Flags M (0x83)
  | "TIMERS"    // Timers TM / T (0x1C)
  | "COUNTERS"; // Counters CT / C (0x1D)

export type S7DataType =
  | "BOOL"
  | "BYTE"
  | "WORD"
  | "DWORD"
  | "INT"
  | "DINT"
  | "REAL";

export enum S7AreaCode {
  SYSTEM_INFO = 0x03,
  SYSTEM_FLAGS = 0x05,
  ANALOG_INPUTS = 0x06,
  ANALOG_OUTPUTS = 0x07,
  TIMERS = 0x1C,
  COUNTERS = 0x1D,
  INPUTS = 0x81,  // Process image inputs (PE / I)
  OUTPUTS = 0x82, // Process image outputs (PA / Q)
  FLAGS = 0x83,   // Bit memory / Flags (M)
  DB = 0x84,      // Data block (DB)
  DI = 0x85,      // Instance data block (DI)
  LOCAL_VARS = 0x86, // Local variables
  VARS = 0x87,    // Previous local variables
}

export enum S7TransportSize {
  BIT = 0x01,       // Bit
  BYTE = 0x02,      // Byte (8 bit)
  WORD = 0x04,      // Word (16 bit)
  DWORD = 0x06,     // Double Word (32 bit)
  REAL = 0x08,      // IEEE 754 Float32 (32 bit)
  OCTET_STRING = 0x09,
}

export enum S7DataTransportSize {
  NULL = 0x00,
  BIT = 0x03,
  BYTE_WORD_DWORD = 0x04,
  INTEGER = 0x05,
  REAL = 0x07,
  OCTET_STRING = 0x09,
}

export enum S7Rosctr {
  JOB = 0x01,       // Request from client
  ACK = 0x02,       // Simple acknowledge without data
  ACK_DATA = 0x03,  // Response from server with data
  USERDATA = 0x07,  // Extended functions
}

export enum S7FunctionCode {
  READ_VAR = 0x04,
  WRITE_VAR = 0x05,
  SETUP_COMM = 0xF0,
}

export enum S7ReturnCode {
  SUCCESS = 0xFF,
  RESERVED = 0x00,
  HW_FAULT = 0x01,
  ACCESS_DENIED = 0x03,
  ADDRESS_OUT_OF_RANGE = 0x05,
  DATA_TYPE_NOT_SUPPORTED = 0x06,
  DATA_TYPE_INCONSISTENT = 0x07,
  OBJECT_DOES_NOT_EXIST = 0x0A,
}

export enum CotpPduType {
  CR = 0xE0, // Connection Request
  CC = 0xD0, // Connection Confirm
  DR = 0x80, // Disconnect Request
  DC = 0xC0, // Disconnect Confirm
  DT = 0xF0, // Data Transfer
  ED = 0x10, // Expedit Data
  RJ = 0x50, // Reject
  ER = 0x70, // Error
}

export interface S7ParsedAddress {
  area: S7AreaType;
  areaCode: S7AreaCode;
  dbNumber?: number;
  dataType: S7DataType;
  transportSize: S7TransportSize;
  byteOffset: number;
  bitOffset?: number;
  lengthBytes: number;
  isSymbolicTag?: boolean;
  symbolicTag?: string;
}

export interface S7ConnectionParameters {
  rack: number;
  slot: number;
  connectionType?: number; // 0x01 PG, 0x02 OP, 0x03 Basic (default)
  pduSize?: number;        // Negotiated PDU length (default: 480)
  maxAmqCaller?: number;   // Max AMQ caller (default: 8)
  maxAmqCallee?: number;   // Max AMQ callee (default: 8)
}

/**
 * Calculates Calling and Called TSAP for RFC 1006 COTP connection.
 * Siemens S7 TSAP format:
 * - Calling TSAP (Local): 0x0100 (or 0x0200 / 0x0300)
 * - Called TSAP (Remote): [ConnectionType (1 byte)][(Rack << 5) | Slot (1 byte)]
 *   e.g. S7-1200 / S7-1500 (Rack 0, Slot 1): 0x0101
 *   e.g. S7-300 / S7-400 (Rack 0, Slot 2):   0x0102
 */
export function computeS7Tsap(rack: number = 0, slot: number = 1, connectionType: number = 0x03): {
  callingTsap: number;
  calledTsap: number;
} {
  const callingTsap = 0x0100;
  const calledTsap = ((connectionType & 0xff) << 8) | (((rack & 0x07) << 5) | (slot & 0x1f));
  return { callingTsap, calledTsap };
}

/**
 * Parses canonical Siemens S7 tag addresses.
 * Supported syntaxes:
 *  - DB<num>.DB<X|B|W|D><offset>[.<bit>] (e.g. DB1.DBD0, DB10.DBW4, DB2.DBX0.1)
 *  - I<B|W|D><offset> or I<offset>.<bit> (e.g. IW0, I0.0)
 *  - Q<B|W|D><offset> or Q<offset>.<bit> (e.g. QW0, Q0.0)
 *  - M<B|W|D><offset> or M<offset>.<bit> (e.g. MW10, M0.0, MD20)
 *  - T<offset> (Timers, e.g. T1)
 *  - C<offset> (Counters, e.g. C1)
 *  - Symbolic / Named tag (e.g. IngenioCentral.Molienda.Molino1.Presion)
 */
export function parseS7Address(rawAddress: string): S7ParsedAddress {
  const trimmed = rawAddress.trim().toUpperCase();

  // 1. Data Block syntax: DB<n>.DB<X|B|W|D><offset>[.<bit>]
  const dbMatch = trimmed.match(/^DB(\d+)\.DB([XBWDbxwd])(\d+)(?:\.(\d+))?$/);
  if (dbMatch) {
    const dbNumber = parseInt(dbMatch[1], 10);
    const code = dbMatch[2];
    const byteOffset = parseInt(dbMatch[3], 10);
    const bitOffset = dbMatch[4] !== undefined ? parseInt(dbMatch[4], 10) : undefined;

    let dataType: S7DataType = "WORD";
    let transportSize: S7TransportSize = S7TransportSize.WORD;
    let lengthBytes = 2;

    if (code === "X") {
      dataType = "BOOL";
      transportSize = S7TransportSize.BIT;
      lengthBytes = 1;
    } else if (code === "B") {
      dataType = "BYTE";
      transportSize = S7TransportSize.BYTE;
      lengthBytes = 1;
    } else if (code === "W") {
      dataType = "WORD";
      transportSize = S7TransportSize.WORD;
      lengthBytes = 2;
    } else if (code === "D") {
      dataType = "REAL"; // Default to REAL for floating process variables in sugar/co-gen plants
      transportSize = S7TransportSize.REAL;
      lengthBytes = 4;
    }

    return {
      area: "DB",
      areaCode: S7AreaCode.DB,
      dbNumber,
      dataType,
      transportSize,
      byteOffset,
      bitOffset,
      lengthBytes,
    };
  }

  // 2. Inputs: I<B|W|D><offset> or I<offset>.<bit>
  const inputMatch = trimmed.match(/^I(?:([BWDbwd])(\d+)|(\d+)\.(\d+))$/);
  if (inputMatch) {
    if (inputMatch[1]) {
      const code = inputMatch[1];
      const byteOffset = parseInt(inputMatch[2], 10);
      const dataType: S7DataType = code === "B" ? "BYTE" : code === "W" ? "WORD" : "DWORD";
      const transportSize = code === "B" ? S7TransportSize.BYTE : code === "W" ? S7TransportSize.WORD : S7TransportSize.DWORD;
      const lengthBytes = code === "B" ? 1 : code === "W" ? 2 : 4;
      return { area: "INPUTS", areaCode: S7AreaCode.INPUTS, dataType, transportSize, byteOffset, lengthBytes };
    } else {
      return {
        area: "INPUTS",
        areaCode: S7AreaCode.INPUTS,
        dataType: "BOOL",
        transportSize: S7TransportSize.BIT,
        byteOffset: parseInt(inputMatch[3], 10),
        bitOffset: parseInt(inputMatch[4], 10),
        lengthBytes: 1,
      };
    }
  }

  // 3. Outputs: Q<B|W|D><offset> or Q<offset>.<bit>
  const outputMatch = trimmed.match(/^Q(?:([BWDbwd])(\d+)|(\d+)\.(\d+))$/);
  if (outputMatch) {
    if (outputMatch[1]) {
      const code = outputMatch[1];
      const byteOffset = parseInt(outputMatch[2], 10);
      const dataType: S7DataType = code === "B" ? "BYTE" : code === "W" ? "WORD" : "DWORD";
      const transportSize = code === "B" ? S7TransportSize.BYTE : code === "W" ? S7TransportSize.WORD : S7TransportSize.DWORD;
      const lengthBytes = code === "B" ? 1 : code === "W" ? 2 : 4;
      return { area: "OUTPUTS", areaCode: S7AreaCode.OUTPUTS, dataType, transportSize, byteOffset, lengthBytes };
    } else {
      return {
        area: "OUTPUTS",
        areaCode: S7AreaCode.OUTPUTS,
        dataType: "BOOL",
        transportSize: S7TransportSize.BIT,
        byteOffset: parseInt(outputMatch[3], 10),
        bitOffset: parseInt(outputMatch[4], 10),
        lengthBytes: 1,
      };
    }
  }

  // 4. Flags / Merkers: M<B|W|D><offset> or M<offset>.<bit>
  const flagMatch = trimmed.match(/^M(?:([BWDbwd])(\d+)|(\d+)\.(\d+))$/);
  if (flagMatch) {
    if (flagMatch[1]) {
      const code = flagMatch[1];
      const byteOffset = parseInt(flagMatch[2], 10);
      const dataType: S7DataType = code === "B" ? "BYTE" : code === "W" ? "WORD" : "DWORD";
      const transportSize = code === "B" ? S7TransportSize.BYTE : code === "W" ? S7TransportSize.WORD : S7TransportSize.DWORD;
      const lengthBytes = code === "B" ? 1 : code === "W" ? 2 : 4;
      return { area: "FLAGS", areaCode: S7AreaCode.FLAGS, dataType, transportSize, byteOffset, lengthBytes };
    } else {
      return {
        area: "FLAGS",
        areaCode: S7AreaCode.FLAGS,
        dataType: "BOOL",
        transportSize: S7TransportSize.BIT,
        byteOffset: parseInt(flagMatch[3], 10),
        bitOffset: parseInt(flagMatch[4], 10),
        lengthBytes: 1,
      };
    }
  }

  // 5. Timers: T<offset>
  const timerMatch = trimmed.match(/^T(\d+)$/);
  if (timerMatch) {
    return {
      area: "TIMERS",
      areaCode: S7AreaCode.TIMERS,
      dataType: "WORD",
      transportSize: S7TransportSize.WORD,
      byteOffset: parseInt(timerMatch[1], 10),
      lengthBytes: 2,
    };
  }

  // 6. Counters: C<offset>
  const counterMatch = trimmed.match(/^C(\d+)$/);
  if (counterMatch) {
    return {
      area: "COUNTERS",
      areaCode: S7AreaCode.COUNTERS,
      dataType: "WORD",
      transportSize: S7TransportSize.WORD,
      byteOffset: parseInt(counterMatch[1], 10),
      lengthBytes: 2,
    };
  }

  // 7. Symbolic / ISA-95 named tag fallback
  return {
    area: "DB",
    areaCode: S7AreaCode.DB,
    dbNumber: 1,
    dataType: "REAL",
    transportSize: S7TransportSize.REAL,
    byteOffset: 0,
    lengthBytes: 4,
    isSymbolicTag: true,
    symbolicTag: rawAddress,
  };
}

/**
 * Returns human-readable error descriptions for S7 Return Codes.
 */
export function getS7ReturnCodeDescription(code: number): string {
  switch (code) {
    case S7ReturnCode.SUCCESS:
      return "0xFF: Success — Item read or written successfully";
    case S7ReturnCode.HW_FAULT:
      return "0x01: Hardware Fault — CPU hardware error";
    case S7ReturnCode.ACCESS_DENIED:
      return "0x03: Access Denied — Object write-protected or read-only";
    case S7ReturnCode.ADDRESS_OUT_OF_RANGE:
      return "0x05: Address Out Of Range — DB or offset exceeds configured memory block";
    case S7ReturnCode.DATA_TYPE_NOT_SUPPORTED:
      return "0x06: Data Type Not Supported";
    case S7ReturnCode.DATA_TYPE_INCONSISTENT:
      return "0x07: Data Type Inconsistent with requested item length";
    case S7ReturnCode.OBJECT_DOES_NOT_EXIST:
      return "0x0A: Object Does Not Exist — Data Block (DB) not loaded in PLC";
    default:
      return `Unknown S7 Return Code 0x${code.toString(16).toUpperCase()}`;
  }
}
