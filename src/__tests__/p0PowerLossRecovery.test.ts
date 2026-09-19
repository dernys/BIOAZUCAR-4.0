/**
 * BioAzúcar 4.0 — P0-03 Critical Resilience to Unexpected Power Outage (EDG-05)
 * 
 * Verifies:
 * 1. Automatic recovery & B-Tree integrity verification (PRAGMA integrity_check / quick_check).
 * 2. Complete rollback of uncommitted dirty writes under sudden power loss (SIGKILL / power cut).
 * 3. Store & Forward cold recovery: automatic re-queueing of orphaned IN_FLIGHT batches back to PENDING.
 * 4. Poison-pill & torn-write isolation: quarantined corrupted blocks do not halt the SCADA pipeline.
 * 5. LocalTimeSeriesDatabase (TSDB) resilience and accurate chronological query restoration.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteWalEngine } from "../services/edge/storage/SqliteWalEngine";
import { DiskStoreAndForwardEngine } from "../services/edge/DiskStoreAndForwardEngine";
import { LocalTimeSeriesDatabase } from "../services/edge/history/LocalTimeSeriesDatabase";
import { IndustrialDataPoint } from "../types";
import fs from "fs";
import path from "path";

describe("P0-03: Industrial Edge Resilience to Unexpected Power Loss (EDG-05)", () => {
  const testDir = path.join(process.cwd(), "data", "test-power-loss-p0");
  const safDbPath = path.join(testDir, "edge-saf-powerloss.sqlite");
  const tsdbDbPath = path.join(testDir, "edge-tsdb-powerloss.sqlite");

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

  describe("1. SqliteWalEngine Sudden Power Cut & Integrity Verification", () => {
    it("should verify B-Tree integrity and return ok: true on a healthy WAL database", () => {
      const dbPath = path.join(testDir, "wal-integrity.sqlite");
      const engine = new SqliteWalEngine({ dbPath, verifyOnStartup: true });

      expect(engine.isAvailable()).toBe(true);
      expect(engine.isWal()).toBe(true);

      const check = engine.verifyIntegrity();
      expect(check.ok).toBe(true);
      expect(check.details.toLowerCase()).toBe("ok");
      expect(check.durationMs).toBeGreaterThanOrEqual(0);

      engine.close();
    });

    it("should discard uncommitted dirty writes and preserve committed data after abrupt power cut", () => {
      const dbPath = path.join(testDir, "wal-power-cut.sqlite");
      let engine: SqliteWalEngine | null = new SqliteWalEngine({ dbPath });

      engine.exec(`
        CREATE TABLE plc_telemetry (
          tag TEXT PRIMARY KEY,
          val REAL,
          quality TEXT
        );
      `);

      // 1. Write and commit 100 baseline industrial records
      engine.transaction(() => {
        const stmt = engine!.prepare("INSERT INTO plc_telemetry (tag, val, quality) VALUES (?, ?, ?);");
        for (let i = 0; i < 100; i++) {
          stmt.run(`Mill1.Pressure.${i}`, 150.5 + i, "GOOD");
        }
      });

      let countRow = engine.prepare("SELECT COUNT(*) as total FROM plc_telemetry;").get() as any;
      expect(countRow.total).toBe(100);

      // 2. Start an uncommitted transaction and simulate sudden power cut (pulling the plug)
      engine.exec("BEGIN IMMEDIATE;");
      engine.prepare("INSERT INTO plc_telemetry (tag, val, quality) VALUES (?, ?, ?);").run("Mill1.Pressure.TornWrite", 999.9, "BAD");
      
      // Simulate hardware sudden power loss: close raw handle without COMMIT and without graceful checkpoint
      engine.simulateSuddenPowerLoss();
      engine = null;

      // 3. Cold boot: reopen the database from disk
      const rebootEngine = new SqliteWalEngine({ dbPath, verifyOnStartup: true });
      expect(rebootEngine.isAvailable()).toBe(true);

      // Integrity must be 100% verified
      const integrity = rebootEngine.verifyIntegrity(true);
      expect(integrity.ok).toBe(true);

      // The 100 committed records must be intact
      countRow = rebootEngine.prepare("SELECT COUNT(*) as total FROM plc_telemetry;").get() as any;
      expect(countRow.total).toBe(100);

      // The uncommitted dirty record must have been completely rolled back by WAL recovery
      const tornRecord = rebootEngine.prepare("SELECT val FROM plc_telemetry WHERE tag = ?;").get("Mill1.Pressure.TornWrite");
      expect(tornRecord).toBeFalsy();

      rebootEngine.close();
    });

    it("should execute crash recovery checkpoint and report successful synchronization", () => {
      const dbPath = path.join(testDir, "wal-recovery-action.sqlite");
      const engine = new SqliteWalEngine({ dbPath });

      engine.exec("CREATE TABLE audit_log (id TEXT PRIMARY KEY, event TEXT);");
      engine.prepare("INSERT INTO audit_log VALUES (?, ?);").run("evt-1", "OPERATOR_LOGIN");

      const recovery = engine.recoverFromCrash();
      expect(recovery.recovered).toBe(true);
      expect(recovery.integrityOk).toBe(true);
      expect(recovery.checkpointMode).toBe("TRUNCATE");

      engine.close();
    });
  });

  describe("2. Store & Forward Cold Power Loss Recovery (EDG-05)", () => {
    it("should recover orphaned IN_FLIGHT batches back to PENDING upon cold reboot after power cut", () => {
      let safEngine: DiskStoreAndForwardEngine | null = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        persistenceKey: "test_saf_powerloss",
      });

      // Ingest 50 points into the edge store
      const points: IndustrialDataPoint[] = [];
      const baseTs = 1774000000000;
      for (let i = 0; i < 50; i++) {
        points.push({
          id: `pt-saf-${i}`,
          tag: "IngenioCentral.Molienda.Molino1.PresionHidraulica",
          value: 140.0 + i * 0.2,
          quality: "GOOD",
          timestamp: new Date(baseTs + i * 1000).toISOString(),
          deviceTimestamp: new Date(baseTs + i * 1000).toISOString(),
          sequence: i + 1,
        });
      }

      safEngine.enqueueBatch(points);
      expect(safEngine.getQueueLength()).toBe(50);

      // 20 points are dispatched to cloud transmission (status becomes IN_FLIGHT)
      const inFlightBatch = safEngine.prepareBatch(20);
      expect(inFlightBatch).not.toBeNull();
      expect(inFlightBatch?.points.length).toBe(20);

      // 30 remain PENDING in queue, 20 are in flight
      // Sudden power loss occurs BEFORE cloud acknowledgment is received!
      safEngine.simulateSuddenPowerLoss();
      safEngine = null;

      // Machine reboots in cold state
      const rebootSaf = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        persistenceKey: "test_saf_powerloss",
      });

      // Cold power recovery should have automatically rolled back the 20 IN_FLIGHT points back to PENDING
      const recoveryStats = rebootSaf.executeColdPowerRecovery();
      expect(recoveryStats.integrityOk).toBe(true);
      expect(recoveryStats.engine).toBe("SQLITE_WAL");
      
      // All 50 points must be restored in the buffer
      expect(rebootSaf.getQueueLength()).toBe(50);

      // Chronological sequence must be preserved
      const restored = rebootSaf.getBufferedPoints();
      expect(restored[0].sequence).toBe(1);
      expect(restored[49].sequence).toBe(50);

      // All 50 points can now be successfully forwarded and acknowledged
      const forwardBatch = rebootSaf.prepareBatch(50);
      expect(forwardBatch).not.toBeNull();
      expect(forwardBatch?.points.length).toBe(50);

      const ackResult = rebootSaf.acknowledgeBatch(forwardBatch!.batchId);
      expect(ackResult).toBe(true);
      expect(rebootSaf.getQueueLength()).toBe(0);

      rebootSaf.close();
    });

    it("should isolate and quarantine torn / corrupted writes without interrupting queue processing", () => {
      let safEngine: DiskStoreAndForwardEngine | null = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        persistenceKey: "test_saf_torn_write",
      });

      // Enqueue 10 valid telemetry points
      const validPoints: IndustrialDataPoint[] = [];
      for (let i = 0; i < 10; i++) {
        validPoints.push({
          id: `valid-${i}`,
          tag: "IngenioCentral.Difusor.Temperatura",
          value: 78.5,
          quality: "GOOD",
          timestamp: new Date().toISOString(),
          deviceTimestamp: new Date(Date.now() + i).toISOString(),
          sequence: i,
        });
      }
      safEngine.enqueueBatch(validPoints);

      // Simulate a torn partial write created directly in the storage by sudden power cut
      // (e.g. half-flushed sector containing invalid payload)
      const rawEngine = new SqliteWalEngine({ dbPath: safDbPath });
      rawEngine.prepare(`
        INSERT INTO saf_queue (id, point_json, status, created_at, retry_count)
        VALUES (?, ?, 'PENDING', ?, 0);
      `).run("torn-write-id", "TORN_CORRUPTED_NON_JSON_DATA_0xDEADBEEF{{{{", Date.now() - 500);
      rawEngine.close();

      safEngine.simulateSuddenPowerLoss();
      safEngine = null;

      // Re-initialize engine on cold reboot
      const rebootEngine = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        persistenceKey: "test_saf_torn_write",
      });

      const recovery = rebootEngine.getLastRecoveryStats() || rebootEngine.executeColdPowerRecovery();
      expect(recovery.quarantinedCorrupted).toBeGreaterThanOrEqual(1);
      expect(recovery.integrityOk).toBe(true);

      // All 10 valid points must be preserved and operational
      expect(rebootEngine.getQueueLength()).toBe(10);
      const batch = rebootEngine.prepareBatch(10);
      expect(batch?.points.length).toBe(10);
      expect(rebootEngine.acknowledgeBatch(batch!.batchId)).toBe(true);

      rebootEngine.close();
    });
  });

  describe("3. LocalTimeSeriesDatabase Power Loss Resilience", () => {
    it("should survive sudden power cut without TSDB database corruption", () => {
      const tsdb = LocalTimeSeriesDatabase.getInstance();
      tsdb.configureSqlite(tsdbDbPath);
      tsdb.reset();

      const tag = "IngenioCentral.Generacion.TurboGenerador1.PotenciaActivaMW";
      const now = Date.now();

      // Record 200 telemetry points
      for (let i = 0; i < 200; i++) {
        tsdb.record({
          tag,
          value: 12.5 + (i % 5) * 0.1,
          engValue: 12.5 + (i % 5) * 0.1,
          quality: "GOOD",
          timestamp: new Date(now - (200 - i) * 1000).toISOString(),
          deviceTimestamp: new Date(now - (200 - i) * 1000).toISOString(),
          sequence: i,
        });
      }

      // Checkpoint before sudden power cut
      tsdb.flushWal();

      // Simulate power cut
      tsdb.simulateSuddenPowerLoss();

      // Re-open and verify database
      const rebootTsdb = LocalTimeSeriesDatabase.getInstance();
      rebootTsdb.configureSqlite(tsdbDbPath);

      const integrity = rebootTsdb.verifyIntegrity();
      expect(integrity.ok).toBe(true);

      // Query historical data from disk
      const queryBuckets = rebootTsdb.queryRange(tag, now - 300000, now + 1000);
      expect(queryBuckets.length).toBeGreaterThanOrEqual(200);
      const avgVal = queryBuckets.reduce((acc, b) => acc + b.value, 0) / queryBuckets.length;
      expect(avgVal).toBeCloseTo(12.7, 1);

      rebootTsdb.close();
    });
  });
});
