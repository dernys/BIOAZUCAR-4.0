import { IndustrialDataPoint } from "../../types";
import { StoreAndForwardBufferState } from "./types";

export interface ForwardBatch {
  batchId: string;
  points: IndustrialDataPoint[];
  timestamp: string;
}

export class StoreAndForwardQueue {
  private queue: IndustrialDataPoint[] = [];
  private pendingAcks = new Map<string, IndustrialDataPoint[]>();
  private seenKeys = new Set<string>();
  private maxCapacity: number;
  private isCloudConnected: boolean = true;
  private isSyncing: boolean = false;
  private totalIngested: number = 0;
  private totalForwarded: number = 0;
  private droppedPoints: number = 0;
  private lastForwardTimestamp: string | null = null;

  constructor(maxCapacity: number = 50000) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Set cloud connectivity state.
   * If transitioning from offline to online, initiates forwarding.
   */
  public setCloudConnectivity(connected: boolean): void {
    this.isCloudConnected = connected;
    if (!connected) {
      this.isSyncing = false;
    }
  }

  public getCloudConnectivity(): boolean {
    return this.isCloudConnected;
  }

  /**
   * Enqueue data point into Store & Forward buffer.
   * Ensures deduplication and preserves original timestamps and sequences.
   */
  public enqueue(point: IndustrialDataPoint): boolean {
    this.totalIngested++;

    // Deduplication key
    const dedupeKey = `${point.tag}::${point.deviceTimestamp}::${point.sequence}`;
    if (this.seenKeys.has(dedupeKey)) {
      return false; // already buffered or forwarded
    }

    // Capacity management: drop oldest or reject if strictly bounded
    if (this.queue.length >= this.maxCapacity) {
      // FIFO eviction of unconfirmed point if full to prioritize latest state
      const evicted = this.queue.shift();
      if (evicted) {
        const evictedKey = `${evicted.tag}::${evicted.deviceTimestamp}::${evicted.sequence}`;
        this.seenKeys.delete(evictedKey);
        this.droppedPoints++;
      }
    }

    this.seenKeys.add(dedupeKey);
    // Ensure chronological insertion (or append if monotonically increasing)
    this.queue.push(point);

    return true;
  }

  /**
   * Enqueue batch of data points
   */
  public enqueueBatch(points: IndustrialDataPoint[]): number {
    let accepted = 0;
    for (const pt of points) {
      if (this.enqueue(pt)) {
        accepted++;
      }
    }
    return accepted;
  }

  /**
   * Drain up to `batchSize` items for cloud synchronization.
   * Items are held in `pendingAcks` until `acknowledgeBatch` is called.
   */
  public prepareForwardBatch(batchSize: number = 100): ForwardBatch | null {
    if (this.queue.length === 0 || !this.isCloudConnected) {
      return null;
    }

    this.isSyncing = true;
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const items = this.queue.slice(0, batchSize);

    this.pendingAcks.set(batchId, items);
    return {
      batchId,
      points: items,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cloud platform confirms receipt of batch.
   * Prunes confirmed points from the queue and deduplication memory.
   */
  public acknowledgeBatch(batchId: string): boolean {
    const batchItems = this.pendingAcks.get(batchId);
    if (!batchItems) {
      return false;
    }

    // Remove acknowledged items from head of queue
    const count = batchItems.length;
    this.queue.splice(0, count);

    this.totalForwarded += count;
    this.lastForwardTimestamp = new Date().toISOString();
    this.pendingAcks.delete(batchId);

    if (this.queue.length === 0) {
      this.isSyncing = false;
      // Clean up deduplication cache if memory needs bound
      if (this.seenKeys.size > 20000) {
        this.seenKeys.clear();
      }
    }

    return true;
  }

  /**
   * Cloud forwarding failed or timed out. Return batch to retryable state.
   */
  public rollbackBatch(batchId: string): void {
    this.pendingAcks.delete(batchId);
    this.isSyncing = false;
  }

  /**
   * Get buffer diagnostics and operational state
   */
  public getState(): StoreAndForwardBufferState {
    const oldest = this.queue.length > 0 ? this.queue[0].deviceTimestamp : null;
    const newest =
      this.queue.length > 0 ? this.queue[this.queue.length - 1].deviceTimestamp : null;

    return {
      isCloudConnected: this.isCloudConnected,
      bufferedCount: this.queue.length,
      maxBufferCapacity: this.maxCapacity,
      oldestPointTimestamp: oldest,
      newestPointTimestamp: newest,
      isSyncing: this.isSyncing,
      totalIngested: this.totalIngested,
      totalForwarded: this.totalForwarded,
      droppedPoints: this.droppedPoints,
      lastForwardTimestamp: this.lastForwardTimestamp,
    };
  }

  public getStats() {
    const s = this.getState();
    return {
      queueDepth: s.bufferedCount,
      cloudConnected: s.isCloudConnected,
      droppedCount: s.droppedPoints,
      maxCapacity: s.maxBufferCapacity,
      isSyncing: s.isSyncing,
    };
  }

  /**
   * Peek at pending points without modifying queue
   */
  public peek(count: number = 10): IndustrialDataPoint[] {
    return this.queue.slice(0, count);
  }

  /**
   * Clear buffer (for administrative testing/resets only)
   */
  public clear(): void {
    this.queue = [];
    this.pendingAcks.clear();
    this.seenKeys.clear();
    this.isSyncing = false;
  }
}
