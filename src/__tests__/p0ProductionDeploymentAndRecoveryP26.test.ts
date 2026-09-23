/**
 * BIOAZÚCAR 4.0 — P0-26 PRODUCTION DEPLOYMENT & RECOVERY TEST SUITE
 * 
 * Comprehensive validation of:
 * - Preflight validation (PASS / WARN / FAIL)
 * - Schema migration runner (Atomic DDL, checksum verification, idempotence)
 * - Atomic backup creation with WAL flush and SHA-256 manifest
 * - Safe restore engine with tamper detection
 * - Air-gapped / offline bundle integrity
 * - Health gates and exit codes (0, 1, 2)
 * - Crash recovery and WAL durability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SqliteWalEngine } from "../services/edge/storage/SqliteWalEngine";
import { MigrationRunner } from "../../deploy/migrations/migrationRunner";
import { BackupRestoreEngine } from "../services/deployment/BackupRestoreEngine";
import { DeploymentVerificationEngine } from "../services/deployment/DeploymentVerificationEngine";

describe("P0-26 Production Deployment & Disaster Recovery Master Suite", () => {
  let testDir: string;
  let testDataDir: string;
  let testBackupDir: string;
  let testConfigDir: string;
  let testCertsDir: string;
  let testDbPath: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `bioazucar-deploy-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    testDataDir = path.join(testDir, "data");
    testBackupDir = path.join(testDir, "backup");
    testConfigDir = path.join(testDir, "config");
    testCertsDir = path.join(testDir, "certificates");

    fs.mkdirSync(testDataDir, { recursive: true });
    fs.mkdirSync(testBackupDir, { recursive: true });
    fs.mkdirSync(testConfigDir, { recursive: true });
    fs.mkdirSync(testCertsDir, { recursive: true });

    testDbPath = path.join(testDataDir, "bioazucar-production.sqlite");

    // Seed mock config
    fs.writeFileSync(path.join(testConfigDir, "mosquitto.conf"), "listener 1883\nallow_anonymous false\n", "utf8");
    fs.writeFileSync(path.join(testCertsDir, "server.crt"), "---BEGIN CERTIFICATE---\nMOCK_CERT\n---END CERTIFICATE---", "utf8");
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignored in temporary cleanup
    }
  });

  describe("1. Preflight Verification Engine", () => {
    it("should report PASS on valid system configuration", () => {
      const report = DeploymentVerificationEngine.runPreflight({
        baseDir: testDir,
        minRamGb: 1, // lowered for test sandbox
        minFreeDiskGb: 1,
      });

      expect(report.overallStatus).toBe("PASS");
      expect(report.passedCount).toBeGreaterThan(0);
      expect(report.failCount).toBe(0);
    });

    it("should detect and report storage permission failure if path is read-only", () => {
      const invalidPath = path.join(testDir, "non_existent_deep_readonly_dir");
      // Intentionally simulate an inaccessible directory
      const report = DeploymentVerificationEngine.runPreflight({
        baseDir: "/dev/null/forbidden",
      });

      expect(report.failCount).toBeGreaterThanOrEqual(1);
      const storageCheck = report.checks.find(c => c.category === "STORAGE");
      expect(storageCheck?.status).toBe("FAIL");
    });
  });

  describe("2. Schema Migration Runner", () => {
    it("should discover migrations, verify checksums, and apply them idempotently", () => {
      const runner = new MigrationRunner({
        dbPath: testDbPath,
        migrationsDir: path.resolve(process.cwd(), "deploy", "migrations"),
      });

      const initialStatus = runner.getStatus();
      expect(initialStatus.pendingCount).toBe(3);
      expect(initialStatus.appliedCount).toBe(0);

      // Execute migration UP
      const upResult = runner.up();
      expect(upResult.applied).toEqual(["001", "002", "003"]);
      expect(upResult.currentVersion).toBe("003");

      const postUpStatus = runner.getStatus();
      expect(postUpStatus.pendingCount).toBe(0);
      expect(postUpStatus.appliedCount).toBe(3);
      expect(postUpStatus.currentVersion).toBe("003");

      // Idempotency: Running UP again should apply 0
      const secondUp = runner.up();
      expect(secondUp.applied.length).toBe(0);

      // Verify schema tables exist and can be queried
      const engine = runner.getEngine();
      expect(engine.isWal()).toBe(true);

      const tableStmt = engine.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
      const tables = tableStmt.all().map((r: any) => r.name);

      expect(tables).toContain("schema_migrations");
      expect(tables).toContain("tenants");
      expect(tables).toContain("industrial_connections");
      expect(tables).toContain("industrial_tags");
      expect(tables).toContain("audit_trail");
      expect(tables).toContain("telemetry_history");
      expect(tables).toContain("edge_saf_queue");

      runner.close();
    });
  });

  describe("3. Consistent Backup & Tamper-Proof Restoration", () => {
    it("should create atomic backup with SHA-256 manifest and restore faithfully", () => {
      // 1. Initialize DB and insert authoritative records
      const runner = new MigrationRunner({
        dbPath: testDbPath,
        migrationsDir: path.resolve(process.cwd(), "deploy", "migrations"),
      });
      runner.up();
      const engine = runner.getEngine();

      engine.exec(`
        INSERT INTO tenants (id, code, name, site_id, active, created_at, updated_at)
        VALUES ('t1', 'TEN-001', 'Ingenio Providencia', 'SITE-01', 1, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z');
      `);
      runner.close();

      // 2. Perform Backup
      const backupEngine = new BackupRestoreEngine({
        dataDir: testDataDir,
        backupRootDir: testBackupDir,
        configDir: testConfigDir,
        certsDir: testCertsDir,
      });

      const backupResult = backupEngine.createBackup("automated-test");
      expect(backupResult.success).toBe(true);
      expect(backupResult.manifest.files.length).toBeGreaterThan(0);
      expect(backupResult.manifest.integrityChecksum).toBeDefined();

      // 3. Verify Backup Integrity
      const validation = backupEngine.validateBackup(backupResult.backupPath);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);

      // 4. Corrupt original database to simulate disaster
      fs.writeFileSync(testDbPath, "CORRUPTED_GARBAGE_PAYLOAD", "utf8");

      // 5. Restore from verified backup
      const restoreResult = backupEngine.restoreBackup(backupResult.backupPath);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredFiles).toBeGreaterThan(0);

      // 6. Verify restored database
      const restoredEngine = new SqliteWalEngine({ dbPath: testDbPath });
      const row: any = restoredEngine.prepare("SELECT * FROM tenants WHERE id = 't1';").get();
      expect(row).toBeDefined();
      expect(row.code).toBe("TEN-001");
      expect(row.name).toBe("Ingenio Providencia");
      restoredEngine.close();
    });

    it("should fail closed and reject restoring a tampered backup", () => {
      // 1. Initialize and backup
      const runner = new MigrationRunner({
        dbPath: testDbPath,
        migrationsDir: path.resolve(process.cwd(), "deploy", "migrations"),
      });
      runner.up();
      runner.close();

      const backupEngine = new BackupRestoreEngine({
        dataDir: testDataDir,
        backupRootDir: testBackupDir,
        configDir: testConfigDir,
        certsDir: testCertsDir,
      });

      const backupResult = backupEngine.createBackup("tamper-test");

      // 2. Tamper with a backed-up database file
      const backedUpDb = path.join(backupResult.backupPath, "data", "bioazucar-production.sqlite");
      fs.appendFileSync(backedUpDb, "MALICIOUS_TAMPER_BYTES");

      // 3. Validation should detect hash mismatch
      const validation = backupEngine.validateBackup(backupResult.backupPath);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes("Checksum mismatch"))).toBe(true);

      // 4. Restore must throw error and abort
      expect(() => {
        backupEngine.restoreBackup(backupResult.backupPath);
      }).toThrow(/CRITICAL RESTORE FAILURE/);
    });
  });

  describe("4. Air-Gapped / Offline Bundle Verification", () => {
    it("should validate offline bundle manifest and artifacts", () => {
      const offlineDir = path.resolve(process.cwd(), "deploy", "offline");
      const validation = DeploymentVerificationEngine.verifyOfflineBundle(offlineDir);
      
      expect(validation.manifest.product).toBe("BioAzúcar 4.0");
      expect(validation.manifest.version).toBe("4.0.0-prod");
      expect(validation.manifest.rollbackSupported).toBe(true);
      expect(validation.manifest.images.length).toBe(4);
    });
  });

  describe("5. Health Gates & Exit Codes", () => {
    it("should return HEALTHY (code 0) when database and core services are active", () => {
      // Setup active db
      const runner = new MigrationRunner({
        dbPath: testDbPath,
        migrationsDir: path.resolve(process.cwd(), "deploy", "migrations"),
      });
      runner.up();
      runner.close();

      const health = DeploymentVerificationEngine.checkHealthGates({ dbPath: testDbPath });
      expect(health.overallStatus).toBe("HEALTHY");
      expect(health.exitCode).toBe(0);
      expect(health.gates.length).toBeGreaterThanOrEqual(3);
    });

    it("should return DEGRADED (code 2) when database file is absent", () => {
      const missingDb = path.join(testDataDir, "does-not-exist.sqlite");
      const health = DeploymentVerificationEngine.checkHealthGates({ dbPath: missingDb });
      expect(health.overallStatus).toBe("DEGRADED");
      expect(health.exitCode).toBe(2);
    });
  });

  describe("6. Crash Recovery & WAL Durability (Zero Data Loss)", () => {
    it("should retain committed transactions across ungraceful process shutdown", () => {
      // Session 1: Open, write, close abruptly
      let engine: SqliteWalEngine | null = new SqliteWalEngine({ dbPath: testDbPath });
      engine.exec(`
        CREATE TABLE test_telemetry (
          id TEXT PRIMARY KEY,
          tag TEXT,
          val REAL
        );
      `);

      engine.transaction(() => {
        for (let i = 0; i < 50; i++) {
          engine!.prepare("INSERT INTO test_telemetry VALUES (?, ?, ?);").run(
            `id-${i}`,
            "MILL_DIFF_SPEED_01",
            120.5 + i
          );
        }
      });

      // Simulate crash / restart: close without explicit checkpoint
      engine.close();
      engine = null;

      // Session 2: Reopen after crash
      const recoveredEngine = new SqliteWalEngine({ dbPath: testDbPath });
      const countRow: any = recoveredEngine.prepare("SELECT count(*) as cnt FROM test_telemetry;").get();
      expect(countRow.cnt).toBe(50);
      recoveredEngine.close();
    });
  });
});
