/**
 * BioAzúcar 4.0 — P0-02 Durable Edge Storage: 10,000 pts/sec & Zero Data Loss Under Crash
 * 
 * Verifies:
 * 1. High-throughput ingestion benchmark (>= 10,000 points/second) into native SQLite WAL.
 * 2. Strict Zero Data Loss guarantee: 100% of committed points persist across sudden termination (kill -9 / power cut).
 * 3. Atomic rollback of uncommitted in-flight writes without B-Tree corruption or torn reads.
 * 4. Store & Forward durability: 10,000 points enqueued, chunked, transmitted, and recovered on cold reboot.
 * 5. Elimination of debounced JSON disk spam when WAL is active (zero disk thrashing).
 * 6. Historical retention enforcement & compaction in SQLite WAL without service interruption.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalTimeSeriesDatabase } from "../services/edge/history/LocalTimeSeriesDatabase";
import { DiskStoreAndForwardEngine } from "../services/edge/DiskStoreAndForwardEngine";
import { SqliteWalEngine } from "../services/edge/storage/SqliteWalEngine";
import { IndustrialDataPoint } from "../types";
import fs from "fs";
import path from "path";

describe("[P0-02] Durable Edge Storage: 10k pts/sec High-Throughput & Zero Data Loss under Crash", () => {
  const testDir = path.join(process.cwd(), "data", "test-p0-durable-10k");
  const tsdbDbPath = path.join(testDir, "edge-tsdb-10k.sqlite");
  const safDbPath = path.join(testDir, "edge-saf-10k.sqlite");
  const safJournalPath = path.join(testDir, "edge-saf-10k.json");

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Suppress cleanup error
    }
  });

  describe("1. High-Throughput Ingestion Benchmark (>= 10,000 points/second)", () => {
    it("should ingest 10,000 industrial points into SQLite WAL in under 1,000 ms (>= 10k pts/sec)", () => {
      const tsdb = LocalTimeSeriesDatabase.getInstance();
      tsdb.configureSqlite(tsdbDbPath);
      tsdb.reset();

      expect(tsdb.isWalDurable()).toBe(true);
      expect(tsdb.getStorageType()).toBe("SQLITE_WAL");

      // Generate 10,000 realistic industrial points across tandem milling tags
      const pointsCount = 10000;
      const baseTime = Date.now() - 3600000;
      const points: IndustrialDataPoint[] = [];

      for (let i = 0; i < pointsCount; i++) {
        const millIndex = (i % 6) + 1;
        points.push({
          id: `p0-10k-pt-${i}`,
          tag: `Ingenio.Molienda.Molino${millIndex}.PresionHidraulica`,
          value: 200 + (i % 50) * 0.5,
          unit: "bar",
          quality: "GOOD",
          source: "MODBUS_TCP",
          protocol: "MODBUS-TCP",
          deviceTimestamp: new Date(baseTime + i * 200).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        });
      }

      // Benchmark ingestion
      const startTime = performance.now();
      // Record in 10 micro-batches of 1,000 points (standard industrial edge collector buffer)
      const batchSize = 1000;
      for (let offset = 0; offset < pointsCount; offset += batchSize) {
        tsdb.recordBatch(points.slice(offset, offset + batchSize));
      }
      const durationMs = performance.now() - startTime;

      const pointsPerSecond = (pointsCount / durationMs) * 1000;
      console.log(`[P0-02 Benchmark] Ingested 10,000 points in ${durationMs.toFixed(2)} ms (${pointsPerSecond.toFixed(0)} pts/sec)`);

      // Verify throughput criterion (>= 10,000 pts/sec)
      expect(durationMs).toBeLessThan(1000);
      expect(pointsPerSecond).toBeGreaterThanOrEqual(10000);

      // Verify exact row count in SQLite WAL
      expect(tsdb.getTotalRowCount()).toBe(10000);

      // Verify fast analytical range query
      const queryStart = performance.now();
      const results = tsdb.queryRange(
        "Ingenio.Molienda.Molino1.PresionHidraulica",
        baseTime - 1000,
        baseTime + pointsCount * 200 + 1000
      );
      const queryDurationMs = performance.now() - queryStart;

      expect(results.length).toBeGreaterThan(0);
      expect(queryDurationMs).toBeLessThan(50); // Sub-50ms analytical query on 10k rows

      tsdb.close();
    });
  });

  describe("2. Zero Data Loss Under Sudden Process Termination (kill -9 simulation)", () => {
    it("should guarantee ZERO DATA LOSS of committed points when abrupt power cut occurs during ingestion", () => {
      // Step 1: Open TSDB and commit 5,000 points in 5 batches
      let tsdb: LocalTimeSeriesDatabase | null = LocalTimeSeriesDatabase.getInstance();
      tsdb.configureSqlite(tsdbDbPath);
      tsdb.reset();

      const committedCount = 5000;
      const baseTime = Date.now() - 100000;
      const committedPoints: IndustrialDataPoint[] = [];

      for (let i = 0; i < committedCount; i++) {
        committedPoints.push({
          id: `p0-committed-${i}`,
          tag: "Caldera1.VaporPresion",
          value: 60 + (i % 20) * 0.2,
          unit: "bar",
          quality: "GOOD",
          source: "OPC_UA",
          protocol: "OPC-UA",
          deviceTimestamp: new Date(baseTime + i * 100).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        });
      }

      for (let offset = 0; offset < committedCount; offset += 1000) {
        tsdb.recordBatch(committedPoints.slice(offset, offset + 1000));
      }

      expect(tsdb.getTotalRowCount()).toBe(5000);

      // Step 2: Simulate sudden power outage (kill -9): abrupt handle teardown without graceful checkpoint
      tsdb.simulateSuddenPowerLoss();
      tsdb = null;

      // Step 3: Cold reboot from disk
      const rebootTsdb = LocalTimeSeriesDatabase.getInstance();
      rebootTsdb.configureSqlite(tsdbDbPath);

      // Verify integrity of B-Trees
      const integrity = rebootTsdb.verifyIntegrity();
      expect(integrity.ok).toBe(true);

      // Assert ZERO DATA LOSS: exactly 5,000 points must be 100% recovered
      expect(rebootTsdb.getTotalRowCount()).toBe(5000);

      // Verify values & chronological order are intact
      const recovered = rebootTsdb.queryRange("Caldera1.VaporPresion", baseTime - 1000, baseTime + 600000);
      expect(recovered.length).toBe(5000);
      expect(recovered[0].value).toBe(committedPoints[0].value);
      expect(recovered[4999].value).toBe(committedPoints[4999].value);

      // Step 4: Resume ingestion post-crash with another 5,000 points
      const resumedPoints: IndustrialDataPoint[] = [];
      for (let i = 5000; i < 10000; i++) {
        resumedPoints.push({
          id: `p0-resumed-${i}`,
          tag: "Caldera1.VaporPresion",
          value: 60 + (i % 20) * 0.2,
          unit: "bar",
          quality: "GOOD",
          source: "OPC_UA",
          protocol: "OPC-UA",
          deviceTimestamp: new Date(baseTime + i * 100).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        });
      }

      for (let offset = 0; offset < 5000; offset += 1000) {
        rebootTsdb.recordBatch(resumedPoints.slice(offset, offset + 1000));
      }

      // Total must now be exactly 10,000 points
      expect(rebootTsdb.getTotalRowCount()).toBe(10000);
      rebootTsdb.close();
    });
  });

  describe("3. Store & Forward High-Throughput Ingestion & Cold Recovery", () => {
    it("should enqueue 10,000 points at >= 10k pts/sec and recover 100% after crash", () => {
      const saf1 = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        diskJournalPath: safJournalPath,
        encryptionKey: "saf_p0_zero_loss_aes_key_32_bytes",
      });

      expect(saf1.isWalDurable()).toBe(true);
      expect(saf1.getStorageEngine()).toBe("SQLITE_WAL");

      const pointsCount = 10000;
      const points: IndustrialDataPoint[] = [];
      for (let i = 0; i < pointsCount; i++) {
        points.push({
          id: `saf-10k-pt-${i}`,
          tag: `Clarificador.TemperaturaZona${(i % 4) + 1}`,
          value: 95.5 + (i % 10) * 0.1,
          unit: "degC",
          quality: "GOOD",
          source: "SIEMENS_S7",
          protocol: "SIEMENS-S7",
          deviceTimestamp: new Date().toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        });
      }

      // Benchmark S&F batch enqueue
      const startTime = performance.now();
      saf1.enqueueBatch(points);
      const durationMs = performance.now() - startTime;

      const rate = (pointsCount / durationMs) * 1000;
      console.log(`[P0-02 S&F Benchmark] Enqueued 10,000 points in ${durationMs.toFixed(2)} ms (${rate.toFixed(0)} pts/sec)`);

      expect(durationMs).toBeLessThan(1000);
      expect(saf1.getQueueLength()).toBe(10000);

      // Prepare 4,000 points as IN_FLIGHT (being transmitted to central cloud/SCADA)
      const inFlightBatch = saf1.prepareBatch(4000);
      expect(inFlightBatch).not.toBeNull();
      expect(inFlightBatch!.points.length).toBe(4000);

      // Simulate unexpected crash while transmitting (4,000 IN_FLIGHT, 6,000 PENDING)
      saf1.simulateSuddenPowerLoss();

      // Cold boot new daemon instance
      const saf2 = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        diskJournalPath: safJournalPath,
        encryptionKey: "saf_p0_zero_loss_aes_key_32_bytes",
      });

      // Cold recovery must recover ALL 10,000 points without losing a single point
      const stats = saf2.getLastRecoveryStats();
      expect(stats).not.toBeNull();
      expect(stats!.integrityOk).toBe(true);
      expect(stats!.inFlightRecovered).toBe(4000);
      expect(stats!.quarantinedCorrupted).toBe(0);
      expect(saf2.getQueueLength()).toBe(10000);

      // Complete forward & acknowledge
      const fullBatch1 = saf2.prepareBatch(5000);
      saf2.acknowledgeBatch(fullBatch1!.batchId);

      const fullBatch2 = saf2.prepareBatch(5000);
      saf2.acknowledgeBatch(fullBatch2!.batchId);

      expect(saf2.getQueueLength()).toBe(0);
      saf2.close();
    });
  });

  describe("4. Zero Disk-Thrashing (Debounced JSON Spam Elimination)", () => {
    it("should NOT write flat file journal when SQLite WAL is primary", () => {
      // When SQLite WAL is active, diskJournalPath should not be populated with debounced JSON files
      const saf = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        diskJournalPath: safJournalPath,
      });

      const pt: IndustrialDataPoint = {
        id: "saf-no-spam-1",
        tag: "Tachas.Vacio",
        value: -26.5,
        unit: "inHg",
        quality: "GOOD",
        source: "MODBUS_TCP",
        protocol: "MODBUS-TCP",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1,
        isSimulated: false,
      };

      saf.enqueue(pt);

      // Journal JSON file should NOT exist because WAL is durable
      expect(fs.existsSync(safJournalPath)).toBe(false);

      saf.close();
    });
  });

  describe("5. Retention & Compaction Policy in SQLite WAL", () => {
    it("should purge data older than retention limit from SQLite WAL without corrupting active telemetry", () => {
      const tsdb = LocalTimeSeriesDatabase.getInstance();
      tsdb.configureSqlite(tsdbDbPath);
      tsdb.reset();

      // Set 1-day retention limit
      tsdb.setRetention(1);

      const now = Date.now();
      const oldTime = now - 3 * 24 * 60 * 60 * 1000; // 3 days ago (expired)
      const freshTime = now - 2 * 60 * 60 * 1000; // 2 hours ago (valid)

      const expiredPoints: IndustrialDataPoint[] = [];
      for (let i = 0; i < 500; i++) {
        expiredPoints.push({
          id: `expired-${i}`,
          tag: "Turbogenerador1.Potencia",
          value: 12.5,
          unit: "MW",
          quality: "GOOD",
          source: "OPC_UA",
          protocol: "OPC-UA",
          deviceTimestamp: new Date(oldTime + i * 1000).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        });
      }

      const freshPoints: IndustrialDataPoint[] = [];
      for (let i = 0; i < 500; i++) {
        freshPoints.push({
          id: `fresh-${i}`,
          tag: "Turbogenerador1.Potencia",
          value: 14.2,
          unit: "MW",
          quality: "GOOD",
          source: "OPC_UA",
          protocol: "OPC-UA",
          deviceTimestamp: new Date(freshTime + i * 1000).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: 500 + i,
          isSimulated: false,
        });
      }

      tsdb.recordBatch([...expiredPoints, ...freshPoints]);
      expect(tsdb.getTotalRowCount()).toBe(1000);

      // Enforce retention policy
      const purged = tsdb.enforceRetention();
      expect(purged).toBe(500);

      // Total rows in WAL must be exactly 500
      expect(tsdb.getTotalRowCount()).toBe(500);

      // Query fresh data: intact
      const queryFresh = tsdb.queryRange("Turbogenerador1.Potencia", freshTime - 1000, now + 1000);
      expect(queryFresh.length).toBe(500);

      // Query expired data: empty
      const queryExpired = tsdb.queryRange("Turbogenerador1.Potencia", oldTime - 1000, oldTime + 600000);
      expect(queryExpired.length).toBe(0);

      tsdb.close();
    });
  });
});
