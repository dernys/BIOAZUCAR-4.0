/**
 * BioAzúcar 4.0 — DCS EROS Gateway Protocol Specification & Types
 * 
 * Formal binary protocol definitions for the EROS Distributed Control System
 * utilized in sugar mill cane reception, milling tandems, and evaporation stations.
 * 
 * Protocol: EROS-NET over TCP port 5020 (or RS-485/TCP serial gateway).
 */

export const EROS_SYNC_WORD = 0x4552; // ASCII "ER" (0x45, 0x52)
export const EROS_PROTOCOL_VERSION = 0x01;
export const EROS_HEADER_SIZE = 9; // Sync(2) + Ver(1) + Station(1) + Cmd(1) + Seq(2) + Length(2)
export const EROS_CHECKSUM_SIZE = 2; // CRC16 (2 bytes)

/**
 * EROS Protocol Command Codes
 */
export enum ErosCommandCode {
  READ_VARIABLE = 0x03,
  READ_VARIABLE_RESPONSE = 0x83,
  WRITE_VARIABLE = 0x04,
  WRITE_VARIABLE_RESPONSE = 0x84,
  HEARTBEAT = 0x05,
  HEARTBEAT_RESPONSE = 0x85,
  GET_STATION_INFO = 0x06,
  GET_STATION_INFO_RESPONSE = 0x86,
}

/**
 * EROS Protocol Status Codes
 */
export enum ErosStatusCode {
  SUCCESS = 0x00,
  DB_NOT_FOUND = 0x01,
  OFFSET_OUT_OF_BOUNDS = 0x02,
  ACCESS_DENIED = 0x03,
  CRC_ERROR = 0x04,
  INVALID_COMMAND = 0x05,
  STATION_OFFLINE = 0x06,
  INVALID_PAYLOAD = 0x07,
}

/**
 * EROS Memory Area Types
 */
export enum ErosAreaType {
  BIT = 0x01,   // 'X' (Bit)
  BYTE = 0x02,  // 'B' (Byte - 8 bit)
  WORD = 0x03,  // 'W' (Word - 16 bit)
  DWORD = 0x04, // 'D' (Double Word / Float - 32 bit)
}

/**
 * EROS Primitive Data Types
 */
export enum ErosDataType {
  BOOL = 0x01,
  INT16 = 0x02,
  INT32 = 0x03,
  FLOAT32 = 0x04,
  STRING = 0x05,
}

/**
 * EROS Frame Header Structure
 */
export interface ErosHeader {
  syncWord: number;       // 0x4552 ("ER")
  version: number;        // 0x01
  stationId: number;      // 1..255
  command: ErosCommandCode;
  sequence: number;       // 16-bit sequence number
  payloadLength: number;  // 16-bit payload length
}

/**
 * EROS Decoded Packet
 */
export interface ErosPacket {
  header: ErosHeader;
  payload: Uint8Array;
  checksum: number;
}

/**
 * Parsed EROS Memory Address
 */
export interface ErosParsedAddress {
  dbNumber: number;
  areaType: "X" | "B" | "W" | "D";
  offset: number;
  bitIndex?: number;
}

export function getErosStatusDescription(status: ErosStatusCode): string {
  switch (status) {
    case ErosStatusCode.SUCCESS:
      return "EROS Success (0x00)";
    case ErosStatusCode.DB_NOT_FOUND:
      return "EROS Data Block Not Found (0x01)";
    case ErosStatusCode.OFFSET_OUT_OF_BOUNDS:
      return "EROS Offset Out of Bounds (0x02)";
    case ErosStatusCode.ACCESS_DENIED:
      return "EROS Access Denied / Security Violation (0x03)";
    case ErosStatusCode.CRC_ERROR:
      return "EROS Frame CRC-16 Checksum Mismatch (0x04)";
    case ErosStatusCode.INVALID_COMMAND:
      return "EROS Command Not Supported by DCS Station (0x05)";
    case ErosStatusCode.STATION_OFFLINE:
      return "EROS DCS Station Fieldbus Disconnected / Offline (0x06)";
    case ErosStatusCode.INVALID_PAYLOAD:
      return "EROS Invalid Payload Structure (0x07)";
    default:
      return `EROS Error (0x${Number(status).toString(16).padStart(2, "0").toUpperCase()})`;
  }
}

export function getErosAreaCode(area: "X" | "B" | "W" | "D"): ErosAreaType {
  switch (area) {
    case "X":
      return ErosAreaType.BIT;
    case "B":
      return ErosAreaType.BYTE;
    case "W":
      return ErosAreaType.WORD;
    case "D":
      return ErosAreaType.DWORD;
    default:
      return ErosAreaType.DWORD;
  }
}

export function getErosAreaChar(code: ErosAreaType): "X" | "B" | "W" | "D" {
  switch (code) {
    case ErosAreaType.BIT:
      return "X";
    case ErosAreaType.BYTE:
      return "B";
    case ErosAreaType.WORD:
      return "W";
    case ErosAreaType.DWORD:
      return "D";
    default:
      return "D";
  }
}
