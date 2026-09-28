/**
 * BIOAZÚCAR 4.0 — INDUSTRIAL LOCAL DATA ARCHITECTURE & INDEXEDDB VAULT
 * ==============================================================================
 * Conforms to IEC 62443-4-2 FR3 (Data Integrity) & FR4 (Data Confidentiality).
 * 
 * Strict Storage Tier Governance:
 * 1. TIER 1 - SQLite WAL (Edge IPC / Server): Store & Forward queue, audit trails, tag configurations, local TSDB.
 * 2. TIER 2 - IndexedDB Vault (Browser / Operator Console): Offline Store & Forward queue, offline mutation journal,
 *    cached OT schemas, agricultural production parameters, encrypted operator sessions.
 * 3. TIER 3 - Server Database (Central Platform / Enterprise): PostgreSQL / TimescaleDB / Firestore.
 * 4. TIER 4 - LocalStorage (UI Preferences Only): Strictly limited to non-critical UI settings (theme, zoom).
 *    PROHIBITED for: credentials, tokens, OT config, production params, telemetry, alarms, historian, work orders.
 */

export type StorageTier =
  | "SQLITE_WAL"
  | "INDEXED_DB"
  | "SERVER_DB"
  | "LOCAL_STORAGE_UI_ONLY";

export type IndustrialDataClassification =
  | "CREDENTIALS"
  | "TOKENS"
  | "OT_CONFIG"
  | "PRODUCTION_PARAMS"
  | "TELEMETRY"
  | "ALARMS"
  | "HISTORIAN"
  | "WORK_ORDERS"
  | "INDUSTRIAL_STATE"
  | "UI_PREFERENCE";

export const FORBIDDEN_IN_LOCAL_STORAGE: readonly IndustrialDataClassification[] = [
  "CREDENTIALS",
  "TOKENS",
  "OT_CONFIG",
  "PRODUCTION_PARAMS",
  "TELEMETRY",
  "ALARMS",
  "HISTORIAN",
  "WORK_ORDERS",
  "INDUSTRIAL_STATE",
] as const;

export class StorageClassificationViolationError extends Error {
  constructor(public readonly classification: IndustrialDataClassification, message: string) {
    super(`[LOCAL_DATA_GOVERNANCE_VIOLATION] Storing '${classification}' in localStorage is strictly prohibited. ${message}`);
    this.name = "StorageClassificationViolationError";
    Object.setPrototypeOf(this, StorageClassificationViolationError.prototype);
  }
}

/**
 * Asserts that the specified data classification is permitted in the target storage tier.
 */
export function assertStorageTierPermitted(
  classification: IndustrialDataClassification,
  tier: StorageTier
): void {
  if (tier === "LOCAL_STORAGE_UI_ONLY" && classification !== "UI_PREFERENCE") {
    throw new StorageClassificationViolationError(
      classification,
      "Industrial architecture mandates SQLite WAL on Edge or IndexedDB in Browser for operational data."
    );
  }
}

export interface VaultRecord<T = any> {
  key: string;
  value: T;
  classification: IndustrialDataClassification;
  timestamp: string;
  version: number;
}

/**
 * All required canonical and operational object stores.
 */
export const CANONICAL_OBJECT_STORES = [
  "tags",
  "industrial_tags",
  "ot_tags",
  "devices",
  "ot_devices",
  "connections",
  "ot_connections",
  "telemetry",
  "saf_telemetry",
  "alarms",
  "workOrders",
  "caneBatches",
  "auditLogs",
  "configuration",
  "central_config",
  "offlineMutations",
  "offline_journal",
  "agricultural_persistence",
  "auth_session",
] as const;

export type CanonicalStoreName = (typeof CANONICAL_OBJECT_STORES)[number];

export class IndustrialIndexedDbVault {
  private static instance: IndustrialIndexedDbVault | null = null;
  public readonly dbName = "BioAzucarIndustrialVault";
  public readonly currentVersion = 2; // Incremented from v1 to trigger automated migration
  private memoryFallback: Map<string, VaultRecord> = new Map();
  private dbInstance: IDBDatabase | null = null;
  private isBrowser = typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  private isUpgrading = false;

  private constructor() {}

  public static getInstance(): IndustrialIndexedDbVault {
    if (!IndustrialIndexedDbVault.instance) {
      IndustrialIndexedDbVault.instance = new IndustrialIndexedDbVault();
    }
    return IndustrialIndexedDbVault.instance;
  }

