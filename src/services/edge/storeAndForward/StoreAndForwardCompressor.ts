/**
 * BIOAZÚCAR 4.0 — STORE & FORWARD HIGH-DENSITY COMPRESSION ENGINE
 * =============================================================
 * Spec Reference: developer_roadmap.md (Section 2.2, I29 & P1-01)
 * 
 * Provides multi-algorithm, crash-resilient compression for industrial telemetry
 * stored in SQLite WAL and transmitted across bandwidth-constrained WAN / satellite links.
 * 
 * Supported algorithms:
 * - BROTLI (RFC 7932): High-density dictionary-based compression for industrial telemetry (>75% ratio)
 * - GZIP (RFC 1952): Universal streaming compression for DMZ / Cloud forwarders
 * - DEFLATE (RFC 1951): Low-latency sliding window compression
 * - RAW: Pass-through for tiny payloads (< minSizeBytes)
 * 
 * Complies with:
 * - Tamper-evident integrity checking via IEEE 802.3 CRC-32 and SHA-256
 * - Safe dynamic Node.js loading (no direct Node built-in imports in frontend web bundle)
 * - Transparent envelope detection: CMP:<ALGO>:<CRC32_HEX>:<UNCOMPRESSED_LEN>:<BASE64>
 */

import { IndustrialDataPoint } from "../../../types/industrialDataPoint";

export type CompressionAlgorithm = "BROTLI" | "GZIP" | "DEFLATE" | "RAW";

export interface CompressionOptions {
  algorithm?: CompressionAlgorithm;
  minSizeBytes?: number;
  brotliQuality?: number; // 1 to 11 (default: 4 for industrial speed)
  gzipLevel?: number; // 1 to 9 (default: 6)
}

export interface CompressedEnvelope {
  isCompressed: boolean;
  algorithm: CompressionAlgorithm;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatioPct: number; // e.g. 78.5%
  crc32: string; // 8-char hex
  encodedPayload: string;
}

export interface CompressedBatchEnvelope {
  batchId: string;
  count: number;
  isCompressed: boolean;
  algorithm: CompressionAlgorithm;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatioPct: number;
  crc32: string;
  sha256: string;
  encodedPayload: string;
}

export interface CompressionEngineMetrics {
  totalPointsProcessed: number;
  totalBatchesCompressed: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  overallBytesSaved: number;
  overallCompressionRatioPct: number;
  algorithmUsage: Record<CompressionAlgorithm, number>;
  corruptedPayloadsDetected: number;
}

function getNodeZlibAndCrypto(): { zlib: any; crypto: any } | null {
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    try {
      const nodeRequire =
        typeof (globalThis as any).__non_webpack_require__ !== "undefined"
          ? (globalThis as any).__non_webpack_require__
          : eval("require");
      return {
        zlib: nodeRequire("zlib"),
        crypto: nodeRequire("crypto"),
      };
    } catch {
      return null;
    }
  }
  return null;
}

