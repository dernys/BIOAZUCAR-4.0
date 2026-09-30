import { collection, addDoc, query, where, orderBy, limit as firestoreLimit, getDocs, setDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { HistorianRecord } from "../runtime/types";
import { tenantRuntimeManager } from "../runtime/TenantRuntimeManager";
import { industrialTsdbEngine, LttbPoint, TsdbBucketAggregation } from "./IndustrialTsdbEngine";
import { LocalTimeSeriesDatabase } from "../edge/history/LocalTimeSeriesDatabase";
import { industrialDataQualityGate, SampleQualityAuditResult } from "../dataProviders/IndustrialDataQualityGate";
import { IndustrialTagSample, IndustrialTagDefinition } from "../../types";

export type HistorianCloudSyncMode =
  | "LOCAL_TSDB_ONLY"       // Default: 100% on-premise SQLite WAL & memory ring buffers. Zero Firestore charges.
  | "AGGREGATED_ROLLUP"     // Coalesced 1-minute / 5-minute statistical rollups. 99.9% cost reduction.
  | "CRITICAL_EVENTS_ONLY"  // Persist only alarms, trips and bad quality excursions.
  | "RAW_DIRECT";           // Gated with circuit-breaker for diagnostic testing.

export interface HistorianCloudSavingsStats {
  syncMode: HistorianCloudSyncMode;
  totalPointsIngested: number;
  rawCloudWritesPrevented: number;
  rollupsEmittedToCloud: number;
  estimatedUsdSavedPerDay: number;
  estimatedUsdSavedPerMonth: number;
  circuitBreakerTripped: boolean;
}

interface TagRollupBucket {
  tag: string;
  tenantId: string;
  windowStart: number;
  windowEnd: number;
  min: number;
  max: number;
  sum: number;
  count: number;
  first: number;
  last: number;
  quality: string;
  unit: string;
}

export class HistorianService {
  private static instance: HistorianService;

  // Cloud cost protection and traffic governance
  private cloudSyncMode: HistorianCloudSyncMode = "LOCAL_TSDB_ONLY";
  private rawCloudWritesPrevented = 0;
  private totalPointsIngested = 0;
  private rollupsEmittedToCloud = 0;
  private circuitBreakerTripped = false;
  private writesInCurrentMinute = 0;
  private minuteWindowTimestamp = Date.now();
  private maxWritesPerMinute = 30; // Circuit-breaker ceiling for raw writes

  // Rollup aggregator buffer (keyed by tenantId::tag)
  private rollupBuckets = new Map<string, TagRollupBucket>();
  private rollupFlushIntervalMs = 60000; // 1-minute rollup window
  private rollupTimer: any = null;

  private constructor() {
    this.startRollupFlushLoop();
  }

  public static getInstance(): HistorianService {
    if (!HistorianService.instance) {
      HistorianService.instance = new HistorianService();
    }
    return HistorianService.instance;
  }

  public setCloudSyncMode(mode: HistorianCloudSyncMode): void {
    this.cloudSyncMode = mode;
  }

  public getCloudSyncMode(): HistorianCloudSyncMode {
    return this.cloudSyncMode;
  }

  public getCloudCostSavingsStats(): HistorianCloudSavingsStats {
    // GCP Firestore pricing reference: ~$0.18 per 100,000 document writes
    const firestoreCostPerWriteUsd = 0.0000018;
    const usdSaved = this.rawCloudWritesPrevented * firestoreCostPerWriteUsd;
    
    // Project based on historical rate per day and month
    return {
      syncMode: this.cloudSyncMode,
      totalPointsIngested: this.totalPointsIngested,
      rawCloudWritesPrevented: this.rawCloudWritesPrevented,
      rollupsEmittedToCloud: this.rollupsEmittedToCloud,
      estimatedUsdSavedPerDay: Number(usdSaved.toFixed(4)),
      estimatedUsdSavedPerMonth: Number((usdSaved * 30).toFixed(2)),
      circuitBreakerTripped: this.circuitBreakerTripped,
    };
  }

  /**
   * Pipeline enforcement:
   * TAG -> SAMPLE -> QUALITY GATE -> HISTORIAN -> LIVE
   * Never convert SIMULATED into LIVE_OT. Reject invalid or out-of-range samples.
   */
  public async ingestValidatedTagSample(
    sample: IndustrialTagSample,
    tagDef?: IndustrialTagDefinition
  ): Promise<SampleQualityAuditResult> {
    const audit = industrialDataQualityGate.evaluateSample(sample, {
      tagDefinition: tagDef,
    });

    if (audit.isValid) {
      const record: HistorianRecord = {
        tenantId: sample.tenantId,
        tag: sample.canonicalName || sample.tagId,
        value: typeof sample.value === "number" ? sample.value : parseFloat(String(sample.value)) || 0,
        quality: audit.quality === "GOOD" ? "GOOD" : audit.quality === "UNCERTAIN" ? "UNCERTAIN" : "BAD",
        timestamp: sample.sourceTimestamp || sample.ingestionTimestamp || new Date().toISOString(),
        sourceTimestamp: sample.sourceTimestamp,
        ingestionTimestamp: sample.ingestionTimestamp || new Date().toISOString(),
        originMark: sample.origin === "LIVE_OT" ? "LIVE_OT" : "SIMULATION",
        isSimulated: sample.origin === "SIMULATED",
        source: sample.origin === "LIVE_OT" ? "LIVE_OT" : "SIMULATION",
        provenance: sample.origin === "LIVE_OT" ? "OBSERVED_OT" : "SIMULATED_PROCESS_MODEL",
        scenario: "NORMAL",
        sequence: Date.now(),
        unit: tagDef?.unit || "",
      };

      await this.recordPoint(record);
    }

    return audit;
  }

  /**
   * Persist a sample into runtime memory buffer, TSDB engine and governed Cloud tier.
   * Enforces zero-unnecessary-write policy for Firestore.
   */
  public async recordPoint(record: HistorianRecord): Promise<void> {
    this.totalPointsIngested++;

    // 1. Ingest into durable on-premise SQLite WAL (DURABLE HISTORICAL RAW AUTHORITY ON EDGE)
    LocalTimeSeriesDatabase.getInstance().recordCanonicalRecord(record);

    // 2. Ingest into fast local TSDB engine (ring buffers + LTTB downsampling for UI/RAM cache)
    industrialTsdbEngine.ingest([record]);

    const runtime = tenantRuntimeManager.getRuntime(record.tenantId);
    if (runtime) {
      // Memory buffer is populated via simulation runtime step or explicit call
    }

    // 3. Evaluate Cloud Storage Tier based on Cost & Traffic Strategy
    if (this.cloudSyncMode === "LOCAL_TSDB_ONLY") {
      // Prevent Firestore document creation completely. Telemetry lives on-premise in TSDB / SQLite WAL.
      this.rawCloudWritesPrevented++;
      return;
    }

    if (this.cloudSyncMode === "AGGREGATED_ROLLUP") {
      this.rawCloudWritesPrevented++;
      this.accumulateRollupSample(record);
      return;
    }

    if (this.cloudSyncMode === "CRITICAL_EVENTS_ONLY") {
      const isCritical = record.quality === "BAD" || record.quality === "UNCERTAIN";
      if (!isCritical) {
        this.rawCloudWritesPrevented++;
        return;
      }
    }

    // 4. In PRODUCTION profile, RAW_DIRECT to Cloud is strictly FORBIDDEN (FAIL CLOSED)
    const isProduction =
      (typeof process !== "undefined" && (process.env?.INDUSTRIAL_RUNTIME_PROFILE === "PRODUCTION" || process.env?.NODE_ENV === "production"));
    if (isProduction) {
      throw new Error(
        "[FAIL_CLOSED] Direct RAW telemetry writing to Firestore is strictly prohibited in PRODUCTION profile conforming to BioAzúcar 4.0 Architecture."
      );
    }

    // 5. Rate-limited fallback for RAW_DIRECT or Critical Events in DEV/TEST
    const now = Date.now();
    if (now - this.minuteWindowTimestamp > 60000) {
      this.writesInCurrentMinute = 0;
      this.minuteWindowTimestamp = now;
      this.circuitBreakerTripped = false;
    }

    if (this.writesInCurrentMinute >= this.maxWritesPerMinute) {
      this.circuitBreakerTripped = true;
      this.rawCloudWritesPrevented++;
      return;
    }

    this.writesInCurrentMinute++;

    try {
      const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || process.env?.VITEST === "true");
      if (db && !isTest) {
        await addDoc(collection(db, "historian_records"), {
          ...record,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (_err) {
      // Gracefully continue in local simulation mode if offline or unauthenticated
    }
  }

  /**
   * Accumulates sample into in-memory statistical bucket for coalesced cloud persistence
   */
  private accumulateRollupSample(record: HistorianRecord): void {
    const key = `${record.tenantId}::${record.tag}`;
    const now = Date.now();
    const numVal = typeof record.value === "number" ? record.value : parseFloat(String(record.value)) || 0;
    let bucket = this.rollupBuckets.get(key);

    if (!bucket) {
      bucket = {
        tag: record.tag,
        tenantId: record.tenantId,
        windowStart: now,
        windowEnd: now,
        min: numVal,
        max: numVal,
        sum: numVal,
        count: 1,
        first: numVal,
        last: numVal,
        quality: record.quality,
        unit: record.unit || "",
      };
      this.rollupBuckets.set(key, bucket);
    } else {
      bucket.windowEnd = now;
      bucket.min = Math.min(bucket.min, numVal);
      bucket.max = Math.max(bucket.max, numVal);
      bucket.sum += numVal;
      bucket.count += 1;
      bucket.last = numVal;
      if (record.quality === "BAD") bucket.quality = "BAD";
    }
  }

  private startRollupFlushLoop(): void {
    if (typeof window !== "undefined" || typeof process !== "undefined") {
      this.rollupTimer = setInterval(() => {
        this.flushRollupBucketsToFirestore();
      }, this.rollupFlushIntervalMs);
    }
  }

  /**
   * Coalesced batch write: Emits a single summarized document per tag instead of thousands of raw points
   */
  public async flushRollupBucketsToFirestore(): Promise<void> {
    if (this.rollupBuckets.size === 0 || !db) return;
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || process.env?.VITEST === "true");
    if (isTest) {
      this.rollupsEmittedToCloud += this.rollupBuckets.size;
      this.rollupBuckets.clear();
      return;
    }

    const bucketsToFlush = Array.from(this.rollupBuckets.values());
    this.rollupBuckets.clear();

    for (const b of bucketsToFlush) {
      try {
        const avg = b.count > 0 ? Number((b.sum / b.count).toFixed(3)) : b.last;
        const rollupDocId = `rollup_${b.tenantId}_${b.tag}_${Math.floor(b.windowStart / 60000)}`;

        await setDoc(doc(db, "historian_rollups", rollupDocId), {
          tenantId: b.tenantId,
          tag: b.tag,
          windowStart: new Date(b.windowStart).toISOString(),
          windowEnd: new Date(b.windowEnd).toISOString(),
          count: b.count,
          min: b.min,
          max: b.max,
          avg,
          first: b.first,
          last: b.last,
          quality: b.quality,
          unit: b.unit,
          savedCloudWrites: Math.max(0, b.count - 1),
          createdAt: new Date().toISOString(),
        }, { merge: true });

        this.rollupsEmittedToCloud++;
      } catch (_err) {
        // Fail-safe: Local TSDB retains everything regardless of cloud status
      }
    }
  }

  /**
   * Query historical points by tag and tenant.
   * Architecture Hierarchy:
   * 1. Check in-memory TSDB engine cache (RAM LTTB ring buffer).
   * 2. If empty (cold start / reboot / power loss), query durable SQLite WAL authority on Edge.
   * 3. Hydrate in-memory TSDB engine from SQLite WAL for subsequent zero-disk latency.
   * 4. Fallback to active TenantRuntime if present.
   * FIRESTORE IS NEVER QUERIED FOR HIGH-FREQUENCY RAW TELEMETRY.
   */
  public async queryRecords(
    tenantId: string,
    tag?: string,
    limitCount: number = 50
  ): Promise<HistorianRecord[]> {
    // 1. Fast in-memory TSDB cache (RAM)
    const inMemoryPoints = industrialTsdbEngine.queryRecords(tenantId, tag, limitCount);
    if (inMemoryPoints.length > 0) {
      return inMemoryPoints;
    }

    // 2. Query durable SQLite WAL authority on Edge
    const sqlitePoints = LocalTimeSeriesDatabase.getInstance().queryCanonicalRecords({
      tenantId,
      tag,
      limit: limitCount,
    });

    if (sqlitePoints.length > 0) {
      // Hydrate RAM cache for subsequent reads
      industrialTsdbEngine.ingest(sqlitePoints);
      return sqlitePoints;
    }

    // 3. Fallback to active TenantRuntime if present
    const runtime = tenantRuntimeManager.getRuntime(tenantId);
    const runtimePoints = runtime ? runtime.getHistorianRecords(tag, limitCount) : [];
    if (runtimePoints.length > 0) {
      return runtimePoints;
    }

    return [];
  }

  /**
   * Generate CSV format for export
   */
  public exportToCSV(records: HistorianRecord[]): string {
    const headers = [
      "Timestamp",
      "TenantID",
      "Tag",
      "Valor",
      "Unidad",
      "Calidad",
      "Fuente",
      "Proveniencia",
      "Simulado",
      "Escenario",
      "Secuencia",
    ];

    const rows = records.map((r) =>
      [
        r.timestamp,
        r.tenantId,
        r.tag,
        r.value,
        r.unit,
        r.quality,
        r.source,
        r.provenance,
        r.isSimulated ? "SI" : "NO",
        r.scenario || "NORMAL",
        r.sequence,
      ].join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }

  /**
   * Query records downsampled with LTTB (Largest Triangle Three Buckets) for high-speed UI charting
   */
  public queryDownsampled(
    tenantId: string,
    tag: string,
    targetPoints: number = 200
  ): LttbPoint[] {
    return industrialTsdbEngine.queryDownsampled(tenantId, tag, targetPoints);
  }

  /**
   * Compute uniform time bucket aggregations (min, max, avg, first, last)
   */
  public aggregateTimeBuckets(
    tenantId: string,
    tag: string,
    bucketDurationMs: number = 60000
  ): TsdbBucketAggregation[] {
    return industrialTsdbEngine.aggregateTimeBuckets(tenantId, tag, bucketDurationMs);
  }
}

export const historianService = HistorianService.getInstance();