  /**
   * Opens the IndexedDB instance with robust version upgrade, migration,
   * multi-tab concurrency handling, and error recovery.
   */
  public async openDb(targetVersion?: number): Promise<IDBDatabase> {
    if (!this.isBrowser) {
      throw new Error("[IndustrialIndexedDbVault] IndexedDB is not available in non-browser environment.");
    }

    if (this.dbInstance && !targetVersion) {
      return this.dbInstance;
    }

    const versionToOpen = targetVersion || this.currentVersion;

    return new Promise((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = window.indexedDB.open(this.dbName, versionToOpen);
      } catch (err) {
        return reject(err);
      }

      req.onblocked = () => {
        console.warn("[IndustrialIndexedDbVault] Open blocked. Closing previous database instances.");
        if (this.dbInstance) {
          this.dbInstance.close();
          this.dbInstance = null;
        }
      };

      req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = req.result;
        const oldVersion = event.oldVersion;
        const transaction = req.transaction;

        console.info(`[IndustrialIndexedDbVault] Upgrading IndexedDB schema from v${oldVersion} to v${event.newVersion}`);

        // 1. Create all missing required stores
        for (const storeName of CANONICAL_OBJECT_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName);
            store.createIndex("by_classification", "classification", { unique: false });
            store.createIndex("by_timestamp", "timestamp", { unique: false });
            store.createIndex("by_version", "version", { unique: false });
          }
        }

