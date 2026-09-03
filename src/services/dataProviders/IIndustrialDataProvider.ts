import {
  IndustrialDataPoint,
  IndustrialTagDefinition,
  ConnectionDiagnostics,
  DataSourceType,
  ProtocolType,
} from "../../types";

export type DataSubscriptionCallback = (dataPoint: IndustrialDataPoint) => void;
export type BatchSubscriptionCallback = (dataPoints: IndustrialDataPoint[]) => void;

export interface TagWriteRequest {
  tag: string;
  value: number | string | boolean;
  operatorId: string;
  operatorRole: string;
  reason: string;
  securityClearanceLevel: number;
}

export interface TagWriteResult {
  success: boolean;
  tag: string;
  previousValue?: number | string | boolean;
  newValue: number | string | boolean;
  timestamp: string;
  source: DataSourceType;
  message: string;
  auditLogId?: string;
}

export interface IIndustrialDataProvider {
  readonly id: string;
  readonly name: string;
  readonly source: DataSourceType;
  readonly protocol: ProtocolType;

  /**
   * Connect to the underlying industrial source or start simulator
   */
  connect(): Promise<boolean>;

  /**
   * Disconnect safely
   */
  disconnect(): Promise<void>;

  /**
   * Check connection status
   */
  isConnected(): boolean;

  /**
   * Read single current value
   */
  readTag(tagAddress: string): Promise<IndustrialDataPoint | null>;

  /**
   * Read multiple current values
   */
  readManyTags(tagAddresses: string[]): Promise<Map<string, IndustrialDataPoint>>;

  /**
   * Subscribe to real-time updates for a single tag
   */
  subscribeTag(tagAddress: string, callback: DataSubscriptionCallback): () => void;

  /**
   * Subscribe to all active tags
   */
  subscribeAll(callback: BatchSubscriptionCallback): () => void;

  /**
   * Write setpoint or command to PLC/DCS through safe gateway
   */
  writeTag(request: TagWriteRequest): Promise<TagWriteResult>;

  /**
   * Get low-level telemetry diagnostics
   */
  getDiagnostics(): Promise<ConnectionDiagnostics>;

  /**
   * Browse available tags on device/server
   */
  browseTags(): Promise<IndustrialTagDefinition[]>;
}
