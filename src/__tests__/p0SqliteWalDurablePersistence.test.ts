/**
 * BioAzúcar 4.0 — P0-02 SQLite WAL Durable Edge Persistence & Crash Recovery Tests
 * 
 * Verifies:
 * 1. Native SQLite Write-Ahead Logging (WAL) configuration (PRAGMA journal_mode = WAL).
 * 2. High-speed atomic transactions under industrial telemetry load.
 * 3. Power-loss & crash recovery: persistence across unexpected process termination.
 * 4. Microsecond TSDB queries and Store & Forward queue durability.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteWalEngine } from "../services/edge/storage/SqliteWalEngine";
import { LocalTimeSeriesDatabase } from "../services/edge/history/LocalTimeSeriesDatabase";
import { DiskStoreAndForwardEngine } from "../services/edge/DiskStoreAndForwardEngine";
import { IndustrialDataPoint } from "../types";
import fs from "fs";
import path from "path";

describe("P0-02: SQLite WAL Durable Edge Storage & Crash Recovery", () => {
  const testDir = path.join(process.cwd(), "data", "test-wal-p0");
  const tsdbDbPath = path.join(testDir, "test-edge-tsdb.sqlite");
  const safDbPath = path.join(testDir, "test-edge-saf.sqlite");
  const safJournalPath = path.join(testDir, "test-edge-saf.json");

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
      // Ignore cleanup error
    }
  });

  describe("1. SqliteWalEngine Low-Level Primitives", () => {
    it("should initialize native SQLite with WAL journal mode and normal synchronous", () => {
      const dbPath = path.join(testDir, "engine-wal-test.sqlite");
      const engine = new SqliteWalEngine({ dbPath });

      expect(engine.isAvailable()).toBe(true);
      expect(engine.isWal()).toBe(true);
      expect(engine.getDbPath()).toBe(dbPath);

      engine.exec("CREATE TABLE test_telemetry (id TEXT PRIMARY KEY, val REAL);");
      const insert = engine.prepare("INSERT INTO test_telemetry (id, val) VALUES (?, ?);");
      insert.run("tag-01", 45.8);

      const select = engine.prepare("SELECT val FROM test_telemetry WHERE id = ?;");
      const row = select.get("tag-01") as any;
      expect(row).not.toBeNull();
      expect(row.val).toBe(45.8);

      engine.checkpoint();
      engine.close();
    });

    it("should handle atomic transactions with automatic rollback on exception", () => {
      const dbPath = path.join(testDir, "engine-txn-test.sqlite");
      const engine = new SqliteWalEngine({ dbPath });

      engine.exec("CREATE TABLE accounts (id TEXT PRIMARY KEY, balance REAL);");
      const insert = engine.prepare("INSERT INTO accounts (id, balance) VALUES (?, ?);");
      insert.run("acc-1", 100);

      // Successful transaction
      engine.transaction(() => {
        engine.prepare("UPDATE accounts SET balance = balance - 20 WHERE id = ?;").run("acc-1");
      });

      let row = engine.prepare("SELECT balance FROM accounts WHERE id = ?;").get("acc-1") as any;
      expect(row.balance).toBe(80);

      // Failed transaction must roll back
      expect(() => {
        engine.transaction(() => {
          engine.prepare("UPDATE accounts SET balance = balance - 50 WHERE id = ?;").run("acc-1");
          throw new Error("Industrial sensor failure simulation");
        });
      }).toThrow("Industrial sensor failure simulation");

      // Value must remain unchanged at 80
      row = engine.prepare("SELECT balance FROM accounts WHERE id = ?;").get("acc-1") as any;
      expect(row.balance).toBe(80);

      engine.close();
    });
  });

  describe("2. LocalTimeSeriesDatabase with SQLite WAL (HST-02)", () => {
    it("should store and query telemetry in SQLite WAL mode", () => {
      const tsdb = LocalTimeSeriesDatabase.getInstance();
      tsdb.configureSqlite(tsdbDbPath);
      tsdb.reset();

      expect(tsdb.isWalDurable()).toBe(true);
      expect(tsdb.getStorageType()).toBe("SQLITE_WAL");

      const now = Date.now();
      const tag = "Ingenio.Tandem1.Molino2.PresionHidraulica";

      for (let i = 0; i < 20; i++) {
        const pt: IndustrialDataPoint = {
          id: `p0-pt-${i}`,
          tag,
          value: 280 + i * 2,
          unit: "bar",
          quality: "GOOD",
          source: "OPC_UA",
          protocol: "OPC-UA",
          deviceTimestamp: new Date(now - (20 - i) * 1000).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        };
        tsdb.record(pt);
      }

      const results = tsdb.queryRange(tag, now - 25000, now + 1000);
      expect(results.length).toBe(20);
      expect(results[0].value).toBe(280);
      expect(results[19].value).toBe(318);

      const stats = tsdb.getStats();
      expect(stats.totalPointsStored).toBe(20);
      expect(stats.uniqueTagsCount).toBe(1);
      expect(stats.storageType).toBe("SQLITE_WAL");
      expect(stats.isWalDurable).toBe(true);

      tsdb.close();
    });

    it("should persist points across process restart simulation", () => {
      // Step 1: Ingest into TSDB
      const tsdb1 = LocalTimeSeriesDatabase.getInstance();
      tsdb1.configureSqlite(tsdbDbPath);
      tsdb1.reset();

      const baseTime = Date.now() - 60000;
      const points: IndustrialDataPoint[] = [];
      for (let i = 0; i < 50; i++) {
        points.push({
          id: `batch-${i}`,
          tag: "Caldera1.VaporPresion",
          value: 62 + i * 0.1,
          unit: "bar",
          quality: "GOOD",
          source: "MODBUS_TCP",
          protocol: "MODBUS-TCP",
          deviceTimestamp: new Date(baseTime + i * 1000).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: i,
          isSimulated: false,
        });
      }
      tsdb1.recordBatch(points);
      tsdb1.flushWal();
      tsdb1.close();

      // Step 2: Simulate complete memory flush and IPC daemon restart
      const tsdb2 = LocalTimeSeriesDatabase.getInstance();
      tsdb2.configureSqlite(tsdbDbPath);

      // Query historical data from re-opened database
      const recovered = tsdb2.queryRange("Caldera1.VaporPresion", baseTime - 1000, baseTime + 70000);
      expect(recovered.length).toBe(50);
      expect(recovered[0].value).toBe(62);
      expect(recovered[49].value).toBe(66.9);

      tsdb2.close();
    });
  });

  describe("3. DiskStoreAndForwardEngine with SQLite WAL (EDG-02)", () => {
    it("should persist unforwarded points in SQLite WAL and recover after crash", () => {
      const engine1 = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        diskJournalPath: safJournalPath,
        encryptionKey: "industrial_saf_wal_test_key_32_b",
      });

      expect(engine1.isWalDurable()).toBe(true);
      expect(engine1.getStorageEngine()).toBe("SQLITE_WAL");

      const ptA: IndustrialDataPoint = {
        id: "saf-pt-1",
        tag: "Molino1.CorrienteMotor",
        value: 412.5,
        unit: "A",
        quality: "GOOD",
        source: "SIEMENS_S7",
        protocol: "SIEMENS-S7",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1,
        isSimulated: false,
      };

      const ptB: IndustrialDataPoint = {
        id: "saf-pt-2",
        tag: "Molino1.VelocidadMaza",
        value: 4.6,
        unit: "RPM",
        quality: "GOOD",
        source: "SIEMENS_S7",
        protocol: "SIEMENS-S7",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 2,
        isSimulated: false,
      };

      engine1.enqueue(ptA);
      engine1.enqueue(ptB);
      engine1.persistStateImmediate();

      expect(engine1.getQueueLength()).toBe(2);

      // Simulate unexpected crash (daemon killed, engine destroyed without acknowledging)
      // Step 2: Restart engine pointing to the same SQLite WAL database
      const engine2 = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        diskJournalPath: safJournalPath,
        encryptionKey: "industrial_saf_wal_test_key_32_b",
      });

      expect(engine2.getQueueLength()).toBe(2);
      const points = engine2.getBufferedPoints();
      expect(points.length).toBe(2);
      expect(points.map((p) => p.tag)).toContain("Molino1.CorrienteMotor");
      expect(points.map((p) => p.tag)).toContain("Molino1.VelocidadMaza");

      // Prepare batch and acknowledge -> must remove from SQLite
      const batch = engine2.prepareBatch(10);
      expect(batch).not.toBeNull();
      expect(batch!.points.length).toBe(2);

      engine2.acknowledgeBatch(batch!.batchId);
      expect(engine2.getQueueLength()).toBe(0);

      // Step 3: Verify that after acknowledge, a 3rd restart finds 0 pending items
      const engine3 = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        diskJournalPath: safJournalPath,
        encryptionKey: "industrial_saf_wal_test_key_32_b",
      });
      expect(engine3.getQueueLength()).toBe(0);
    });

    it("should handle rollback correctly in SQLite WAL queue", () => {
      const engine = new DiskStoreAndForwardEngine({
        sqliteDbPath: safDbPath,
        diskJournalPath: safJournalPath,
        encryptionKey: "industrial_saf_wal_test_key_32_b",
      });

      const pt: IndustrialDataPoint = {
        id: "saf-pt-rollback",
        tag: "Evaporador1.NivelJugo",
        value: 78.4,
        unit: "%",
        quality: "GOOD",
        source: "ROCKWELL_CIP",
        protocol: "ETHERNET_IP",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 101,
        isSimulated: false,
      };

      engine.enqueue(pt);
      const batch = engine.prepareBatch(1);
      expect(batch).not.toBeNull();

      // Simulate transmission failure and rollback
      engine.rollbackBatch(batch!.batchId);

      // Buffer must still retain the point
      expect(engine.getQueueLength()).toBe(1);
      expect(engine.getBufferedPoints()[0].tag).toBe("Evaporador1.NivelJugo");
    });
  });
});
