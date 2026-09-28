/**
 * BIOAZÚCAR 4.0 — WEBAUTHN / FIDO2 BINARY & PROTOCOL PARSER
 * ==============================================================================
 * Conforms to W3C Web Authentication Section 6.1 (Authenticator Data Layout),
 * FIDO2 CTAP 2.1, and IEC 62443-4-2 FR1 / FR2.
 * 
 * Works isomorphically in Node.js server and browser environments without
 * external dependencies, using pure TypeScript and FIPS 180-4 SHA-256.
 */

import {
  AuthenticatorDataFlags,
  WebAuthnAlgorithm,
} from "../../../types/webauthn";
import { sha256Bytes, sha256Hex, encodeUtf8 } from "../../../utils/cryptoUtils";

/**
 * Encodes a Uint8Array into a Base64URL string (RFC 4648 §5).
 */
export function bufferToBase64Url(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes a Base64URL string into a Uint8Array.
 */
export function base64UrlToBuffer(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface ParsedClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

/**
 * Parses and verifies ClientDataJSON from WebAuthn ceremony.
 */
export function parseClientDataJson(rawJsonOrBase64: string): ParsedClientData {
  let jsonString: string;
  if (rawJsonOrBase64.trim().startsWith("{")) {
    jsonString = rawJsonOrBase64;
  } else {
    const bytes = base64UrlToBuffer(rawJsonOrBase64);
    const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
    jsonString = decoder
      ? decoder.decode(bytes)
      : Array.from(bytes)
          .map((b) => String.fromCharCode(b))
          .join("");
  }

  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("[WEBAUTHN_PARSER] ClientDataJSON is not a valid JSON object.");
  }
  if (typeof parsed.type !== "string" || typeof parsed.challenge !== "string" || typeof parsed.origin !== "string") {
    throw new Error("[WEBAUTHN_PARSER] ClientDataJSON missing required fields (type, challenge, origin).");
  }

  return {
    type: parsed.type,
    challenge: parsed.challenge,
    origin: parsed.origin,
    crossOrigin: Boolean(parsed.crossOrigin),
  };
}

export interface ParsedAuthenticatorData {
  rpIdHashHex: string;
  flags: AuthenticatorDataFlags;
  flagsByte: number;
  signCount: number;
  aaguidHex?: string;
  credentialId?: string; // Base64URL
  publicKey?: string; // Base64URL
  rawBytes: Uint8Array;
}

/**
 * Parses binary AuthenticatorData according to W3C WebAuthn spec §6.1.
 * 
 * Byte Layout:
 * - 0..31   : RP ID Hash (SHA-256)
 * - 32      : Flags bitfield
 * - 33..36  : Counter (Sign count big-endian 32-bit uint)
 * - 37..    : Attested credential data (optional, if AT flag set)
 */
export function parseAuthenticatorData(rawAuthData: Uint8Array | string): ParsedAuthenticatorData {
  const bytes = typeof rawAuthData === "string" ? base64UrlToBuffer(rawAuthData) : rawAuthData;

  if (bytes.length < 37) {
    throw new Error(`[WEBAUTHN_PARSER] AuthenticatorData too short (${bytes.length} bytes, minimum 37 required).`);
  }

  // 1. RP ID Hash (first 32 bytes)
  const rpIdHashBytes = bytes.slice(0, 32);
  const rpIdHashHex = Array.from(rpIdHashBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 2. Flags byte
  const flagsByte = bytes[32];
  const flags: AuthenticatorDataFlags = {
    userPresent: (flagsByte & 0x01) !== 0,
    userVerified: (flagsByte & 0x04) !== 0,
    backupEligibility: (flagsByte & 0x08) !== 0,
    backupState: (flagsByte & 0x10) !== 0,
    attestedCredentialData: (flagsByte & 0x40) !== 0,
    extensionDataIncluded: (flagsByte & 0x80) !== 0,
  };

  // 3. Monotonically increasing signature counter (32-bit unsigned big-endian)
  const signCount =
    ((bytes[33] << 24) >>> 0) +
    ((bytes[34] << 16) >>> 0) +
    ((bytes[35] << 8) >>> 0) +
    (bytes[36] >>> 0);

  const result: ParsedAuthenticatorData = {
    rpIdHashHex,
    flags,
    flagsByte,
    signCount,
    rawBytes: bytes,
  };

  // 4. Extract Attested Credential Data if AT flag is 1
  if (flags.attestedCredentialData && bytes.length >= 55) {
    // AAGUID (16 bytes)
    const aaguidBytes = bytes.slice(37, 53);
    result.aaguidHex = Array.from(aaguidBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Credential ID Length (2 bytes big-endian)
    const credIdLen = (bytes[53] << 8) + bytes[54];
    if (bytes.length >= 55 + credIdLen) {
      const credIdBytes = bytes.slice(55, 55 + credIdLen);
      result.credentialId = bufferToBase64Url(credIdBytes);

      // Remaining bytes contain the COSE public key
      const coseBytes = bytes.slice(55 + credIdLen);
      if (coseBytes.length > 0) {
        result.publicKey = bufferToBase64Url(coseBytes);
      }
    }
  }

  return result;
}

/**
 * Validates that the AuthenticatorData's RP ID hash matches the expected RP ID.
 */
export function verifyRpIdHash(authData: ParsedAuthenticatorData, expectedRpId: string): boolean {
  const expectedHash = sha256Hex(expectedRpId);
  return authData.rpIdHashHex.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Validates origin against expected origins (supports localhost, dev ports, and production FQDNs).
 */
export function verifyOrigin(clientOrigin: string, expectedOriginOrRpId: string): boolean {
  if (!clientOrigin || !expectedOriginOrRpId) return false;
  try {
    const parsed = new URL(clientOrigin);
    if (parsed.hostname === expectedOriginOrRpId) return true;
    if (expectedOriginOrRpId === "localhost" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")) return true;
    if (clientOrigin.includes(expectedOriginOrRpId)) return true;
  } catch {
    return clientOrigin.includes(expectedOriginOrRpId);
  }
  return false;
}
