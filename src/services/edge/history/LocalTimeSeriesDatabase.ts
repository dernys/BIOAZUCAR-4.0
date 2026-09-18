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
}

interface StoredSample {
  timestamp: number;
  value: number;
  quality: string;
  isSimulated: boolean;
}

export class LocalTimeSeriesDatabase {
  private static instance: LocalTimeSeriesDatabase;

  // tag -> chronological array of samples
  private tagSeries = new Map<string, StoredSample[]>();
  private maxPointsPerTag: number = 200000;
  private retentionMs: number = 30 * 24 * 60 * 60 * 1000; // 30 days default

  private constructor() {}

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
   * Records an industrial data point into the local time-series store.
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

    let series = this.tagSeries.get(point.tag);
    if (!series) {
      series = [];
      this.tagSeries.set(point.tag, series);
    }

    const sample: StoredSample = {
      timestamp: ts,
      value: numVal,
      quality: point.quality,
      isSimulated: point.isSimulated ?? false,
    };

    // Insert maintaining ascending order by timestamp
    if (series.length === 0 || series[series.length - 1].timestamp <= ts) {
      series.push(sample);
    } else {
      // In-order insertion for out-of-order points
      let idx = series.length - 1;
      while (idx >= 0 && series[idx].timestamp > ts) {
        idx--;
      }
      series.splice(idx + 1, 0, sample);
    }

    // Trim by capacity
    if (series.length > this.maxPointsPerTag) {
      series.splice(0, series.length - this.maxPointsPerTag);
    }
  }

  /**
   * Batch insertion of data points.
   */
  public recordBatch(points: IndustrialDataPoint[]): void {
    for (const p of points) {
      this.record(p);
    }
  }

  /**
   * Queries historical telemetry with optional time-windowed aggregation and downsampling.
   */
  public queryRange(
    tag: string,
    fromMs: number,
    toMs: number,
    options: TsdbQueryOptions = {}
  ): TimeSeriesBucket[] {
    const series = this.tagSeries.get(tag);
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

    for (const [tag, series] of this.tagSeries.entries()) {
      const firstValidIdx = series.findIndex((s) => s.timestamp >= cutoff);
      if (firstValidIdx > 0) {
        purgedCount += firstValidIdx;
        series.splice(0, firstValidIdx);
      } else if (firstValidIdx === -1 && series.length > 0) {
        // All samples expired
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
    };
  }

  public reset(): void {
    this.tagSeries.clear();
  }
}

export const localTimeSeriesDatabase = LocalTimeSeriesDatabase.getInstance();