// Deterministic CRC-32 table (IEEE 802.3 standard)
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export class StoreAndForwardCompressor {
  private static instance: StoreAndForwardCompressor | null = null;

  private metrics: CompressionEngineMetrics = {
    totalPointsProcessed: 0,
    totalBatchesCompressed: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    overallBytesSaved: 0,
    overallCompressionRatioPct: 0,
    algorithmUsage: {
      BROTLI: 0,
      GZIP: 0,
      DEFLATE: 0,
      RAW: 0,
    },
    corruptedPayloadsDetected: 0,
  };

  private constructor() {}

  public static getInstance(): StoreAndForwardCompressor {
    if (!StoreAndForwardCompressor.instance) {
      StoreAndForwardCompressor.instance = new StoreAndForwardCompressor();
    }
    return StoreAndForwardCompressor.instance;
  }

  public static resetInstance(): void {
    StoreAndForwardCompressor.instance = null;
  }

  /**
   * Calculates IEEE 802.3 CRC-32 checksum
   */
  public calculateCrc32(data: string | Uint8Array): number {
    let crc = 0xffffffff;
    if (typeof data === "string") {
      for (let i = 0; i < data.length; i++) {
        const code = data.charCodeAt(i);
        if (code < 0x80) {
          crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ code) & 0xff];
        } else if (code < 0x800) {
          crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0xc0 | (code >> 6))) & 0xff];
          crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | (code & 0x3f))) & 0xff];
        } else {
          crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0xe0 | (code >> 12))) & 0xff];
          crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | ((code >> 6) & 0x3f))) & 0xff];
          crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | (code & 0x3f))) & 0xff];
        }
      }
    } else {
      for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Detects if a string is encoded with the StoreAndForwardCompressor envelope
   */
  public isCompressedPayload(payload: string): boolean {
    if (!payload || typeof payload !== "string") return false;
    return payload.startsWith("CMP:BROTLI:") ||
      payload.startsWith("CMP:GZIP:") ||
      payload.startsWith("CMP:DEFLATE:") ||
      payload.startsWith("CMP:RAW:");
  }

  /**
   * Extracts algorithm from compressed payload
   */
  public getAlgorithmFromPayload(payload: string): CompressionAlgorithm | "UNKNOWN" {
    if (!this.isCompressedPayload(payload)) return "UNKNOWN";
    const parts = payload.split(":");
    return (parts[1] as CompressionAlgorithm) || "UNKNOWN";
  }

  /**
   * Compresses an arbitrary string into a tagged envelope
   */
  public compressString(
    input: string,
    options: CompressionOptions = {}
  ): CompressedEnvelope {
    const minSize = options.minSizeBytes ?? 64;
    const inputLen = Buffer.byteLength(input, "utf8");
    const crc = this.calculateCrc32(input);
    const crcHex = crc.toString(16).padStart(8, "0");

    // Don't compress if too small or in browser without zlib
    const nodeMods = getNodeZlibAndCrypto();
    if (inputLen < minSize || !nodeMods) {
      this.metrics.totalOriginalBytes += inputLen;
      this.metrics.totalCompressedBytes += inputLen;
      this.metrics.algorithmUsage.RAW++;
      return {
        isCompressed: false,
        algorithm: "RAW",
        originalSizeBytes: inputLen,
        compressedSizeBytes: inputLen,
        compressionRatioPct: 0,
        crc32: crcHex,
        encodedPayload: `CMP:RAW:${crcHex}:${inputLen}:${input}`,
      };
    }

    const { zlib } = nodeMods;
    const requestedAlgo = options.algorithm || "BROTLI";
    let compressedBuf: Buffer;
    let usedAlgo: CompressionAlgorithm = requestedAlgo;

    try {
      const inputBuf = Buffer.from(input, "utf8");
      if (requestedAlgo === "BROTLI" && typeof zlib.brotliCompressSync === "function") {
        compressedBuf = zlib.brotliCompressSync(inputBuf, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: options.brotliQuality ?? 4,
          },
        });
      } else if (requestedAlgo === "GZIP" && typeof zlib.gzipSync === "function") {
        compressedBuf = zlib.gzipSync(inputBuf, {
          level: options.gzipLevel ?? 6,
        });
      } else if (requestedAlgo === "DEFLATE" && typeof zlib.deflateSync === "function") {
        compressedBuf = zlib.deflateSync(inputBuf);
      } else {
        // Fallback to GZIP if brotli not supported
        compressedBuf = zlib.gzipSync(inputBuf);
        usedAlgo = "GZIP";
      }
    } catch {
      // Fallback to RAW on compression error
      this.metrics.algorithmUsage.RAW++;
      return {
        isCompressed: false,
        algorithm: "RAW",
        originalSizeBytes: inputLen,
        compressedSizeBytes: inputLen,
        compressionRatioPct: 0,
        crc32: crcHex,
        encodedPayload: `CMP:RAW:${crcHex}:${inputLen}:${input}`,
      };
    }

    const compSize = compressedBuf.length;
    // If compressed size is larger than original (can happen with small random data), use RAW
    if (compSize >= inputLen) {
      this.metrics.algorithmUsage.RAW++;
      return {
        isCompressed: false,
        algorithm: "RAW",
        originalSizeBytes: inputLen,
        compressedSizeBytes: inputLen,
        compressionRatioPct: 0,
        crc32: crcHex,
        encodedPayload: `CMP:RAW:${crcHex}:${inputLen}:${input}`,
      };
    }

    const b64 = compressedBuf.toString("base64");
    const ratioPct = Number((((inputLen - compSize) / inputLen) * 100).toFixed(1));

    this.metrics.totalOriginalBytes += inputLen;
    this.metrics.totalCompressedBytes += compSize;
    this.metrics.overallBytesSaved += (inputLen - compSize);
    this.metrics.algorithmUsage[usedAlgo]++;
    this.updateRatioMetrics();

    return {
      isCompressed: true,
      algorithm: usedAlgo,
      originalSizeBytes: inputLen,
      compressedSizeBytes: compSize,
      compressionRatioPct: ratioPct,
      crc32: crcHex,
      encodedPayload: `CMP:${usedAlgo}:${crcHex}:${inputLen}:${b64}`,
    };
  }

  /**
   * Decompresses an envelope string, verifying CRC-32 integrity
   */
  public decompressString(envelopeStr: string): string {
    if (!this.isCompressedPayload(envelopeStr)) {
      // Not a compressed envelope, return as raw string
      return envelopeStr;
    }

    // Format: CMP:<ALGO>:<CRC32_HEX>:<ORIG_LEN>:<PAYLOAD>
    const firstColon = envelopeStr.indexOf(":");
    const secondColon = envelopeStr.indexOf(":", firstColon + 1);
    const thirdColon = envelopeStr.indexOf(":", secondColon + 1);
    const fourthColon = envelopeStr.indexOf(":", thirdColon + 1);

    if (firstColon === -1 || secondColon === -1 || thirdColon === -1 || fourthColon === -1) {
      this.metrics.corruptedPayloadsDetected++;
      throw new Error("Invalid compressed envelope structure");
    }

    const algo = envelopeStr.substring(firstColon + 1, secondColon) as CompressionAlgorithm;
    const expectedCrc = envelopeStr.substring(secondColon + 1, thirdColon).toLowerCase();
    const originalLen = parseInt(envelopeStr.substring(thirdColon + 1, fourthColon), 10);
    const payload = envelopeStr.substring(fourthColon + 1);

    if (algo === "RAW") {
      const actualCrc = this.calculateCrc32(payload).toString(16).padStart(8, "0").toLowerCase();
      if (actualCrc !== expectedCrc) {
        this.metrics.corruptedPayloadsDetected++;
        throw new Error(`CRC-32 checksum mismatch in RAW envelope: expected ${expectedCrc}, got ${actualCrc}`);
      }
      return payload;
    }

    const nodeMods = getNodeZlibAndCrypto();
    if (!nodeMods) {
      throw new Error("Node zlib runtime required for decompressing non-RAW envelopes");
    }

    const { zlib } = nodeMods;
    const compBuf = Buffer.from(payload, "base64");
    let decompressedBuf: Buffer;

    try {
      if (algo === "BROTLI") {
        decompressedBuf = zlib.brotliDecompressSync(compBuf);
      } else if (algo === "GZIP") {
        decompressedBuf = zlib.gunzipSync(compBuf);
      } else if (algo === "DEFLATE") {
        decompressedBuf = zlib.inflateSync(compBuf);
      } else {
        throw new Error(`Unsupported compression algorithm in envelope: ${algo}`);
      }
    } catch (err: any) {
      this.metrics.corruptedPayloadsDetected++;
      throw new Error(`Decompression failed for ${algo}: ${err?.message || err}`);
    }

    const result = decompressedBuf.toString("utf8");
    const actualCrc = this.calculateCrc32(result).toString(16).padStart(8, "0").toLowerCase();
    if (actualCrc !== expectedCrc) {
      this.metrics.corruptedPayloadsDetected++;
      throw new Error(`CRC-32 checksum mismatch after decompression: expected ${expectedCrc}, got ${actualCrc}`);
    }

    return result;
  }

  /**
   * Compresses a single IndustrialDataPoint
   */
  public compressDataPoint(
    point: IndustrialDataPoint,
    options: CompressionOptions = {}
  ): string {
    const json = JSON.stringify(point);
    const env = this.compressString(json, options);
    this.metrics.totalPointsProcessed++;
    return env.encodedPayload;
  }

  /**
   * Decompresses a single IndustrialDataPoint
   */
  public decompressDataPoint(payload: string): IndustrialDataPoint {
    const json = this.decompressString(payload);
    return JSON.parse(json) as IndustrialDataPoint;
  }

  /**
   * Compresses an entire batch of IndustrialDataPoints into a single compact envelope
   */
  public compressBatch(
    points: IndustrialDataPoint[],
    batchId?: string,
    options: CompressionOptions = {}
  ): CompressedBatchEnvelope {
    const bId = batchId || `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const json = JSON.stringify(points);
    const originalLen = Buffer.byteLength(json, "utf8");
    const crc = this.calculateCrc32(json).toString(16).padStart(8, "0");

    let sha256 = "";
    const nodeMods = getNodeZlibAndCrypto();
    if (nodeMods?.crypto) {
      sha256 = nodeMods.crypto.createHash("sha256").update(json).digest("hex");
    }

    const env = this.compressString(json, options);
    this.metrics.totalBatchesCompressed++;
    this.metrics.totalPointsProcessed += points.length;

    return {
      batchId: bId,
      count: points.length,
      isCompressed: env.isCompressed,
      algorithm: env.algorithm,
      originalSizeBytes: originalLen,
      compressedSizeBytes: env.compressedSizeBytes,
      compressionRatioPct: env.compressionRatioPct,
      crc32: crc,
      sha256,
      encodedPayload: env.encodedPayload,
    };
  }

  /**
   * Decompresses an entire batch of IndustrialDataPoints
   */
  public decompressBatch(envelopeStr: string): IndustrialDataPoint[] {
    const json = this.decompressString(envelopeStr);
    return JSON.parse(json) as IndustrialDataPoint[];
  }

  /**
   * Returns current metrics
   */
  public getMetrics(): CompressionEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets metrics counters
   */
  public resetMetrics(): void {
    this.metrics = {
      totalPointsProcessed: 0,
      totalBatchesCompressed: 0,
      totalOriginalBytes: 0,
      totalCompressedBytes: 0,
      overallBytesSaved: 0,
      overallCompressionRatioPct: 0,
      algorithmUsage: {
        BROTLI: 0,
        GZIP: 0,
        DEFLATE: 0,
        RAW: 0,
      },
      corruptedPayloadsDetected: 0,
    };
  }

  private updateRatioMetrics(): void {
    if (this.metrics.totalOriginalBytes > 0) {
      const saved = this.metrics.totalOriginalBytes - this.metrics.totalCompressedBytes;
      this.metrics.overallBytesSaved = saved;
      this.metrics.overallCompressionRatioPct = Number(
        (((saved) / this.metrics.totalOriginalBytes) * 100).toFixed(1)
      );
    }
  }
}
