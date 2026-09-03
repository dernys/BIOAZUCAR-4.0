import {
  IndustrialDataPoint,
  IndustrialTagDefinition,
  ConnectionDiagnostics,
  DataSourceType,
  ProtocolType,
} from "../../types";
import {
  IIndustrialDataProvider,
  DataSubscriptionCallback,
  BatchSubscriptionCallback,
  TagWriteRequest,
  TagWriteResult,
} from "./IIndustrialDataProvider";

export class RestDataProvider implements IIndustrialDataProvider {
  readonly id: string;
  readonly name: string;
  readonly source: DataSourceType = "REST";
  readonly protocol: ProtocolType = "REST-API";

  private baseUrl: string;
  private connected: boolean = false;

  constructor(
    id: string = "provider-rest-api",
    name: string = "REST API / Cloud Edge Ingestion",
    baseUrl: string = "https://edge.bioazucar.internal/api/v1/telemetry"
  ) {
    this.id = id;
    this.name = name;
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<boolean> {
    this.connected = false;
    return false;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async readTag(tagAddress: string): Promise<IndustrialDataPoint | null> {
    return null;
  }

  async readManyTags(tagAddresses: string[]): Promise<Map<string, IndustrialDataPoint>> {
    return new Map();
  }

  subscribeTag(tagAddress: string, callback: DataSubscriptionCallback): () => void {
    return () => {};
  }

  subscribeAll(callback: BatchSubscriptionCallback): () => void {
    return () => {};
  }

  async writeTag(request: TagWriteRequest): Promise<TagWriteResult> {
    return {
      success: false,
      tag: request.tag,
      newValue: request.value,
      timestamp: new Date().toISOString(),
      source: this.source,
      message: `REST API Ingestion endpoint no disponible en entorno de desarrollo.`,
    };
  }

  async getDiagnostics(): Promise<ConnectionDiagnostics> {
    return {
      connected: this.connected,
      status: "OFFLINE",
      protocol: this.protocol,
      source: this.source,
      lastPingMs: 0,
      packetsReceived: 0,
      packetsSent: 0,
      errorRatePercent: 100,
      uptimeSeconds: 0,
      serverTime: new Date().toISOString(),
    };
  }

  async browseTags(): Promise<IndustrialTagDefinition[]> {
    return [];
  }
}
