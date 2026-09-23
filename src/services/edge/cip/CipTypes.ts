/**
 * BioAzúcar 4.0 — Rockwell EtherNet/IP & CIP Protocol Stack Types
 * 
 * Formal definitions for CIP (Common Industrial Protocol) and EtherNet/IP encapsulation
 * over TCP port 44818 according to ODVA specifications:
 * - Volume 1: Common Industrial Protocol (CIP™)
 * - Volume 2: EtherNet/IP™ Adaptation of CIP
 */

/**
 * EtherNet/IP Encapsulation Command Codes
 */
export enum EipCommand {
  NOP = 0x0000,
  LIST_SERVICES = 0x0004,
  LIST_IDENTITY = 0x0063,
  LIST_INTERFACES = 0x0064,
  REGISTER_SESSION = 0x0065,
  UNREGISTER_SESSION = 0x0066,
  SEND_RR_DATA = 0x006f,
  SEND_UNIT_DATA = 0x0070,
}

/**
 * EtherNet/IP Encapsulation Header Status Codes
 */
export enum EipStatus {
  SUCCESS = 0x00000000,
  INVALID_COMMAND = 0x00000001,
  INSUFFICIENT_MEMORY = 0x00000002,
  MALFORMED_DATA = 0x00000003,
  INVALID_SESSION_HANDLE = 0x00000065,
  INVALID_LENGTH = 0x00000069,
  PROTOCOL_UNSUPPORTED = 0x0000006d,
}

/**
 * Common Packet Format (CPF) Item Type IDs
 */
export enum CpfTypeId {
  NULL_ADDRESS = 0x0000,
  CONNECTED_ADDRESS = 0x00a1,
  CONNECTED_DATA = 0x00b1,
  UNCONNECTED_DATA = 0x00b2,
}

/**
 * CIP Common Service Codes
 */
export enum CipServiceCode {
  GET_ATTRIBUTE_ALL = 0x01,
  SET_ATTRIBUTE_ALL = 0x02,
  GET_ATTRIBUTE_LIST = 0x03,
  SET_ATTRIBUTE_LIST = 0x04,
  RESET = 0x05,
  START = 0x06,
  STOP = 0x07,
  CREATE = 0x08,
  DELETE = 0x09,
  MULTIPLE_SERVICE_PACKET = 0x0a,
  GET_ATTRIBUTE_SINGLE = 0x0e,
  SET_ATTRIBUTE_SINGLE = 0x10,
  
  // Rockwell Logix Specific Services
  READ_TAG = 0x4c,
  WRITE_TAG = 0x4d,
  READ_TAG_FRAGMENTED = 0x52,
  WRITE_TAG_FRAGMENTED = 0x53,
}

/**
 * CIP General Status Codes
 */
export enum CipGeneralStatus {
  SUCCESS = 0x00,
  EXTENDED_ERROR = 0x01,
  RESOURCE_UNAVAILABLE = 0x02,
  INVALID_PARAMETER_VALUE = 0x03,
  PATH_SEGMENT_ERROR = 0x04,
  PATH_DESTINATION_UNKNOWN = 0x05,
  PARTIAL_TRANSFER = 0x06,
  CONNECTION_LOST = 0x07,
  SERVICE_NOT_SUPPORTED = 0x08,
  INVALID_ATTRIBUTE_VALUE = 0x09,
  ATTRIBUTE_LIST_ERROR = 0x0a,
  ALREADY_IN_REQUESTED_STATE = 0x0b,
  OBJECT_STATE_CONFLICT = 0x0c,
  OBJECT_ALREADY_EXISTS = 0x0d,
  ATTRIBUTE_NOT_SETTABLE = 0x0e,
  PRIVILEGE_VIOLATION = 0x0f,
  DEVICE_STATE_CONFLICT = 0x10,
  REPLY_DATA_TOO_LARGE = 0x11,
  FRAGMENTATION_PRIMITIVE_ERROR = 0x12,
  NOT_ENOUGH_DATA = 0x13,
  ATTRIBUTE_NOT_SUPPORTED = 0x14,
  TOO_MUCH_DATA = 0x15,
  OBJECT_DOES_NOT_EXIST = 0x16,
  ROUTING_FAILURE_REQUEST_PACKET_TOO_LARGE = 0x22,
  ROUTING_FAILURE_RESPONSE_PACKET_TOO_LARGE = 0x23,
  ROUTING_FAILURE_MISSING_ROUTE_PATH = 0x24,
  ROUTING_FAILURE_BAD_OFFERING = 0x25,
  PATH_SIZE_INVALID = 0x26,
}

/**
 * CIP Data Type Codes
 */
