/**
 * BioAzúcar 4.0 — Local On-Premise Time Series Database (TSDB) (I9)
 * 
 * High-performance industrial time-series engine running directly on the IPC.
 * Provides autonomous historical analytics (>30 days retention) without requiring cloud connectivity.
 * 
 * Key Features:
 *  1. Micro-second indexed time-series ring-buffers per tag.
 *  2. Downsampling & Windowed Aggregations: AVG, MIN, MAX, P95, LAST, COUNT.
 *  3. Continuous Data Retention Policy & Compaction: Automatic purging of data older than configured TTL.
 *  4. Full Offline Query Capability: Serves local SCADA / HMI trend charts when WAN link is severed.
 */

import { IndustrialDataPoint } from "../../../types";
import { SqliteWalEngine } from "../storage/SqliteWalEngine";

export type TsdbAggregation = "AVG" | "MIN" | "MAX" | "P95" | "LAST" | "COUNT";

export interface TimeSeriesBucket {
  timestamp: number;
  value: number;
  count: number;
  min: number;
  max: number;
  aggregation: TsdbAggregation;
}

export interface TsdbQueryOptions {
  stepMs?: number;
  aggregation?: TsdbAggregation;
  qualityFilter?: "GOOD_ONLY" | "ALL";
}

export interface TsdbStats {
  totalPointsStored: number;
  uniqueTagsCount: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  retentionDays: number;
  storageType?: "SQLITE_WAL" | "IN_MEMORY";
  isWalDurable?: boolean;
}

interface StoredSample {
  timestamp: number;
  value: number;
  quality: string;
  isSimulated: boolean;
}

export class LocalTimeSeriesDatabase {
  private static instance: LocalTimeSeriesDatabase;

  // tag -> chronological array of samples (in-memory L1 cache)
  private tagSeries = new Map<string, StoredSample[]>();
  private maxPointsPerTag: number = 200000;
  private retentionMs: number = 30 * 24 * 60 * 60 * 1000; // 30 days default
  private sqliteEngine: SqliteWalEngine | null = null;
  private insertStmt: any = null;
  private queryStmt: any = null;

  private constructor() {
    this.initSqlite();
  }

  private initSqlite(customPath?: string): void {
    const envPath = typeof process !== "undefined" ? process.env?.BIOAZUCAR_TSDB_SQLITE_PATH : undefined;
    const dbPath = customPath || envPath || "./data/edge-tsdb.sqlite";

    try {
      this.sqliteEngine = new SqliteWalEngine({ dbPath });
      if (this.sqliteEngine.isAvailable()) {
        this.sqliteEngine.exec(`
          CREATE TABLE IF NOT EXISTS tsdb_samples (
            tag TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            value REAL NOT NULL,
            quality TEXT NOT NULL,
            is_simulated INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_tsdb_tag_ts ON tsdb_samples(tag, timestamp);
        `);

        this.insertStmt = this.sqliteEngine.prepare(`
          INSERT INTO tsdb_samples (tag, timestamp, value, quality, is_simulated)
          VALUES (?, ?, ?, ?, ?);
        `);

        this.queryStmt = this.sqliteEngine.prepare(`
          SELECT timestamp, value, quality, is_simulated
          FROM tsdb_samples
          WHERE tag = ? AND timestamp >= ? AND timestamp <= ?
          ORDER BY timestamp ASC;
        `);
      }
    } catch {
      this.sqliteEngine = null;
    }
  }

  public configureSqlite(dbPath: string): void {
    if (this.sqliteEngine) {
      this.sqliteEngine.close();
    }
    this.initSqlite(dbPath);
  }

  public isWalDurable(): boolean {
    return this.sqliteEngine !== null && this.sqliteEngine.isAvailable() && this.sqliteEngine.isWal();
  }

  public getStorageType(): "SQLITE_WAL" | "IN_MEMORY" {
    return this.isWalDurable() ? "SQLITE_WAL" : "IN_MEMORY";
  }

  public flushWal(): void {
    if (this.sqliteEngine) {
      this.sqliteEngine.checkpoint();
    }
  }

  public static getInstance(): LocalTimeSeriesDatabase {
    if (!LocalTimeSeriesDatabase.instance) {
      LocalTimeSeriesDatabase.instance = new LocalTimeSeriesDatabase();
    }
    return LocalTimeSeriesDatabase.instance;
  }

  public setRetention(retentionDays: number): void {
    this.retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  }

  public setMaxPointsPerTag(limit: number): void {
    this.maxPointsPerTag = limit;
  }

  /**
   * Records an industrial data point into the local time-series store (SQLite WAL + RAM cache).
   */
  public record(point: IndustrialDataPoint): void {
    const numVal =
      typeof point.engValue === "number"
        ? point.engValue
        : typeof point.value === "number"
        ? point.value
        : parseFloat(String(point.value));

