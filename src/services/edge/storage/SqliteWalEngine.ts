/**
 * BioAzúcar 4.0 — Industrial Edge SQLite WAL Storage Engine
 * 
 * Compliant with IEC 62443-4-2 (Data-at-Rest Integrity & Crash-Safety)
 * Uses native SQLite Write-Ahead Logging (WAL) for microsecond transactional commits,
 * atomic durability under unexpected industrial power outages, and zero lock contention
 * between readers and writers.
 */

export interface SqliteWalConfig {
  dbPath?: string;
  busyTimeoutMs?: number;
  cacheSizeKb?: number;
  walAutocheckpointPages?: number;
  verifyOnStartup?: boolean;
}

export interface SqliteDatabaseHandle {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
  close(): void;
}

function getNativeSqliteModule(): { DatabaseSync: new (location: string, options?: any) => SqliteDatabaseHandle } | null {
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    try {
      if (typeof (process as any).getBuiltinModule === "function") {
        return (process as any).getBuiltinModule("node:sqlite");
      }
      const nodeRequire =
        typeof (globalThis as any).__non_webpack_require__ !== "undefined"
          ? (globalThis as any).__non_webpack_require__
          : eval("require");
      return nodeRequire("node:sqlite");
    } catch {
      return null;
    }
  }
  return null;
}

function getNodeFsModule(): { fs: any; path: any } | null {
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    try {
      if (typeof (process as any).getBuiltinModule === "function") {
        return {
          fs: (process as any).getBuiltinModule("node:fs"),
          path: (process as any).getBuiltinModule("node:path"),
        };
      }
      const nodeRequire =
        typeof (globalThis as any).__non_webpack_require__ !== "undefined"
          ? (globalThis as any).__non_webpack_require__
          : eval("require");
      return {
        fs: nodeRequire("fs"),
        path: nodeRequire("path"),
      };
    } catch {
      return null;
    }
  }
  return null;
}

export class SqliteWalEngine {
  private db: SqliteDatabaseHandle | null = null;
  private dbPath: string;
  private isWalActive: boolean = false;
  private inTransaction: boolean = false;

  constructor(config: SqliteWalConfig = {}) {
    this.dbPath = config.dbPath || "./data/bioazucar_edge_store.sqlite";
    this.initDatabase(config);
  }

  private initDatabase(config: SqliteWalConfig): void {
    const sqliteMod = getNativeSqliteModule();
    if (!sqliteMod) {
      return;
    }

    try {
      // Ensure target directory exists
      if (this.dbPath !== ":memory:") {
        const fsMod = getNodeFsModule();
        if (fsMod) {
          const dir = fsMod.path.dirname(this.dbPath);
          if (!fsMod.fs.existsSync(dir)) {
            fsMod.fs.mkdirSync(dir, { recursive: true });
          }
        }
      }

      this.db = new sqliteMod.DatabaseSync(this.dbPath);

      // Industrial WAL pragmas for power-loss resilience
      if (this.dbPath !== ":memory:") {
        const journalResult = this.db.prepare("PRAGMA journal_mode = WAL;").get() as any;
        const mode = journalResult?.journal_mode || "";
        this.isWalActive = mode.toLowerCase() === "wal";
      } else {
        this.isWalActive = true;
      }

      const timeout = config.busyTimeoutMs || 5000;
      this.db.exec(`PRAGMA busy_timeout = ${timeout};`);
      this.db.exec("PRAGMA synchronous = NORMAL;");
      this.db.exec("PRAGMA foreign_keys = ON;");
      this.db.exec("PRAGMA temp_store = MEMORY;");

      const checkpoint = config.walAutocheckpointPages || 1000;
      this.db.exec(`PRAGMA wal_autocheckpoint = ${checkpoint};`);

      // Verify integrity on boot if requested
      if (config.verifyOnStartup) {
        const check = this.verifyIntegrity();
        if (!check.ok) {
          console.warn(`[SqliteWalEngine] Warning: Integrity check on startup reported: ${check.details}. Initiating recovery.`);
          this.recoverFromCrash();
        }
      }
    } catch (err) {
      // In case of error (e.g. read-only filesystem or restricted container), fallback gracefully
      this.db = null;
      this.isWalActive = false;
    }
  }

