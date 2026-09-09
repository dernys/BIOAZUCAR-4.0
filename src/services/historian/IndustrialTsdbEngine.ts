import { HistorianRecord } from "../runtime/types";

export interface LttbPoint {
  x: number; // timestamp in epoch ms
  y: number; // numeric process value
}

export interface TsdbBucketAggregation {
  bucketStart: string;
  bucketEnd: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  first: number;
  last: number;
}

/**
 * High-performance In-Memory TSDB Engine with LTTB Downsampling
 * and Temporal Bucket Aggregation.
 */
export class IndustrialTsdbEngine {
  private static instance: IndustrialTsdbEngine;
  private seriesData = new Map<string, HistorianRecord[]>();
  private maxPointsPerSeries: number = 20000;

  private constructor() {}

  public static getInstance(): IndustrialTsdbEngine {
    if (!IndustrialTsdbEngine.instance) {
      IndustrialTsdbEngine.instance = new IndustrialTsdbEngine();
    }
    return IndustrialTsdbEngine.instance;
  }

  /**
   * Ingest a batch of historical records into high-speed ring buffers
   */
  public ingest(records: HistorianRecord[]): void {
    for (const rec of records) {
      const seriesKey = `${rec.tenantId}::${rec.tag}`;
      let series = this.seriesData.get(seriesKey);
      if (!series) {
        series = [];
        this.seriesData.set(seriesKey, series);
      }

      series.push(rec);

      // Ring buffer bounds enforcement
      if (series.length > this.maxPointsPerSeries) {
        series.splice(0, series.length - this.maxPointsPerSeries);
      }
    }
  }

  /**
   * Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm.
   * Reduces arbitrary size timeseries to target points while preserving visual extrema.
   */
  public downsampleLttb(data: LttbPoint[], threshold: number): LttbPoint[] {
    if (threshold >= data.length || threshold === 0) {
      return data;
    }

    const sampled: LttbPoint[] = [];
    let sampledIndex = 0;

    // Bucket size. Leave room for start and end data points
    const every = (data.length - 2) / (threshold - 2);

    let a = 0; // Initially the first point in the triangle
    let maxAreaPoint: LttbPoint = data[0];
    let maxArea: number;
    let area: number;
    let nextA = 0;

    sampled[sampledIndex++] = data[a]; // Always add the first point

    for (let i = 0; i < threshold - 2; i++) {
      // Calculate point average for next bucket (containing c)
      let avgX = 0;
      let avgY = 0;
      let avgRangeStart = Math.floor((i + 1) * every) + 1;
      let avgRangeEnd = Math.floor((i + 2) * every) + 1;
      avgRangeEnd = avgRangeEnd < data.length ? avgRangeEnd : data.length;

      const avgRangeLength = avgRangeEnd - avgRangeStart;

      for (let j = avgRangeStart; j < avgRangeEnd; j++) {
        avgX += data[j].x;
        avgY += data[j].y;
      }
      avgX /= avgRangeLength > 0 ? avgRangeLength : 1;
      avgY /= avgRangeLength > 0 ? avgRangeLength : 1;

      // Get the range for this bucket (containing b)
      let rangeOffs = Math.floor(i * every) + 1;
      const rangeTo = Math.floor((i + 1) * every) + 1;

      // Point a
      const pointAx = data[a].x;
      const pointAy = data[a].y;

      maxArea = -1;

      for (; rangeOffs < rangeTo; rangeOffs++) {
        // Calculate triangle area over points a, this point, and the average point of the next bucket
        area =
          Math.abs(
            (pointAx - avgX) * (data[rangeOffs].y - pointAy) -
              (pointAx - data[rangeOffs].x) * (avgY - pointAy)
          ) * 0.5;

        if (area > maxArea) {
          maxArea = area;
          maxAreaPoint = data[rangeOffs];
          nextA = rangeOffs; // Next a is this b
        }
      }

      sampled[sampledIndex++] = maxAreaPoint; // Pick this point from the bucket
      a = nextA; // This a is the next a (chosen b)
    }

    sampled[sampledIndex++] = data[data.length - 1]; // Always add last point

    return sampled;
  }

  /**
   * Query records with automatic LTTB downsampling for charting
   */
  public queryDownsampled(
    tenantId: string,
    tag: string,
    targetPoints: number = 200
  ): LttbPoint[] {
    const seriesKey = `${tenantId}::${tag}`;
    const raw = this.seriesData.get(seriesKey) || [];

    const numericPoints: LttbPoint[] = raw
      .filter((r) => typeof r.value === "number")
      .map((r) => ({
        x: new Date(r.timestamp).getTime(),
        y: Number(r.value),
      }));

    if (numericPoints.length <= targetPoints) {
      return numericPoints;
    }

    return this.downsampleLttb(numericPoints, targetPoints);
  }

  /**
   * Aggregate time series into uniform time buckets (e.g. 5m, 1h)
   */
  public aggregateTimeBuckets(
    tenantId: string,
    tag: string,
    bucketDurationMs: number = 60000 // 1 minute default
  ): TsdbBucketAggregation[] {
    const seriesKey = `${tenantId}::${tag}`;
    const raw = this.seriesData.get(seriesKey) || [];

    const buckets = new Map<number, number[]>();

    for (const r of raw) {
      if (typeof r.value === "number") {
        const time = new Date(r.timestamp).getTime();
        const bucketKey = Math.floor(time / bucketDurationMs) * bucketDurationMs;
        let b = buckets.get(bucketKey);
        if (!b) {
          b = [];
          buckets.set(bucketKey, b);
        }
        b.push(Number(r.value));
      }
    }

    const results: TsdbBucketAggregation[] = [];
    const sortedBucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const bKey of sortedBucketKeys) {
      const vals = buckets.get(bKey)!;
      const sum = vals.reduce((acc, v) => acc + v, 0);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const avg = Math.round((sum / vals.length) * 100) / 100;

      results.push({
        bucketStart: new Date(bKey).toISOString(),
        bucketEnd: new Date(bKey + bucketDurationMs).toISOString(),
        count: vals.length,
        min,
        max,
        avg,
        first: vals[0],
        last: vals[vals.length - 1],
      });
    }

    return results;
  }
}

export const industrialTsdbEngine = IndustrialTsdbEngine.getInstance();
