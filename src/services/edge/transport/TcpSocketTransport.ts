/**
 * BioAzúcar 4.0 — Industrial TCP Socket Transport (Capa 3 de Drivers OT)
 * 
 * Production-ready TCP stream socket implementation with deterministic state machine,
 * exponential backoff reconnection, TCP_NODELAY for sub-millisecond dispatch,
 * and link severance injection for resilience testing.
 */

import * as net from "node:net";
import {
  ITransportLayer,
  TransportType,
  TransportState,
  TransportMetrics,
  TransportOptions,
  TransportDataHandler,
  TransportErrorHandler,
  TransportStateChangeHandler,
} from "./ITransportLayer";

export class TcpSocketTransport implements ITransportLayer {
  public readonly id: string;
  public readonly type: TransportType = "TCP";
  public readonly options: TransportOptions;

  private _state: TransportState = "DISCONNECTED";
  private socket: net.Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentBackoffMs: number;
  private reconnectCount: number = 0;
  private isExplicitDisconnect: boolean = false;

  private dataHandlers: Set<TransportDataHandler> = new Set();
  private errorHandlers: Set<TransportErrorHandler> = new Set();
  private stateChangeHandlers: Set<TransportStateChangeHandler> = new Set();

  private metrics: TransportMetrics = {
    txBytes: 0,
    rxBytes: 0,
    txPackets: 0,
    rxPackets: 0,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    currentLatencyMs: 0,
    unacknowledgedPackets: 0,
  };

  constructor(id: string, options: TransportOptions) {
    this.id = id;
    this.options = {
      timeoutMs: 5000,
      idleTimeoutMs: 15000,
      keepAlive: true,
      keepAliveInitialDelayMs: 5000,
      noDelay: true,
      reconnectBackoffInitialMs: 1000,
      reconnectBackoffMaxMs: 30000,
      maxReconnectAttempts: 10,
      ...options,
    };
    this.currentBackoffMs = this.options.reconnectBackoffInitialMs ?? 1000;
  }

  public get state(): TransportState {
    return this._state;
  }

  private setState(newState: TransportState): void {
    if (this._state === newState) return;
    const oldState = this._state;
    this._state = newState;
    for (const handler of this.stateChangeHandlers) {
      try {
        handler(oldState, newState);
      } catch (err) {
        console.error(`[TcpTransport:${this.id}] Error in stateChange handler:`, err);
      }
    }
  }

  public async connect(): Promise<boolean> {
    if (this._state === "CONNECTED" || this._state === "CONNECTING") {
      return this._state === "CONNECTED";
    }

    this.isExplicitDisconnect = false;
    this.setState("CONNECTING");

    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      this.socket = socket;

      if (this.options.noDelay) {
        socket.setNoDelay(true);
      }
      if (this.options.keepAlive) {
        socket.setKeepAlive(true, this.options.keepAliveInitialDelayMs ?? 5000);
      }
      if (this.options.timeoutMs) {
        socket.setTimeout(this.options.timeoutMs);
      }

      const connectionTimeout = setTimeout(() => {
        if (this._state === "CONNECTING") {
          socket.destroy(new Error(`TCP connect timeout after ${this.options.timeoutMs}ms`));
          this.setState("FAULTED");
          resolve(false);
        }
      }, this.options.timeoutMs ?? 5000);

      socket.connect(
        {
          host: this.options.host,
          port: this.options.port,
        },
        () => {
          clearTimeout(connectionTimeout);
          this.setState("CONNECTED");
          this.currentBackoffMs = this.options.reconnectBackoffInitialMs ?? 1000;
          this.reconnectCount = 0;
          this.metrics.lastConnectedAt = new Date().toISOString();
          resolve(true);
        }
      );

      socket.on("data", (chunk: Buffer) => {
        this.metrics.rxBytes += chunk.length;
        this.metrics.rxPackets++;
        const uint8 = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        for (const handler of this.dataHandlers) {
          try {
            handler(uint8);
          } catch (err) {
            console.error(`[TcpTransport:${this.id}] Error in data handler:`, err);
          }
        }
      });

      socket.on("error", (err: Error) => {
        clearTimeout(connectionTimeout);
        for (const handler of this.errorHandlers) {
          try {
            handler(err);
          } catch (e) {
            console.error(`[TcpTransport:${this.id}] Error in error handler:`, e);
          }
        }
        if (this._state === "CONNECTING") {
          this.setState("FAULTED");
          resolve(false);
        }
      });

      socket.on("close", (hadError: boolean) => {
        clearTimeout(connectionTimeout);
        this.metrics.lastDisconnectedAt = new Date().toISOString();
        if (this.socket === socket) {
          this.socket = null;
        }

        if (!this.isExplicitDisconnect) {
          this.triggerReconnection();
        } else {
          this.setState("DISCONNECTED");
        }
      });

      socket.on("timeout", () => {
        const timeoutErr = new Error(`Socket idle timeout after ${this.options.timeoutMs}ms`);
        socket.destroy(timeoutErr);
      });
    });
  }

  public async disconnect(reason: string = "User initiated disconnect"): Promise<void> {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.setState("CLOSING");
      this.socket.destroy();
      this.socket = null;
    }
    this.setState("DISCONNECTED");
  }

  public async send(data: Uint8Array): Promise<number> {
    if (this._state !== "CONNECTED" || !this.socket) {
      throw new Error(`[TcpTransport:${this.id}] Cannot send data: socket is ${this._state}`);
    }

    return new Promise<number>((resolve, reject) => {
      const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      this.socket!.write(buffer, (err) => {
        if (err) {
          this.metrics.unacknowledgedPackets++;
          reject(err);
        } else {
          this.metrics.txBytes += buffer.length;
          this.metrics.txPackets++;
          resolve(buffer.length);
        }
      });
    });
  }

  public onData(handler: TransportDataHandler): void {
    this.dataHandlers.add(handler);
  }

  public onError(handler: TransportErrorHandler): void {
    this.errorHandlers.add(handler);
  }

  public onStateChange(handler: TransportStateChangeHandler): void {
    this.stateChangeHandlers.add(handler);
  }

  public getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }

  public simulateLinkSeverance(): void {
    if (this.socket) {
      // Force immediate socket destroy simulating hardware Ethernet unplug
      this.socket.destroy(new Error("SIMULATED_PHYSICAL_LINK_SEVERANCE"));
    }
  }

  private triggerReconnection(): void {
    if (this.isExplicitDisconnect) return;

    if (
      this.options.maxReconnectAttempts !== undefined &&
      this.reconnectCount >= this.options.maxReconnectAttempts
    ) {
      this.setState("FAULTED");
      return;
    }

    this.setState("RECONNECTING");
    this.reconnectCount++;
    this.metrics.reconnectAttempts++;

    const delay = this.currentBackoffMs;
    // Exponential backoff with ceiling
    this.currentBackoffMs = Math.min(
      this.currentBackoffMs * 2,
      this.options.reconnectBackoffMaxMs ?? 30000
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        const ok = await this.connect();
        if (!ok && !this.isExplicitDisconnect) {
          this.triggerReconnection();
        }
      } catch (err) {
        this.triggerReconnection();
      }
    }, delay);
  }
}