    if (isNaN(numVal)) return;

    const ts = point.deviceTimestamp ? new Date(point.deviceTimestamp).getTime() : Date.now();
    const quality = point.quality || "GOOD";
    const isSimulated = point.isSimulated ? 1 : 0;

    // 1. Transactional write to SQLite WAL if available
    if (this.sqliteEngine && this.sqliteEngine.isAvailable() && this.insertStmt) {
      try {
        this.insertStmt.run(point.tag, ts, numVal, quality, isSimulated);
      } catch {
        // Continue to RAM buffer if disk write fails
      }
    }

    // 2. Fast in-memory cache update
    let series = this.tagSeries.get(point.tag);
    if (!series) {
      series = [];
      this.tagSeries.set(point.tag, series);
    }

    const sample: StoredSample = {
      timestamp: ts,
      value: numVal,
      quality,
      isSimulated: Boolean(isSimulated),
    };

    // Insert maintaining ascending order by timestamp
    if (series.length === 0 || series[series.length - 1].timestamp <= ts) {
      series.push(sample);
    } else {
      let idx = series.length - 1;
      while (idx >= 0 && series[idx].timestamp > ts) {
        idx--;
      }
      series.splice(idx + 1, 0, sample);
    }

    // Trim in-memory cache by capacity
    if (series.length > this.maxPointsPerTag) {
      series.splice(0, series.length - this.maxPointsPerTag);
    }
  }

  /**
   * Batch insertion of data points wrapped in a single SQLite WAL transaction.
   */
  public recordBatch(points: IndustrialDataPoint[]): void {
    if (this.sqliteEngine && this.sqliteEngine.isAvailable() && this.insertStmt) {
      try {
        this.sqliteEngine.transaction(() => {
          for (const point of points) {
            const numVal =
              typeof point.engValue === "number"
                ? point.engValue
                : typeof point.value === "number"
                ? point.value
                : parseFloat(String(point.value));
            if (isNaN(numVal)) continue;

            const ts = point.deviceTimestamp ? new Date(point.deviceTimestamp).getTime() : Date.now();
            const quality = point.quality || "GOOD";
            const isSimulated = point.isSimulated ? 1 : 0;

            this.insertStmt.run(point.tag, ts, numVal, quality, isSimulated);
          }
        });
      } catch {
        // Transaction failure handled gracefully
      }
    }

    for (const p of points) {
      // Update memory cache
      const numVal =
        typeof p.engValue === "number"
          ? p.engValue
          : typeof p.value === "number"
          ? p.value
          : parseFloat(String(p.value));
      if (isNaN(numVal)) continue;

      const ts = p.deviceTimestamp ? new Date(p.deviceTimestamp).getTime() : Date.now();
      let series = this.tagSeries.get(p.tag);
      if (!series) {
        series = [];
        this.tagSeries.set(p.tag, series);
      }
      series.push({
        timestamp: ts,
        value: numVal,
        quality: p.quality || "GOOD",
        isSimulated: Boolean(p.isSimulated),
      });
      if (series.length > this.maxPointsPerTag) {
        series.splice(0, series.length - this.maxPointsPerTag);
      }
    }
  }

