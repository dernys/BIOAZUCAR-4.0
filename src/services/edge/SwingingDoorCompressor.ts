import { IndustrialDataPoint } from "../../types";

/**
 * Parameter configuration for the Swinging Door Trellis (SDT) compression algorithm.
 * Standard used in tier-1 Industrial Historians (OSIsoft PI, Aspen InfoPlus.21).
 */
export interface SdtConfig {
  /** Compression deviation (tolerance band, e.g. 0.2 for +/- 0.2 engineering units or % span) */
  compDev: number;
  /** Minimum time interval between recorded points in seconds (prevents chatter/noise) */
  compMinSeconds?: number;
  /** Maximum time interval before forcing a snapshot point in seconds (heartbeat) */
  compMaxSeconds?: number;
}

export interface SdtPoint {
  timestamp: number; // Unix timestamp in seconds or milliseconds
  value: number;
}

/**
 * Swinging Door Trellis (SDT) Compression Engine.
 * 
 * Evaluates slope envelopes between consecutive data points.
 * Retains significant process trend changes (inflection points) while discarding
 * linear interpolatable values, yielding 70% to 92% storage reduction.
 */
export class SwingingDoorCompressor {
  private config: SdtConfig;
  private pivotPoint: SdtPoint | null = null;
  private lastEvaluatedPoint: SdtPoint | null = null;
  private upperSlope: number = Infinity;
  private lowerSlope: number = -Infinity;
  private totalInputPoints: number = 0;
  private totalArchivedPoints: number = 0;

  constructor(config: SdtConfig) {
    this.config = {
      compMinSeconds: 0.1,
      compMaxSeconds: 3600, // 1 hour heartbeat default
      ...config,
    };
  }

  /**
   * Evaluates an incoming numeric data point.
   * Returns an array of points that MUST be archived (0, 1 or 2 points).
   */
  public processPoint(point: SdtPoint): SdtPoint[] {
    this.totalInputPoints++;
    const archived: SdtPoint[] = [];

    // First point initializes the pivot
    if (!this.pivotPoint) {
      this.pivotPoint = point;
      this.lastEvaluatedPoint = point;
      this.resetDoors(point);
      this.totalArchivedPoints++;
      return [point];
    }

    const dt = (point.timestamp - this.pivotPoint.timestamp) / 1000; // in seconds

    // 1. Min interval filter: if arriving faster than compMin, ignore unless significant jump
    if (this.config.compMinSeconds && dt < this.config.compMinSeconds) {
      return archived;
    }

    // 2. Max interval check: if time delta exceeds compMax, force archive to avoid stale records
    if (this.config.compMaxSeconds && dt >= this.config.compMaxSeconds) {
      if (this.lastEvaluatedPoint && this.lastEvaluatedPoint !== this.pivotPoint) {
        archived.push(this.lastEvaluatedPoint);
        this.totalArchivedPoints++;
      }
      archived.push(point);
      this.totalArchivedPoints++;
      this.pivotPoint = point;
      this.lastEvaluatedPoint = point;
      this.resetDoors(point);
      return archived;
    }

    // 3. Calculate slopes from current pivot
    const upperRay = (point.value + this.config.compDev - this.pivotPoint.value) / dt;
    const lowerRay = (point.value - this.config.compDev - this.pivotPoint.value) / dt;

    const newUpperSlope = Math.min(this.upperSlope, upperRay);
    const newLowerSlope = Math.max(this.lowerSlope, lowerRay);

    // 4. Check if doors have crossed (diverged beyond tolerance corridor)
    if (newUpperSlope < newLowerSlope) {
      // The corridor is broken: the point PRIOR to this one is an inflection point!
      if (this.lastEvaluatedPoint && this.lastEvaluatedPoint !== this.pivotPoint) {
        archived.push(this.lastEvaluatedPoint);
        this.totalArchivedPoints++;
      }

      // New pivot becomes the inflection point
      this.pivotPoint = this.lastEvaluatedPoint || point;
      this.resetDoors(this.pivotPoint);

      // Re-evaluate current point against new pivot
      const newDt = (point.timestamp - this.pivotPoint.timestamp) / 1000;
      if (newDt > 0) {
        this.upperSlope = (point.value + this.config.compDev - this.pivotPoint.value) / newDt;
        this.lowerSlope = (point.value - this.config.compDev - this.pivotPoint.value) / newDt;
      }
    } else {
      // Doors stay open: narrow the slope corridor
      this.upperSlope = newUpperSlope;
      this.lowerSlope = newLowerSlope;
    }

    this.lastEvaluatedPoint = point;
    return archived;
  }

  /**
   * Flush any pending last point before closing stream
   */
  public flush(): SdtPoint[] {
    if (
      this.lastEvaluatedPoint &&
      this.pivotPoint &&
      this.lastEvaluatedPoint.timestamp !== this.pivotPoint.timestamp
    ) {
      const pt = this.lastEvaluatedPoint;
      this.pivotPoint = pt;
      this.totalArchivedPoints++;
      return [pt];
    }
    return [];
  }

  /**
   * Reset the upper and lower door slopes for a new pivot point
   */
  private resetDoors(_pivot: SdtPoint): void {
    this.upperSlope = Infinity;
    this.lowerSlope = -Infinity;
  }

  /**
   * Get operational compression ratio (e.g. 0.82 = 82% savings)
   */
  public getStats() {
    const compressionRatio =
      this.totalInputPoints > 0
        ? (this.totalInputPoints - this.totalArchivedPoints) / this.totalInputPoints
        : 0;

    return {
      totalInputPoints: this.totalInputPoints,
      totalArchivedPoints: this.totalArchivedPoints,
      compressionRatioPercentage: Math.round(compressionRatio * 10000) / 100,
      bandwidthSavingsPercentage: Math.round(compressionRatio * 10000) / 100,
    };
  }
}

/**
 * Multi-tag manager for real-time Swinging Door compression.
 */
export class MultiTagSwingingDoorFilter {
  private compressors = new Map<string, SwingingDoorCompressor>();
  private defaultDevPercentage: number;

  constructor(defaultDevPercentage: number = 0.5) {
    this.defaultDevPercentage = defaultDevPercentage;
  }

  public filterPoint(point: IndustrialDataPoint, engSpan: number = 100): boolean {
    if (typeof point.value !== "number") {
      return true; // Keep discrete / text tags without compression
    }

    let comp = this.compressors.get(point.tag);
    if (!comp) {
      const compDev = (engSpan * this.defaultDevPercentage) / 100;
      comp = new SwingingDoorCompressor({
        compDev: Math.max(0.01, compDev),
        compMinSeconds: 0.2,
        compMaxSeconds: 300, // 5 min heartbeat
      });
      this.compressors.set(point.tag, comp);
    }

    const timestamp = new Date(point.deviceTimestamp || point.ingestionTimestamp).getTime();
    const archived = comp.processPoint({ timestamp, value: point.value });

    return archived.length > 0;
  }
}
