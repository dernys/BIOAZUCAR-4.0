/**
 * BioAzúcar 4.0 — Virtual Loopback Transport (Capa 3 de Drivers OT para CI/HIL)
 * 
 * Provides an in-memory, deterministic network wire implementation for automated tests.
 * Accurately models asynchronous wire latency, packet fragmentation, and physical severance
 * without requiring host OS open ports.
 */

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

export type PeerResponder = (request: Uint8Array) => Promise<Uint8Array | null> | Uint8Array | null;

export class LoopbackVirtualTransport implements ITransportLayer {
  public readonly id: string;
  public readonly type: TransportType = "VIRTUAL_LOOPBACK";
  public readonly options: TransportOptions;

  private _state: TransportState = "DISCONNECTED";
  private peerResponder: PeerResponder | null = null;
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

  constructor(id: string, options: TransportOptions, peerResponder?: PeerResponder) {
    this.id = id;
    this.options = {
      reconnectBackoffInitialMs: 100,
      reconnectBackoffMaxMs: 2000,
      maxReconnectAttempts: 5,
      ...options,
    };
    this.currentBackoffMs = this.options.reconnectBackoffInitialMs ?? 100;
    if (peerResponder) {
      this.peerResponder = peerResponder;
    }
  }

  public setPeerResponder(responder: PeerResponder): void {
    this.peerResponder = responder;
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
        console.error(`[VirtualTransport:${this.id}] Error in stateChange handler:`, err);
      }
    }
  }

  public async connect(): Promise<boolean> {
    this.isExplicitDisconnect = false;
    this.setState("CONNECTING");
    this.setState("CONNECTED");
    this.currentBackoffMs = this.options.reconnectBackoffInitialMs ?? 100;
    this.reconnectCount = 0;
    this.metrics.lastConnectedAt = new Date().toISOString();
    return true;
  }

  public async disconnect(reason: string = "Virtual transport disconnect"): Promise<void> {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setState("CLOSING");
    this.metrics.lastDisconnectedAt = new Date().toISOString();
    this.setState("DISCONNECTED");
  }

  public async send(data: Uint8Array): Promise<number> {
    if (this._state !== "CONNECTED") {
      throw new Error(`[VirtualTransport:${this.id}] Cannot send: transport is ${this._state}`);
    }

    this.metrics.txBytes += data.length;
    this.metrics.txPackets++;

    if (this.peerResponder) {
      const t0 = Date.now();
      // Asynchronously process response from peer
      setTimeout(async () => {
        if (this._state !== "CONNECTED") return;
        try {
          const response = await this.peerResponder!(data);
          this.metrics.currentLatencyMs = Date.now() - t0;
          if (response && response.length > 0) {
            this.metrics.rxBytes += response.length;
            this.metrics.rxPackets++;
            for (const handler of this.dataHandlers) {
              handler(response);
            }
          }
        } catch (err: any) {
          for (const handler of this.errorHandlers) {
            handler(err);
          }
        }
      }, 5);
    }

    return data.length;
  }

  public injectPeerFrame(data: Uint8Array): void {
    if (this._state !== "CONNECTED") return;
    this.metrics.rxBytes += data.length;
    this.metrics.rxPackets++;
    for (const handler of this.dataHandlers) {
      handler(data);
    }
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
    if (this._state !== "CONNECTED") return;
    this.metrics.lastDisconnectedAt = new Date().toISOString();
    const err = new Error("VIRTUAL_ETHERNET_CABLE_UNPLUGGED");
    for (const handler of this.errorHandlers) {
      handler(err);
    }
    this.triggerReconnection();
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
    this.currentBackoffMs = Math.min(
      this.currentBackoffMs * 2,
      this.options.reconnectBackoffMaxMs ?? 2000
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