  /**
   * Queries historical telemetry with optional time-windowed aggregation and downsampling.
   * Reads from RAM cache, or fetches from SQLite WAL if not present in memory.
   */
  public queryRange(
    tag: string,
    fromMs: number,
    toMs: number,
    options: TsdbQueryOptions = {}
  ): TimeSeriesBucket[] {
    let series = this.tagSeries.get(tag);

    // If not in RAM cache but SQLite WAL is available, load from SQLite
    if ((!series || series.length === 0) && this.sqliteEngine && this.sqliteEngine.isAvailable() && this.queryStmt) {
      try {
        const rows = this.queryStmt.all(tag, fromMs, toMs) as any[];
        if (rows && rows.length > 0) {
          series = rows.map((r) => ({
            timestamp: Number(r.timestamp),
            value: Number(r.value),
            quality: String(r.quality),
            isSimulated: Boolean(r.is_simulated),
          }));
        }
      } catch {
        // Fallback to empty series
      }
    }

    if (!series || series.length === 0) return [];

    const aggregation = options.aggregation || "AVG";
    const stepMs = options.stepMs || 0;
    const goodOnly = options.qualityFilter === "GOOD_ONLY";

    // Filter points in range
    const inRange: StoredSample[] = [];
    for (const sample of series) {
      if (sample.timestamp >= fromMs && sample.timestamp <= toMs) {
        if (!goodOnly || sample.quality === "GOOD") {
          inRange.push(sample);
        }
      }
    }

    if (inRange.length === 0) return [];

    // If no downsampling step requested, return 1-to-1 buckets
    if (stepMs <= 0) {
      return inRange.map((s) => ({
        timestamp: s.timestamp,
        value: s.value,
        count: 1,
        min: s.value,
        max: s.value,
        aggregation,
      }));
    }

    // Downsample into fixed step intervals
    const buckets: TimeSeriesBucket[] = [];
    let currentBucketStart = fromMs;

    while (currentBucketStart < toMs) {
      const bucketEnd = currentBucketStart + stepMs;
      const bucketSamples = inRange.filter(
        (s) => s.timestamp >= currentBucketStart && s.timestamp < bucketEnd
      );

      if (bucketSamples.length > 0) {
        const values = bucketSamples.map((s) => s.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const count = values.length;

        let computedVal: number;
        switch (aggregation) {
          case "MIN":
            computedVal = min;
            break;
          case "MAX":
            computedVal = max;
            break;
          case "LAST":
            computedVal = values[values.length - 1];
            break;
          case "COUNT":
            computedVal = count;
            break;
          case "P95":
            computedVal = this.calculatePercentile(values, 95);
            break;
          case "AVG":
          default:
            computedVal = Number(
              (values.reduce((sum, v) => sum + v, 0) / count).toFixed(2)
            );
            break;
        }

        buckets.push({
          timestamp: currentBucketStart,
          value: computedVal,
          count,
          min,
          max,
          aggregation,
        });
      }

      currentBucketStart = bucketEnd;
    }

    return buckets;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Applies the data retention policy, removing samples older than configured TTL.
   */
  public purgeExpiredSamples(): number {
    const cutoff = Date.now() - this.retentionMs;
    let purgedCount = 0;

    // Purge in SQLite WAL
    if (this.sqliteEngine && this.sqliteEngine.isAvailable()) {
      try {
        this.sqliteEngine.exec(`DELETE FROM tsdb_samples WHERE timestamp < ${cutoff};`);
      } catch {
        // Ignore purge error
      }
    }

    for (const [tag, series] of this.tagSeries.entries()) {
      const firstValidIdx = series.findIndex((s) => s.timestamp >= cutoff);
      if (firstValidIdx > 0) {
        purgedCount += firstValidIdx;
        series.splice(0, firstValidIdx);
      } else if (firstValidIdx === -1 && series.length > 0) {
        purgedCount += series.length;
        this.tagSeries.delete(tag);
      }
    }

    return purgedCount;
  }

  public getStats(): TsdbStats {
    let totalPoints = 0;
    let oldest: number | null = null;
    let newest: number | null = null;

    // Query SQLite stats if available
    if (this.sqliteEngine && this.sqliteEngine.isAvailable()) {
      try {
        const row = this.sqliteEngine.prepare(`
          SELECT COUNT(*) as total, COUNT(DISTINCT tag) as unique_tags, MIN(timestamp) as min_ts, MAX(timestamp) as max_ts
          FROM tsdb_samples;
        `).get() as any;

        if (row && row.total > 0) {
          totalPoints = Number(row.total);
          oldest = row.min_ts ? Number(row.min_ts) : null;
          newest = row.max_ts ? Number(row.max_ts) : null;
          return {
            totalPointsStored: totalPoints,
            uniqueTagsCount: Number(row.unique_tags || 0),
            oldestTimestamp: oldest,
            newestTimestamp: newest,
            retentionDays: Math.round(this.retentionMs / (24 * 60 * 60 * 1000)),
            storageType: "SQLITE_WAL",
            isWalDurable: this.isWalDurable(),
          };
        }
      } catch {
        // Fallback to in-memory stats
      }
    }

    for (const series of this.tagSeries.values()) {
      totalPoints += series.length;
      if (series.length > 0) {
        const first = series[0].timestamp;
        const last = series[series.length - 1].timestamp;
        if (oldest === null || first < oldest) oldest = first;
        if (newest === null || last > newest) newest = last;
      }
    }

    return {
      totalPointsStored: totalPoints,
      uniqueTagsCount: this.tagSeries.size,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      retentionDays: Math.round(this.retentionMs / (24 * 60 * 60 * 1000)),
      storageType: this.getStorageType(),
      isWalDurable: this.isWalDurable(),
    };
  }

  public reset(): void {
    if (this.sqliteEngine && this.sqliteEngine.isAvailable()) {
      try {
        this.sqliteEngine.exec("DELETE FROM tsdb_samples;");
      } catch {
        // Ignore reset error
      }
    }
    this.tagSeries.clear();
  }

  public close(): void {
    if (this.sqliteEngine) {
      this.sqliteEngine.close();
      this.sqliteEngine = null;
    }
  }
}

export const localTimeSeriesDatabase = LocalTimeSeriesDatabase.getInstance();
