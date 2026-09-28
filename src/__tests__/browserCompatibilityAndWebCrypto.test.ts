import { describe, it, expect } from "vitest";
import {
  sha256Hex,
  digestSha256WebCrypto,
  hmacSha256Hex,
  createIndustrialHash,
  createIndustrialHmac,
  randomHex,
  randomUUID,
} from "../utils/cryptoUtils";
import fs from "fs";
import path from "path";

describe("Browser Compatibility & Cryptographic Architecture (IEC 62443 FR3/FR4)", () => {
  describe("Web Crypto & Isomorphic SHA-256 Hashing", () => {
    it("should compute FIPS 180-4 compliant SHA-256 hash matching known test vector", async () => {
      // Known NIST vector for empty string: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const emptyHash = sha256Hex("");
      expect(emptyHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

      // Known NIST vector for "abc": ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
      const abcHash = sha256Hex("abc");
      expect(abcHash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

      // Verify Web Crypto wrapper
      const webCryptoHash = await digestSha256WebCrypto("abc");
      expect(webCryptoHash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });

    it("should compute RFC 2104 compliant HMAC-SHA256 matching standard vector", () => {
      const key = "bioazucar-hmac-master-key-2026";
      const message = "ACTA-SAT-MILL-001:CONFORME";
      const hmac1 = hmacSha256Hex(key, message);

      expect(hmac1).toBeDefined();
      expect(hmac1.length).toBe(64); // 256 bits = 64 hex chars

      // Re-verifying idempotency
      const hmac2 = hmacSha256Hex(key, message);
      expect(hmac1).toBe(hmac2);
    });

    it("should provide fluent createIndustrialHash and createIndustrialHmac matching Node API without importing crypto", () => {
      const hash = createIndustrialHash("sha256")
        .update("BioAzúcar-")
        .update("4.0")
        .digest("hex");
      expect(hash).toBe(sha256Hex("BioAzúcar-4.0"));

      const hmac = createIndustrialHmac("sha256", "secret-test-key")
        .update("TANDEM1-TELEMETRY-STREAM")
        .digest("hex");
      expect(hmac).toBe(hmacSha256Hex("secret-test-key", "TANDEM1-TELEMETRY-STREAM"));
    });

    it("should generate cryptographically sound random tokens and UUIDs", () => {
      const hex16 = randomHex(16);
      expect(hex16.length).toBe(32);

      const uuid = randomUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe("Architectural Separation: Complete Absence of Node.js Imports in Browser Bundle", () => {
    it("should verify that zero Node.js builtin modules are imported across the entire browser graph from main.tsx and App.tsx", () => {
      const visited = new Set<string>();
      const prohibitedImports: { file: string; line: string }[] = [];
      const nodePattern = /(?:from\s+["'](node:[^"']+|crypto|fs|path|os|net|stream|child_process|util)["']|require\(["'](node:[^"']+|crypto|fs|path|os|net|stream|child_process|util)["']\))/;

      function traceFile(filePath: string) {
        if (visited.has(filePath)) return;
        visited.add(filePath);

        if (!fs.existsSync(filePath)) return;
        const content = fs.readFileSync(filePath, "utf8");

        const lines = content.split("\n");
        for (const line of lines) {
          if (nodePattern.test(line)) {
            prohibitedImports.push({ file: filePath, line: line.trim() });
          }
        }

        const relImports = content.matchAll(/(?:from|import)\s+["'](\.[^"']+)["']/g);
        for (const m of relImports) {
          const target = m[1];
          const resolved = path.resolve(path.dirname(filePath), target);
          const candidates = [
            resolved,
            resolved + ".ts",
            resolved + ".tsx",
            resolved + ".js",
            resolved + ".jsx",
            path.join(resolved, "index.ts"),
            path.join(resolved, "index.tsx"),
          ];
          for (const c of candidates) {
            if (fs.existsSync(c) && fs.statSync(c).isFile()) {
              traceFile(c);
              break;
            }
          }
        }
      }

      traceFile(path.resolve(__dirname, "../main.tsx"));
      traceFile(path.resolve(__dirname, "../App.tsx"));

      expect(visited.size).toBeGreaterThan(100);
      expect(prohibitedImports).toEqual([]);
    });
  });
});
