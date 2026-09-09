import { collection, addDoc, query, where, orderBy, limit as firestoreLimit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { HistorianRecord } from "../runtime/types";
import { tenantRuntimeManager } from "../runtime/TenantRuntimeManager";
import { industrialTsdbEngine, LttbPoint, TsdbBucketAggregation } from "./IndustrialTsdbEngine";

export class HistorianService {
  private static instance: HistorianService;

  private constructor() {}

  public static getInstance(): HistorianService {
    if (!HistorianService.instance) {
      HistorianService.instance = new HistorianService();
    }
    return HistorianService.instance;
  }

  /**
   * Persist a sample into runtime memory buffer, TSDB engine and Firestore collection
   */
  public async recordPoint(record: HistorianRecord): Promise<void> {
    // 1. Ingest into fast local TSDB engine (ring buffers + LTTB downsampling)
    industrialTsdbEngine.ingest([record]);

    const runtime = tenantRuntimeManager.getRuntime(record.tenantId);
    if (runtime) {
      // Memory buffer is populated via simulation runtime step or explicit call
    }

    try {
      if (db) {
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
   * Query historical points by tag and tenant
   */
  public async queryRecords(
    tenantId: string,
    tag?: string,
    limitCount: number = 50
  ): Promise<HistorianRecord[]> {
    // 1. First get from active TenantRuntime (fast in-memory with coherent simulation data)
    const runtime = tenantRuntimeManager.getRuntime(tenantId);
    const inMemoryPoints = runtime ? runtime.getHistorianRecords(tag, limitCount) : [];

    if (inMemoryPoints.length > 0) {
      return inMemoryPoints;
    }

    // 2. Query Firestore if memory buffer was empty (e.g. cold start)
    try {
      if (db) {
        const histCol = collection(db, "historian_records");
        let q = query(
          histCol,
          where("tenantId", "==", tenantId),
          orderBy("timestamp", "desc"),
          firestoreLimit(limitCount)
        );

        if (tag) {
          q = query(
            histCol,
            where("tenantId", "==", tenantId),
            where("tag", "==", tag),
            orderBy("timestamp", "desc"),
            firestoreLimit(limitCount)
          );
        }

        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => d.data() as HistorianRecord);
        if (docs.length > 0) {
          return docs.reverse();
        }
      }
    } catch (_err) {
      // In tests or unauthenticated sessions, fallback to synthetic samples from runtime
    }

    return inMemoryPoints;
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