export enum CipDataTypeCode {
  BOOL = 0x00c1,
  SINT = 0x00c2,
  INT = 0x00c3,
  DINT = 0x00c4,
  LINT = 0x00c5,
  USINT = 0x00c6,
  UINT = 0x00c7,
  UDINT = 0x00c8,
  ULINT = 0x00c9,
  REAL = 0x00ca,
  LREAL = 0x00cb,
  STRING = 0x00d0,
  STRUCT = 0x02a0,
}

export type CipStandardDataType =
  | "BOOL"
  | "SINT"
  | "INT"
  | "DINT"
  | "LINT"
  | "USINT"
  | "UINT"
  | "UDINT"
  | "REAL"
  | "STRING";

/**
 * EtherNet/IP 24-byte Encapsulation Header
 */
export interface EipEncapsulationHeader {
  command: number;
  length: number;
  sessionHandle: number;
  status: number;
  senderContext: Uint8Array;
  options: number;
}

/**
 * Common Packet Format Item
 */
export interface CpfItem {
  typeId: number;
  length: number;
  data: Uint8Array;
}

/**
 * Common Packet Format Packet
 */
export interface CpfPacket {
  interfaceHandle: number;
  timeout: number;
  items: CpfItem[];
}

/**
 * CIP Response Structure
 */
export interface CipResponse {
  service: number;
  generalStatus: number;
  extendedStatus: number[];
  dataType?: number;
  data: Uint8Array;
}

/**
 * Parsed Tag Metadata
 */
export interface CipParsedTag {
  tagName: string;
  baseTag: string;
  arrayIndex?: number;
  bitIndex?: number;
  epath: Uint8Array;
}

export function getCipStatusDescription(status: number): string {
  switch (status) {
    case CipGeneralStatus.SUCCESS:
      return "CIP Success (0x00)";
    case CipGeneralStatus.EXTENDED_ERROR:
      return "CIP Extended Error (0x01)";
    case CipGeneralStatus.RESOURCE_UNAVAILABLE:
      return "CIP Resource Unavailable (0x02)";
    case CipGeneralStatus.INVALID_PARAMETER_VALUE:
      return "CIP Invalid Parameter Value (0x03)";
    case CipGeneralStatus.PATH_SEGMENT_ERROR:
      return "CIP Path Segment Error (0x04)";
    case CipGeneralStatus.PATH_DESTINATION_UNKNOWN:
      return "CIP Path Destination Unknown / Tag Not Found (0x05)";
    case CipGeneralStatus.PARTIAL_TRANSFER:
      return "CIP Partial Transfer (0x06)";
    case CipGeneralStatus.CONNECTION_LOST:
      return "CIP Connection Lost (0x07)";
    case CipGeneralStatus.SERVICE_NOT_SUPPORTED:
      return "CIP Service Not Supported (0x08)";
    case CipGeneralStatus.PRIVILEGE_VIOLATION:
      return "CIP Privilege Violation (0x0F)";
    case CipGeneralStatus.NOT_ENOUGH_DATA:
      return "CIP Not Enough Data (0x13)";
    case CipGeneralStatus.TOO_MUCH_DATA:
      return "CIP Too Much Data (0x15)";
    case CipGeneralStatus.OBJECT_DOES_NOT_EXIST:
      return "CIP Object Does Not Exist (0x16)";
    case CipGeneralStatus.PATH_SIZE_INVALID:
      return "CIP Path Size Invalid (0x26)";
    default:
      return `CIP Error (0x${status.toString(16).padStart(2, "0").toUpperCase()})`;
  }
}

export function getCipDataTypeName(code: number): CipStandardDataType {
  switch (code) {
    case CipDataTypeCode.BOOL:
      return "BOOL";
    case CipDataTypeCode.SINT:
      return "SINT";
    case CipDataTypeCode.INT:
      return "INT";
    case CipDataTypeCode.DINT:
      return "DINT";
    case CipDataTypeCode.LINT:
      return "LINT";
    case CipDataTypeCode.USINT:
      return "USINT";
    case CipDataTypeCode.UINT:
      return "UINT";
    case CipDataTypeCode.UDINT:
      return "UDINT";
    case CipDataTypeCode.REAL:
      return "REAL";
    case CipDataTypeCode.STRING:
      return "STRING";
    default:
      return "REAL";
  }
}

export function getCipDataTypeCode(name: CipStandardDataType): number {
  switch (name) {
    case "BOOL":
      return CipDataTypeCode.BOOL;
    case "SINT":
      return CipDataTypeCode.SINT;
    case "INT":
      return CipDataTypeCode.INT;
    case "DINT":
      return CipDataTypeCode.DINT;
    case "LINT":
      return CipDataTypeCode.LINT;
    case "USINT":
      return CipDataTypeCode.USINT;
    case "UINT":
      return CipDataTypeCode.UINT;
    case "UDINT":
      return CipDataTypeCode.UDINT;
    case "REAL":
      return CipDataTypeCode.REAL;
    case "STRING":
      return CipDataTypeCode.STRING;
    default:
      return CipDataTypeCode.REAL;
  }
}
