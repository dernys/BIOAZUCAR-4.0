/**
 * BioAzúcar 4.0 — Modbus Protocol Types & Canonical Specifications
 * 
 * Complies with Modbus Application Protocol Specification V1.1b3 and Modbus Security 2018.
 * Decoupled Layer 2 protocol representation for industrial edge connectivity.
 */

export type ModbusByteOrder = "ABCD" | "CDAB" | "BADC" | "DCBA";

export type ModbusRegisterType = 
  | "COIL" 
  | "DISCRETE_INPUT" 
  | "INPUT_REGISTER" 
  | "HOLDING_REGISTER";

export type ModbusDataType = 
  | "BOOL" 
  | "INT16" 
  | "UINT16" 
  | "INT32" 
  | "UINT32" 
  | "FLOAT32";

export enum ModbusFunctionCode {
  READ_COILS = 0x01,
  READ_DISCRETE_INPUTS = 0x02,
  READ_HOLDING_REGISTERS = 0x03,
  READ_INPUT_REGISTERS = 0x04,
  WRITE_SINGLE_COIL = 0x05,
  WRITE_SINGLE_REGISTER = 0x06,
  WRITE_MULTIPLE_COILS = 0x0F,
  WRITE_MULTIPLE_REGISTERS = 0x10,
}

export enum ModbusExceptionCode {
  ILLEGAL_FUNCTION = 0x01,
  ILLEGAL_DATA_ADDRESS = 0x02,
  ILLEGAL_DATA_VALUE = 0x03,
  SLAVE_DEVICE_FAILURE = 0x04,
  ACKNOWLEDGE = 0x05,
  SLAVE_DEVICE_BUSY = 0x06,
  NEGATIVE_ACKNOWLEDGE = 0x07,
  MEMORY_PARITY_ERROR = 0x08,
  GATEWAY_PATH_UNAVAILABLE = 0x0A,
  GATEWAY_TARGET_DEVICE_FAILED_TO_RESPOND = 0x0B,
}

export interface ModbusParsedAddress {
  unitId: number;
  table: ModbusRegisterType;
  address: number; // 0-indexed PDU address (0..65535)
  dataType: ModbusDataType;
  byteOrder: ModbusByteOrder;
  wordCount: number; // 1 for 16-bit, 2 for 32-bit, 1 for bit
  isSymbolicTag?: boolean;
  symbolicTag?: string;
}

export interface ModbusTcpResponse {
  transactionId: number;
  protocolId: number;
  length: number;
  unitId: number;
  functionCode: number;
  isException: boolean;
  exceptionCode?: ModbusExceptionCode;
  data: Uint8Array;
}

export interface ModbusRtuResponse {
  unitId: number;
  functionCode: number;
  isException: boolean;
  exceptionCode?: ModbusExceptionCode;
  data: Uint8Array;
  crcValid: boolean;
}

/**
 * Parses standard industrial Modbus tags into canonical addresses.
 * 
 * Supports:
 * - 5-digit Modbus: "40001" (HR 0), "30001" (IR 0), "10001" (DI 0), "00001" (Coil 0)
 * - 6-digit Modbus: "400001", "300001", "100001", "000001"
 * - Prefix syntax: "HR:100", "IR:50", "C:10", "DI:5"
 * - Dot unit prefix: "1.40001", "2.HR:100"
 * - Data type and endianness suffix: "40001:FLOAT32:CDAB", "HR:100:INT32"
 */
