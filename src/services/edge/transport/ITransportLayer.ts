/**
 * BioAzúcar 4.0 — Universal Industrial Network Transport Layer (Capa 3 de Drivers OT)
 * 
 * Formal decoupled interface for low-level network and serial communications
 * (TCP, TLS/mTLS, SerialPort RS-485, and Virtual Loopback for testbeds).
 * Compliant with IEC 62443-3-3 network segmentation and ISA-95 L1/L2 boundaries.
 */

export type TransportType = "TCP" | "TLS" | "SERIAL" | "VIRTUAL_LOOPBACK";

export type TransportState = 
  | "DISCONNECTED" 
  | "CONNECTING" 
  | "CONNECTED" 
  | "RECONNECTING" 
  | "CLOSING" 
  | "FAULTED";

export interface TransportMetrics {
  txBytes: number;
  rxBytes: number;
  txPackets: number;
  rxPackets: number;
  reconnectAttempts: number;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  currentLatencyMs: number;
  unacknowledgedPackets: number;
}

export interface TransportOptions {
  host: string;
  port: number;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  keepAlive?: boolean;
  keepAliveInitialDelayMs?: number;
  noDelay?: boolean; // TCP_NODELAY (disable Nagle algorithm for real-time OT)
  reconnectBackoffInitialMs?: number;
  reconnectBackoffMaxMs?: number;
  maxReconnectAttempts?: number;
  // TLS/mTLS specific options
  tlsEnabled?: boolean;
  rejectUnauthorized?: boolean;
  caCertificatePem?: string;
  clientCertificatePem?: string;
  clientPrivateKeyPem?: string;
  expectedServerFingerprintSha256?: string;
  serverNameIndication?: string;
}

export type TransportDataHandler = (data: Uint8Array) => void;
export type TransportErrorHandler = (error: Error) => void;
export type TransportStateChangeHandler = (oldState: TransportState, newState: TransportState) => void;

/**
 * Universal Transport Interface implemented by all wire-level transports.
 */
export interface ITransportLayer {
  readonly id: string;
  readonly type: TransportType;
  readonly state: TransportState;
  readonly options: TransportOptions;
  
  /**
   * Opens the network or serial socket and performs protocol-level handshakes.
   */
  connect(): Promise<boolean>;

  /**
   * Gracefully closes the socket, releasing all OS resources.
   */
  disconnect(reason?: string): Promise<void>;

  /**
   * Transmits raw binary buffer over the wire.
   */
  send(data: Uint8Array): Promise<number>;

  /**
   * Registers a callback for incoming raw binary frames.
   */
  onData(handler: TransportDataHandler): void;

  /**
   * Registers a callback for socket errors.
   */
  onError(handler: TransportErrorHandler): void;

  /**
   * Registers a callback for state transitions (e.g. CONNECTED -> RECONNECTING).
   */
  onStateChange(handler: TransportStateChangeHandler): void;

  /**
   * Returns current transport telemetry.
   */
  getMetrics(): TransportMetrics;

  /**
   * Simulates a sudden physical link severance (cable pulled out) for resilience tests.
   */
  simulateLinkSeverance?(): void;
}