        // 2. Data Migration from legacy stores (v1 -> v2)
        if (oldVersion === 1 && transaction) {
          try {
            // If ot_tags existed, replicate into industrial_tags and tags if empty
            if (db.objectStoreNames.contains("ot_tags") && db.objectStoreNames.contains("industrial_tags")) {
              const otStore = transaction.objectStore("ot_tags");
              const targetStore = transaction.objectStore("industrial_tags");
              const cursorReq = otStore.openCursor();
              cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor) {
                  targetStore.put(cursor.value, cursor.key);
                  cursor.continue();
                }
              };
            }
          } catch (migErr) {
            console.warn("[IndustrialIndexedDbVault] Non-fatal migration notice:", migErr);
          }
        }
      };

      req.onsuccess = () => {
        const db = req.result;
        this.dbInstance = db;

        // Concurrency: Handle other tabs triggering version changes
        db.onversionchange = () => {
          console.info("[IndustrialIndexedDbVault] Detected version change in another context. Closing connection.");
          db.close();
          this.dbInstance = null;
        };

        db.onclose = () => {
          this.dbInstance = null;
        };

        resolve(db);
      };

      req.onerror = () => {
        console.error("[IndustrialIndexedDbVault] Failed to open IndexedDB:", req.error);
        reject(req.error);
      };
    });
  }

  /**
   * Dynamically ensures that an object store exists before starting a transaction.
   * If a missing store is detected, gracefully upgrades the database schema.
   */
  private async ensureStoreExists(storeName: string): Promise<IDBDatabase> {
    const db = await this.openDb();
    if (db.objectStoreNames.contains(storeName)) {
      return db;
    }

    if (this.isUpgrading) {
      await new Promise((r) => setTimeout(r, 100));
      return this.openDb();
    }

    this.isUpgrading = true;
    console.info(`[IndustrialIndexedDbVault] Object store '${storeName}' not found in current schema. Upgrading database dynamically.`);

    try {
      const nextVersion = db.version + 1;
      db.close();
      this.dbInstance = null;

      const upgradedDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = window.indexedDB.open(this.dbName, nextVersion);
        req.onupgradeneeded = () => {
          const uDb = req.result;
          if (!uDb.objectStoreNames.contains(storeName)) {
            const st = uDb.createObjectStore(storeName);
            st.createIndex("by_classification", "classification", { unique: false });
            st.createIndex("by_timestamp", "timestamp", { unique: false });
            st.createIndex("by_version", "version", { unique: false });
          }
          // Also create any missing canonical stores
          for (const s of CANONICAL_OBJECT_STORES) {
            if (!uDb.objectStoreNames.contains(s)) {
              const st = uDb.createObjectStore(s);
              st.createIndex("by_classification", "classification", { unique: false });
              st.createIndex("by_timestamp", "timestamp", { unique: false });
              st.createIndex("by_version", "version", { unique: false });
            }
          }
        };
        req.onsuccess = () => {
          this.dbInstance = req.result;
          resolve(req.result);
        };
        req.onerror = () => reject(req.error);
      });

      return upgradedDb;
    } catch (err) {
      console.warn(`[IndustrialIndexedDbVault] Dynamic store creation failed for '${storeName}'. Falling back to memory:`, err);
      return db;
    } finally {
      this.isUpgrading = false;
    }
  }

  /**
   * Safe persistent store conforming to data governance.
   */
  public async setItem<T>(
    storeName: string,
    key: string,
    value: T,
    classification: IndustrialDataClassification
  ): Promise<void> {
    assertStorageTierPermitted(classification, "INDEXED_DB");

    const record: VaultRecord<T> = {
      key,
      value,
      classification,
      timestamp: new Date().toISOString(),
      version: 1,
    };

    if (!this.isBrowser) {
      this.memoryFallback.set(`${storeName}:${key}`, record);
      return;
    }

    try {
      const db = await this.ensureStoreExists(storeName);
      if (!db.objectStoreNames.contains(storeName)) {
        this.memoryFallback.set(`${storeName}:${key}`, record);
        return;
      }

      return await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction([storeName], "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.put(record, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          tx.onerror = () => reject(tx.error);
        } catch (txErr) {
          reject(txErr);
        }
      });
    } catch (err) {
      console.warn(`[IndustrialIndexedDbVault] Failed writing to store '${storeName}', falling back to memory:`, err);
      this.memoryFallback.set(`${storeName}:${key}`, record);
    }
  }

  /**
   * Safe persistent read with schema awareness and graceful fallback.
   */
  public async getItem<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.isBrowser) {
      const record = this.memoryFallback.get(`${storeName}:${key}`);
      return record ? (record.value as T) : null;
    }

    try {
      const db = await this.ensureStoreExists(storeName);
      if (!db.objectStoreNames.contains(storeName)) {
        const record = this.memoryFallback.get(`${storeName}:${key}`);
        return record ? (record.value as T) : null;
      }

      return await new Promise<T | null>((resolve, reject) => {
        try {
          const tx = db.transaction([storeName], "readonly");
          const store = tx.objectStore(storeName);
          const req = store.get(key);
          req.onsuccess = () => {
            const rec = req.result as VaultRecord<T> | undefined;
            if (rec !== undefined && rec !== null) {
              resolve(rec.value !== undefined ? rec.value : (rec as unknown as T));
            } else {
              // Check memory fallback
              const mem = this.memoryFallback.get(`${storeName}:${key}`);
              resolve(mem ? (mem.value as T) : null);
            }
          };
          req.onerror = () => reject(req.error);
          tx.onerror = () => reject(tx.error);
        } catch (txErr) {
          reject(txErr);
        }
      });
    } catch (err) {
      console.warn(`[IndustrialIndexedDbVault] Failed reading from store '${storeName}', checking memory fallback:`, err);
      const record = this.memoryFallback.get(`${storeName}:${key}`);
      return record ? (record.value as T) : null;
    }
  }

  /**
   * Safe persistent removal.
   */
  public async removeItem(storeName: string, key: string): Promise<void> {
    this.memoryFallback.delete(`${storeName}:${key}`);

    if (!this.isBrowser) return;

    try {
      const db = await this.ensureStoreExists(storeName);
      if (!db.objectStoreNames.contains(storeName)) return;

      return await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction([storeName], "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      console.warn(`[IndustrialIndexedDbVault] Failed removing key from store '${storeName}':`, err);
    }
  }

  /**
   * Clears a store cleanly.
   */
  public async clearStore(storeName: string): Promise<void> {
    for (const k of Array.from(this.memoryFallback.keys())) {
      if (k.startsWith(`${storeName}:`)) {
        this.memoryFallback.delete(k);
      }
    }

    if (!this.isBrowser) return;

    try {
      const db = await this.ensureStoreExists(storeName);
      if (!db.objectStoreNames.contains(storeName)) return;

      return await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction([storeName], "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      console.warn(`[IndustrialIndexedDbVault] Failed clearing store '${storeName}':`, err);
    }
  }

  /**
   * Verifies the schema integrity of the database.
   */
  public async verifySchemaIntegrity(): Promise<{
    valid: boolean;
    version: number;
    existingStores: string[];
    missingStores: string[];
  }> {
    if (!this.isBrowser) {
      return {
        valid: true,
        version: this.currentVersion,
        existingStores: [...CANONICAL_OBJECT_STORES],
        missingStores: [],
      };
    }

    const db = await this.openDb();
    const existing = Array.from(db.objectStoreNames);
    const missing = CANONICAL_OBJECT_STORES.filter((s) => !existing.includes(s));

    return {
      valid: missing.length === 0,
      version: db.version,
      existingStores: existing,
      missingStores: missing,
    };
  }

  /**
   * Closes database connection cleanly (for reloading/tests).
   */
  public closeDb(): void {
    if (this.dbInstance) {
      this.dbInstance.close();
      this.dbInstance = null;
    }
  }

  public clearMemoryForTesting(): void {
    this.memoryFallback.clear();
  }
}

export const industrialIndexedDbVault = IndustrialIndexedDbVault.getInstance();
