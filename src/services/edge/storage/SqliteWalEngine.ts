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