export function parseModbusAddress(
  rawTag: string, 
  defaultUnitId: number = 1,
  defaultByteOrder: ModbusByteOrder = "ABCD"
): ModbusParsedAddress {
  let tag = rawTag.trim();
  let unitId = defaultUnitId;
  let byteOrder = defaultByteOrder;
  let explicitDataType: ModbusDataType | null = null;

  // Check for unit ID prefix: "1.40001" or "unit:1/40001"
  if (/^\d+\./.test(tag)) {
    const parts = tag.split(".");
    unitId = parseInt(parts[0], 10);
    tag = parts.slice(1).join(".");
  } else if (/^unit:\d+\//i.test(tag)) {
    const match = tag.match(/^unit:(\d+)\/(.*)$/i);
    if (match) {
      unitId = parseInt(match[1], 10);
      tag = match[2];
    }
  }

  // Check for suffixes: ":FLOAT32", ":INT32", ":CDAB"
  const tokens = tag.split(":");
  let mainAddressStr = tokens[0];

  for (let i = 1; i < tokens.length; i++) {
    const tokenUpper = tokens[i].toUpperCase();
    if (["ABCD", "CDAB", "BADC", "DCBA"].includes(tokenUpper)) {
      byteOrder = tokenUpper as ModbusByteOrder;
    } else if (["BOOL", "INT16", "UINT16", "INT32", "UINT32", "FLOAT32"].includes(tokenUpper)) {
      explicitDataType = tokenUpper as ModbusDataType;
    } else if (["HR", "IR", "C", "DI"].includes(mainAddressStr.toUpperCase())) {
      // e.g. "HR:100"
      mainAddressStr = `${mainAddressStr}:${tokens[i]}`;
    }
  }

  // Check prefix syntax: "HR:100", "IR:50", "C:10", "DI:5"
  const prefixMatch = mainAddressStr.match(/^(HR|IR|C|DI):?(\d+)$/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    const addr = parseInt(prefixMatch[2], 10);
    let table: ModbusRegisterType = "HOLDING_REGISTER";
    let defaultType: ModbusDataType = "UINT16";

    switch (prefix) {
      case "HR":
        table = "HOLDING_REGISTER";
        defaultType = "UINT16";
        break;
      case "IR":
        table = "INPUT_REGISTER";
        defaultType = "UINT16";
        break;
      case "C":
        table = "COIL";
        defaultType = "BOOL";
        break;
      case "DI":
        table = "DISCRETE_INPUT";
        defaultType = "BOOL";
        break;
    }

    const dataType = explicitDataType || defaultType;
    const wordCount = (dataType === "FLOAT32" || dataType === "INT32" || dataType === "UINT32") ? 2 : 1;

    return {
      unitId,
      table,
      address: addr,
      dataType,
      byteOrder,
      wordCount,
    };
  }

  // Pure numeric tag: check standard Modbus ranges
  if (!/^\d+$/.test(mainAddressStr)) {
    // Named or ISA-95 symbolic tag: e.g. "IngenioCentral.Molienda.Molino1.PresionHidraulica"
    return {
      unitId,
      table: "HOLDING_REGISTER",
      address: 0,
      dataType: explicitDataType || "FLOAT32",
      byteOrder,
      wordCount: (explicitDataType === "FLOAT32" || !explicitDataType) ? 2 : 1,
      isSymbolicTag: true,
      symbolicTag: rawTag,
    };
  }

  const num = parseInt(mainAddressStr, 10);

  // 6-digit addressing
  if (mainAddressStr.length >= 6) {
    if (num >= 400001 && num <= 465536) {
      const dt = explicitDataType || "UINT16";
      return {
        unitId,
        table: "HOLDING_REGISTER",
        address: num - 400001,
        dataType: dt,
        byteOrder,
        wordCount: (dt === "FLOAT32" || dt === "INT32" || dt === "UINT32") ? 2 : 1,
      };
    }
    if (num >= 300001 && num <= 365536) {
      const dt = explicitDataType || "UINT16";
      return {
        unitId,
        table: "INPUT_REGISTER",
        address: num - 300001,
        dataType: dt,
        byteOrder,
        wordCount: (dt === "FLOAT32" || dt === "INT32" || dt === "UINT32") ? 2 : 1,
      };
    }
    if (num >= 100001 && num <= 165536) {
      return {
        unitId,
        table: "DISCRETE_INPUT",
        address: num - 100001,
        dataType: "BOOL",
        byteOrder,
        wordCount: 1,
      };
    }
    if (num >= 1 && num <= 65536) {
      return {
        unitId,
        table: "COIL",
        address: num - 1,
        dataType: "BOOL",
        byteOrder,
        wordCount: 1,
      };
    }
  }

  // 5-digit addressing (Classic)
  if (num >= 40001 && num <= 49999) {
    const dt = explicitDataType || "UINT16";
    return {
      unitId,
      table: "HOLDING_REGISTER",
      address: num - 40001,
      dataType: dt,
      byteOrder,
      wordCount: (dt === "FLOAT32" || dt === "INT32" || dt === "UINT32") ? 2 : 1,
    };
  }
  if (num >= 30001 && num <= 39999) {
    const dt = explicitDataType || "UINT16";
    return {
      unitId,
      table: "INPUT_REGISTER",
      address: num - 30001,
      dataType: dt,
      byteOrder,
      wordCount: (dt === "FLOAT32" || dt === "INT32" || dt === "UINT32") ? 2 : 1,
    };
  }
  if (num >= 10001 && num <= 19999) {
    return {
      unitId,
      table: "DISCRETE_INPUT",
      address: num - 10001,
      dataType: "BOOL",
      byteOrder,
      wordCount: 1,
    };
  }
  if (num >= 1 && num <= 9999) {
    return {
      unitId,
      table: "COIL",
      address: num - 1,
      dataType: "BOOL",
      byteOrder,
      wordCount: 1,
    };
  }

  // Offset 0 default
  const dt = explicitDataType || "UINT16";
  return {
    unitId,
    table: "HOLDING_REGISTER",
    address: num,
    dataType: dt,
    byteOrder,
    wordCount: (dt === "FLOAT32" || dt === "INT32" || dt === "UINT32") ? 2 : 1,
  };
}

/**
 * Translates Modbus Exception Code to human-readable description.
 */
export function getModbusExceptionDescription(code: ModbusExceptionCode): string {
  switch (code) {
    case ModbusExceptionCode.ILLEGAL_FUNCTION:
      return "0x01: Illegal Function — Function code not supported by slave";
    case ModbusExceptionCode.ILLEGAL_DATA_ADDRESS:
      return "0x02: Illegal Data Address — Register address outside slave range";
    case ModbusExceptionCode.ILLEGAL_DATA_VALUE:
      return "0x03: Illegal Data Value — Value or register quantity not permitted";
    case ModbusExceptionCode.SLAVE_DEVICE_FAILURE:
      return "0x04: Slave Device Failure — Unrecoverable error occurred in slave";
    case ModbusExceptionCode.ACKNOWLEDGE:
      return "0x05: Acknowledge — Specialized long operation accepted";
    case ModbusExceptionCode.SLAVE_DEVICE_BUSY:
      return "0x06: Slave Device Busy — Slave currently executing long command";
    case ModbusExceptionCode.NEGATIVE_ACKNOWLEDGE:
      return "0x07: Negative Acknowledge — Slave cannot perform programming query";
    case ModbusExceptionCode.MEMORY_PARITY_ERROR:
      return "0x08: Memory Parity Error — Extended memory read failed parity check";
    case ModbusExceptionCode.GATEWAY_PATH_UNAVAILABLE:
      return "0x0A: Gateway Path Unavailable — Modbus gateway path misconfigured";
    case ModbusExceptionCode.GATEWAY_TARGET_DEVICE_FAILED_TO_RESPOND:
      return "0x0B: Gateway Target Device Failed To Respond — Target slave timed out";
    default:
      return `Unknown Modbus Exception 0x${(code as any).toString(16)}`;
  }
}
