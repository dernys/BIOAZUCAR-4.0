/**
 * BioAzúcar 4.0 — Canonical OPC UA Types & IEC 62541 Definitions
 * 
 * Defines standard NodeId parsing, StatusCodes mapping, Security Profiles,
 * and Binary Wire Message frames for industrial mill & cogeneration DCS.
 */

import { IndustrialDataQuality, IndustrialQualityReason } from "../../../types/industrialDataPoint";

export type OpcUaSecurityPolicy = 
  | "http://opcfoundation.org/UA/SecurityPolicy#None"
  | "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
  | "http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep";

export type OpcUaSecurityMode = "None" | "Sign" | "SignAndEncrypt";

export enum OpcUaStatusCode {
  Good = 0x00000000,
  GoodCompletesAsynchronously = 0x002F0000,
  GoodClamped = 0x00300000,
  Uncertain = 0x40000000,
  UncertainInitialValue = 0x40920000,
  UncertainSensorNotAccurate = 0x40940000,
  UncertainEngineeringUnitsExceeded = 0x40950000,
  UncertainSubNormal = 0x40960000,
  Bad = 0x80000000,
  BadUnexpectedError = 0x80010000,
  BadInternalError = 0x80020000,
  BadOutOfMemory = 0x80030000,
  BadCommunicationError = 0x80050000,
  BadTimeout = 0x800A0000,
  BadSecurityChecksFailed = 0x80130000,
  BadCertificateTimeInvalid = 0x80140000,
  BadCertificateUntrusted = 0x801A0000,
  BadNodeIdUnknown = 0x80340000,
  BadAttributeIdInvalid = 0x80350000,
  BadTypeMismatch = 0x80740000,
  BadSessionClosed = 0x80260000,
  BadSecureChannelClosed = 0x80AF0000,
}

export interface ParsedNodeId {
  namespaceIndex: number;
  identifierType: "NUMERIC" | "STRING" | "GUID" | "OPAQUE";
  identifier: string | number;
  raw: string;
}

export function parseNodeId(nodeIdStr: string): ParsedNodeId {
  if (!nodeIdStr || typeof nodeIdStr !== "string") {
    throw new Error(`Invalid NodeId: expected non-empty string, got '${nodeIdStr}'`);
  }

  // Common patterns: "ns=2;s=Boiler.Pressure", "ns=1;i=1001", "i=2258"
  const nsMatch = nodeIdStr.match(/^ns=(\d+);([s|i|g|b])=(.+)$/);
  if (nsMatch) {
    const ns = parseInt(nsMatch[1], 10);
    const typeChar = nsMatch[2].toLowerCase();
    const id = nsMatch[3];
    return {
      namespaceIndex: ns,
      identifierType: typeChar === "i" ? "NUMERIC" : typeChar === "s" ? "STRING" : typeChar === "g" ? "GUID" : "OPAQUE",
      identifier: typeChar === "i" ? parseInt(id, 10) : id,
      raw: nodeIdStr,
    };
  }

  // Root without ns (defaults to ns=0)
  const defaultMatch = nodeIdStr.match(/^([s|i])=(.+)$/);
  if (defaultMatch) {
    const typeChar = defaultMatch[1].toLowerCase();
    const id = defaultMatch[2];
    return {
      namespaceIndex: 0,
      identifierType: typeChar === "i" ? "NUMERIC" : "STRING",
      identifier: typeChar === "i" ? parseInt(id, 10) : id,
      raw: nodeIdStr,
    };
  }

  // Fallback as raw string identifier in ns=1
  return {
    namespaceIndex: 1,
    identifierType: "STRING",
    identifier: nodeIdStr,
    raw: nodeIdStr,
  };
}

export function mapOpcUaStatusCodeToQuality(statusCode: number): {
  quality: IndustrialDataQuality;
  reason: IndustrialQualityReason;
} {
  // Top 2 bits determine severity: 00 = Good, 01 = Uncertain, 10 = Bad
  const severity = (statusCode >>> 30) & 0x03;

  if (severity === 0) {
    return { quality: "GOOD", reason: "NORMAL" };
  }

  if (severity === 1) {
    if (statusCode === OpcUaStatusCode.UncertainEngineeringUnitsExceeded) {
      return { quality: "OUT_OF_RANGE", reason: "NORMAL" };
    }
    return { quality: "UNCERTAIN", reason: "UNCERTAIN" };
  }

  // Severity === 2 or Bad
  switch (statusCode) {
    case OpcUaStatusCode.BadTimeout:
      return { quality: "BAD", reason: "TIMEOUT" };
    case OpcUaStatusCode.BadCommunicationError:
    case OpcUaStatusCode.BadSecureChannelClosed:
    case OpcUaStatusCode.BadSessionClosed:
      return { quality: "COMMUNICATION_LOST", reason: "COMM_FAILURE" };
    case OpcUaStatusCode.BadCertificateUntrusted:
    case OpcUaStatusCode.BadCertificateTimeInvalid:
    case OpcUaStatusCode.BadSecurityChecksFailed:
      return { quality: "BAD", reason: "AUTHENTICATION_FAILURE" };
    case OpcUaStatusCode.BadNodeIdUnknown:
      return { quality: "BAD", reason: "NODE_NOT_FOUND" };
    case OpcUaStatusCode.BadTypeMismatch:
      return { quality: "BAD", reason: "CRC_ERROR" };
    default:
      return { quality: "BAD", reason: "COMM_FAILURE" };
  }
}

export interface OpcUaHelloMessage {
  messageType: "HEL";
  protocolVersion: number;
  receiveBufferSize: number;
  sendBufferSize: number;
  maxMessageSize: number;
  maxChunkCount: number;
  endpointUrl: string;
}

export interface OpcUaAcknowledgeMessage {
  messageType: "ACK";
  protocolVersion: number;
  receiveBufferSize: number;
  sendBufferSize: number;
  maxMessageSize: number;
  maxChunkCount: number;
}

export interface OpcUaErrorMessage {
  messageType: "ERR";
  errorCode: number;
  reason: string;
}