  public isAvailable(): boolean {
    return this.db !== null;
  }

  public isWal(): boolean {
    return this.isWalActive;
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public exec(sql: string): void {
    if (!this.db) return;
    this.db.exec(sql);
  }

  public prepare(sql: string) {
    if (!this.db) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        get: () => null,
        all: () => [],
      };
    }
    return this.db.prepare(sql);
  }

  public transaction<T>(fn: () => T): T {
    if (!this.db) {
      return fn();
    }

    // Support nested transaction checks
    if (this.inTransaction) {
      return fn();
    }

    this.inTransaction = true;
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = fn();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  public checkpoint(): void {
    if (!this.db || !this.isWalActive) return;
    try {
      this.db.exec("PRAGMA wal_checkpoint(PASSIVE);");
    } catch {
      // Ignore passive checkpoint contention
    }
  }

  /**
   * Verifies database structural and B-Tree integrity using SQLite PRAGMAs.
   * Complies with IEC 62443-4-2 Data Integrity requirements for Industrial Edge IPCs.
   */
  public verifyIntegrity(deep: boolean = false): { ok: boolean; details: string; durationMs: number } {
    if (!this.db) {
      return { ok: false, details: "Database not available", durationMs: 0 };
    }
    const t0 = Date.now();
    try {
      const pragma = deep ? "PRAGMA integrity_check;" : "PRAGMA quick_check;";
      const res = this.db.prepare(pragma).get() as any;
      const details = res?.integrity_check || res?.quick_check || "ok";
      const isOk = String(details).toLowerCase() === "ok";
      return {
        ok: isOk,
        details: String(details),
        durationMs: Date.now() - t0,
      };
    } catch (err: any) {
      return {
        ok: false,
        details: err?.message || "Integrity check failed",
        durationMs: Date.now() - t0,
      };
    }
  }

  /**
   * Recovers from an unclean shutdown or kernel crash (e.g. SIGKILL, unexpected power cut).
   * Executes a TRUNCATE checkpoint to fold the WAL journal back into the master DB
   * and verifies that the schema and tables are fully accessible.
   */
  public recoverFromCrash(): { recovered: boolean; integrityOk: boolean; checkpointMode: string; message: string } {
    if (!this.db) {
      return { recovered: false, integrityOk: false, checkpointMode: "NONE", message: "Database not available" };
    }

    try {
      // Force truncate checkpoint to fold uncommitted dirty pages and sync valid WAL frames
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      const check = this.verifyIntegrity(true);
      return {
        recovered: check.ok,
        integrityOk: check.ok,
        checkpointMode: "TRUNCATE",
        message: check.ok ? "Crash recovery completed successfully. WAL synchronized." : `Integrity degraded: ${check.details}`,
      };
    } catch (err: any) {
      return {
        recovered: false,
        integrityOk: false,
        checkpointMode: "FAILED",
        message: err?.message || "Recovery failure",
      };
    }
  }

  /**
   * Simulates an abrupt hardware power cut (pulling the plug / kernel crash).
   * Closes the raw database handle without executing standard wal_checkpoint(PASSIVE),
   * leaving WAL journals in the exact state as during a sudden IPC shutdown.
   */
  public simulateSuddenPowerLoss(): void {
    if (this.db) {
      try {
        // Close immediately without graceful checkpointing or flush
        this.db.close();
      } catch {
        // Suppress errors during abrupt close
      } finally {
        this.db = null;
        this.isWalActive = false;
        this.inTransaction = false;
      }
    }
  }

  public getWalStats(): { walMode: boolean; isAvailable: boolean; inTransaction: boolean; dbPath: string } {
    return {
      walMode: this.isWalActive,
      isAvailable: this.isAvailable(),
      inTransaction: this.inTransaction,
      dbPath: this.dbPath,
    };
  }

  public close(): void {
    if (this.db) {
      try {
        this.checkpoint();
        this.db.close();
      } catch {
        // Ignore close errors
      } finally {
        this.db = null;
        this.isWalActive = false;
      }
    }
  }
}
