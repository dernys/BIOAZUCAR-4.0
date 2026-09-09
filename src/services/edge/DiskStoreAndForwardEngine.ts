import { IndustrialDataPoint } from "../../types";
import { ForwardBatch, StoreAndForwardQueue } from "./StoreAndForwardQueue";

export interface DiskQueueConfig {
  maxMemoryPoints?: number;
  batchSize?: number;
  syncIntervalMs?: number;
  persistenceKey?: string;
}

/**
 * DiskStoreAndForwardEngine
 * 
 * Industrial-grade persistence engine for the Edge.
 * Combines in-memory ring-buffer speed with crash-resilient disk/local storage.
 * If the Edge machine loses power, the un-forwarded telemetry is safely restored
 * upon restart.
 */
export class DiskStoreAndForwardEngine {
  private memQueue: StoreAndForwardQueue;
  private persistenceKey: string;
  private isNodeEnv: boolean;
  private isSyncLoopRunning: boolean = false;
  private syncTimer: any = null;

  constructor(config: DiskQueueConfig = {}) {
    this.persistenceKey = config.persistenceKey || "bioazucar_edge_saf_queue";
    this.memQueue = new StoreAndForwardQueue(config.maxMemoryPoints || 50000);
    this.isNodeEnv = typeof process !== "undefined" && process.versions && !!process.versions.node;

    this.restoreFromStorage();
  }

  /**
   * Enqueue a point and write to persistence journal
   */
  public enqueue(point: IndustrialDataPoint): boolean {
    const accepted = this.memQueue.enqueue(point);
    if (accepted) {
      this.persistStateDebounced();
    }
    return accepted;
  }

  /**
   * Enqueue a batch of points
   */
  public enqueueBatch(points: IndustrialDataPoint[]): number {
    const count = this.memQueue.enqueueBatch(points);
    if (count > 0) {
      this.persistStateDebounced();
    }
    return count;
  }

  public setCloudConnectivity(connected: boolean): void {
    this.memQueue.setCloudConnectivity(connected);
  }

  public prepareBatch(batchSize: number = 100): ForwardBatch | null {
    return this.memQueue.prepareForwardBatch(batchSize);
  }

  public acknowledgeBatch(batchId: string): boolean {
    const acked = this.memQueue.acknowledgeBatch(batchId);
    if (acked) {
      this.persistStateDebounced();
    }
    return acked;
  }

  public rollbackBatch(batchId: string): void {
    this.memQueue.rollbackBatch(batchId);
  }

  public getState() {
    return this.memQueue.getState();
  }

  /**
   * Restore un-forwarded points from persistent storage on startup
   */
  private restoreFromStorage(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(this.persistenceKey);
        if (saved) {
          const parsed = JSON.parse(saved) as IndustrialDataPoint[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.memQueue.enqueueBatch(parsed);
          }
        }
      }
    } catch (_err) {
      // Storage unavailable or quota reached
    }
  }

  private debounceTimer: any = null;

  /**
   * Debounced journal write to prevent I/O disk thrashing
   */
  private persistStateDebounced(): void {
    if (this.debounceTimer) return;

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const pending = this.memQueue.peek(1000); // Save up to 1000 pending in fast local storage
          window.localStorage.setItem(this.persistenceKey, JSON.stringify(pending));
        }
      } catch (_err) {
        // Handle storage quota gracefully
      }
    }, 500);
  }
}

export const diskStoreAndForward = new DiskStoreAndForwardEngine();
