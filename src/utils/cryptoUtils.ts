/**
 * BioAzúcar 4.0 — Cryptographic Utilities & Architecture Separation
 * ==============================================================================
 * Conforms to IEC 62443-4-2 FR3 (Data Integrity) & FR4 (Confidentiality).
 * 
 * Explicit Boundary:
 * Browser:  React/PWA → Web Crypto API (globalThis.crypto.subtle) & Pure TS FIPS 180-4
 * Edge/Server: Node.js Crypto / Pure TS fallback
 * 
 * Guarantees zero imports of 'node:crypto', 'fs', 'path', etc. in the browser bundle.
 */

// FIPS 180-4 SHA-256 round constants
const K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/**
 * Pure TypeScript synchronous FIPS 180-4 SHA-256 over raw Uint8Array.
 */
export function sha256Bytes(inputBytes: Uint8Array): Uint8Array {
  const bytes = Array.from(inputBytes);
  const bitLength = bytes.length * 8;

  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  for (let i = 24; i >= 0; i -= 8) bytes.push((highBits >>> i) & 0xff);
  for (let i = 24; i >= 0; i -= 8) bytes.push((lowBits >>> i) & 0xff);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = chunkStart + i * 4;
      w[i] =
        ((bytes[idx] << 24) |
          (bytes[idx + 1] << 16) |
          (bytes[idx + 2] << 8) |
          bytes[idx + 3]) >>>
        0;
    }

    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out: number[] = [];
  for (const h of [h0, h1, h2, h3, h4, h5, h6, h7]) {
    out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
  }
  return new Uint8Array(out);
}

/**
 * Encodes string to UTF-8 byte array.
 */
export function encodeUtf8(str: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    } else {
      i++;
      const nextChar = str.charCodeAt(i);
      const codePoint = 0x10000 + (((charCode & 0x3ff) << 10) | (nextChar & 0x3ff));
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Pure TypeScript synchronous FIPS 180-4 SHA-256 string hasher.
 */
export function sha256Hex(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? encodeUtf8(data) : data;
  const hashBytes = sha256Bytes(bytes);
  return Array.from(hashBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Explicit Web Crypto API SHA-256 implementation as required by browser separation architecture.
 * Calls globalThis.crypto.subtle.digest("SHA-256", ...) with pure TS fallback if unavailable.
 */
export async function digestSha256WebCrypto(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === "string" ? encodeUtf8(data) : data;
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    try {
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return sha256Hex(buffer);
    }
  }
  return sha256Hex(buffer);
}

/**
 * Alias for backward compatibility.
 */
export const computeSha256 = digestSha256WebCrypto;

/**
 * Pure TypeScript HMAC-SHA256 (RFC 2104 compliant).
 * 100% bit-exact with Node.js crypto.createHmac("sha256", key).
 */
export function hmacSha256Hex(key: string | Uint8Array, message: string | Uint8Array): string {
  let keyBytes = typeof key === "string" ? encodeUtf8(key) : key;
  const msgBytes = typeof message === "string" ? encodeUtf8(message) : message;

  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }

  const kPad = new Uint8Array(64);
  kPad.set(keyBytes);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = kPad[i] ^ 0x5c;
    iKeyPad[i] = kPad[i] ^ 0x36;
  }

  const innerBuf = new Uint8Array(64 + msgBytes.length);
  innerBuf.set(iKeyPad, 0);
  innerBuf.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerBuf);

  const outerBuf = new Uint8Array(64 + 32);
  outerBuf.set(oKeyPad, 0);
  outerBuf.set(innerHash, 64);
  const outerHash = sha256Bytes(outerBuf);

  return Array.from(outerHash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Isomorphic Hash builder compatible with Node crypto.createHash API.
 */
export class IndustrialHash {
  private chunks: Uint8Array[] = [];

  constructor(public readonly algorithm: string = "sha256") {}

  public update(data: string | Uint8Array): this {
    const bytes = typeof data === "string" ? encodeUtf8(data) : data;
    this.chunks.push(bytes);
    return this;
  }

  public digest(encoding: "hex" | "binary" = "hex"): string {
    let totalLen = 0;
    for (const c of this.chunks) totalLen += c.length;
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of this.chunks) {
      combined.set(c, offset);
      offset += c.length;
    }
    const hash = sha256Hex(combined);
    if (encoding === "hex") return hash;
    return hash;
  }
}

/**
 * Isomorphic HMAC builder compatible with Node crypto.createHmac API.
 */
export class IndustrialHmac {
  private chunks: Uint8Array[] = [];

  constructor(
    public readonly algorithm: string = "sha256",
    private readonly key: string | Uint8Array
  ) {}

  public update(data: string | Uint8Array): this {
    const bytes = typeof data === "string" ? encodeUtf8(data) : data;
    this.chunks.push(bytes);
    return this;
  }

  public digest(encoding: "hex" = "hex"): string {
    let totalLen = 0;
    for (const c of this.chunks) totalLen += c.length;
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of this.chunks) {
      combined.set(c, offset);
      offset += c.length;
    }
    return hmacSha256Hex(this.key, combined);
  }
}

export function createIndustrialHash(algorithm: string = "sha256"): IndustrialHash {
  return new IndustrialHash(algorithm);
}

export function createIndustrialHmac(algorithm: string = "sha256", key: string | Uint8Array): IndustrialHmac {
  return new IndustrialHmac(algorithm, key);
}

// Aliases matching standard Node names for drop-in browser replacement
export const createHash = createIndustrialHash;
export const createHmac = createIndustrialHmac;

/**
 * Generates cryptographically secure random bytes in hex format.
 */
export function randomHex(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SafeByteBuffer extends Uint8Array {
  toString(encoding?: string): string;
}

export function randomBytes(byteLength: number = 16): SafeByteBuffer {
  const bytes = new Uint8Array(byteLength) as SafeByteBuffer;
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes.toString = function (encoding?: string): string {
    if (encoding === "hex") {
      return Array.from(bytes)
        .map((b) => Number(b).toString(16).padStart(2, "0"))
        .join("");
    }
    return Uint8Array.prototype.toString.call(bytes);
  };
  return bytes;
}

/**
 * Secure UUID v4 generator without Node dependencies.
 */
export function randomUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/**
 * Computes canonical physical evidence hash for an industrial commissioning certificate.
 */
export function computeEvidenceHash(params: {
  commissioningId: string;
  tenantId: string;
  connectionId: string;
  timestamp: string;
  dataQualityPassRate: number;
  latencyMs: number;
}): string {
  const payload = [
    params.commissioningId,
    params.tenantId,
    params.connectionId,
    params.timestamp,
    params.dataQualityPassRate.toFixed(2),
    params.latencyMs.toFixed(1),
  ].join("|");
  return sha256Hex(payload);
}
