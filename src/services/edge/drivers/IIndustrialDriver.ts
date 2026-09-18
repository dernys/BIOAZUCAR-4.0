/**
 * BioAzúcar 4.0 — Canonical Industrial Driver Contract (IEC 62541 / Modbus / Sparkplug B)
 * 
 * Defines the unified interface for all industrial communication drivers (OPC UA, Modbus, MQTT, EROS).
 * Enforces strong typing, life-cycle management, health reporting, diagnostics, and safety boundaries.
 */

import {
  IndustrialProtocol,
  IndustrialDataPoint,
} from "../../../types";

export type DriverStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTHENTICATING"
  | "AUTHENTICATED"
  | "DEGRADED"
  | "FAULTED";

export type DriverErrorCode =
  | "CONNECTION_TIMEOUT"
  | "HOST_UNREACHABLE"
  | "PORT_CLOSED"
  | "TLS_HANDSHAKE_FAILED"
  | "CERTIFICATE_INVALID"
  | "CERTIFICATE_EXPIRED"
  | "AUTHENTICATION_FAILED"
  | "SESSION_TERMINATED"
  | "NODE_NOT_FOUND"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "READ_ONLY_MODE"
  | "SAFETY_INTERLOCK_VIOLATION"
  | "DEADBAND_VIOLATION"
  | "DEVICE_BUSY"
  | "PROTOCOL_ERROR"
  | "MODBUS_SECURITY_MTLS_FAILED"
  | "EROS_CONNECT_FAILED"
  | "CIP_SESSION_FAILED"
  | "S7_COMMUNICATION_ERROR";

export interface DriverError {
  code: DriverErrorCode;
  message: string;
  timestamp: string;
  tag?: string;
  underlyingError?: any;
}

export interface DriverHealth {
  driverId: string;
  protocol: IndustrialProtocol;
  status: DriverStatus;
  uptimeMs: number;
  connectedSince: string | null;
  lastHeartbeat: string | null;
  activeSubscriptionsCount: number;
  readSuccessCount: number;
  readErrorCount: number;
  writeSuccessCount: number;
  writeErrorCount: number;
  avgLatencyMs: number;
  lastError: DriverError | null;
  isPhysical: boolean;
}

export interface DriverDiagnostics {
  driverId: string;
  protocol: IndustrialProtocol;
  endpoint: string;
  securityMode: string;
  txPackets: number;
  rxPackets: number;
  bufferOccupancyPercent: number;
  lastError?: DriverError | null;
  details: Record<string, any>;
}

export interface TagSubscriptionOptions {
  samplingIntervalMs: number;
  deadband?: number;
  deadbandType?: "ABSOLUTE" | "PERCENT";
}

export type TagSubscriptionCallback = (dataPoint: IndustrialDataPoint) => void;

export interface TagSubscriptionHandle {
  id: string;
  tag: string;
  driverId: string;
  active: boolean;
  unsubscribe: () => Promise<void>;
}

export interface DriverConfig {
  id: string;
  name?: string;
  protocol: IndustrialProtocol;
  endpoint: string;
  readOnly?: boolean;
  timeoutMs?: number;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
  securityProfile?: {
    securityPolicy?: string;
    securityMode?: string;
    tlsVersion?: string;
    authType?: "ANONYMOUS" | "CERTIFICATE" | "TOKEN" | "BASIC_AUTH";
    certificateRef?: string;
    secretRef?: string;
  };
  isSimulatedFallback?: boolean;
  customParameters?: Record<string, any>;
}

/**
 * Universal Driver Interface for OT Communication.
 * Every physical or emulated driver MUST implement this contract.
 */
export interface IIndustrialDriver {
  readonly id: string;
  readonly protocol: IndustrialProtocol;
  readonly config: DriverConfig;
  readonly status: DriverStatus;

  /**
   * Establishes physical/network connection and completes authentication.
   */
  connect(): Promise<boolean>;

  /**
   * Gracefully terminates sessions, closes sockets and clears active subscriptions.
   */
  disconnect(): Promise<void>;

  /**
   * Reads a single tag from the industrial device.
   */
  readTag(tag: string): Promise<IndustrialDataPoint>;

  /**
   * Writes a single value to an industrial tag.
   * Safety rules enforced: throws if driver is readOnly or safety interlocks trip.
   */
  writeTag(
    tag: string,
    value: number | string | boolean,
    clearanceLevel?: number,
    justification?: string
  ): Promise<boolean>;

  /**
   * Subscribes to telemetry on a tag with deadband filtering and rate control.
   */
  subscribe(
    tag: string,
    options: TagSubscriptionOptions,
    callback: TagSubscriptionCallback
  ): Promise<TagSubscriptionHandle>;

  /**
   * Retrieves operational health indicators for Prometheus metrics and SCADA status.
   */
  getHealth(): DriverHealth;

  /**
   * Retrieves low-level diagnostics for engineering consoles.
   */
  getDiagnostics(): DriverDiagnostics;
}
