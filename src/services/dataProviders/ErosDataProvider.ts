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
import { IErosConnector, ErosAdapterPlaceholder } from "../erosConnector";
import { ErosConnector } from "../edge/connectors/ErosConnector";

export class ErosDataProvider implements IIndustrialDataProvider {
  readonly id: string;
  readonly name: string;
  readonly source: DataSourceType = "EROS";
  readonly protocol: ProtocolType = "EROS-NATIVE";

  private connector: IErosConnector;
  private edgeConnector: ErosConnector | null = null;

  constructor(
    id: string = "provider-eros-mill",
    name: string = "EROS Automation Adapter (Ingenio Integrator)",
    connector?: IErosConnector,
    edgeConnector?: ErosConnector
  ) {
    this.id = id;
    this.name = name;
    this.connector = connector || new ErosAdapterPlaceholder();
    if (edgeConnector) {
      this.edgeConnector = edgeConnector;
    }
  }

  public setEdgeConnector(edgeConnector: ErosConnector): void {
    this.edgeConnector = edgeConnector;
  }

  public getEdgeConnector(): ErosConnector | null {
    return this.edgeConnector;
  }

  async connect(): Promise<boolean> {
    if (this.edgeConnector) {
      return await this.edgeConnector.connect();
    }
    return false;
  }

  async disconnect(): Promise<void> {
    if (this.edgeConnector) {
      await this.edgeConnector.disconnect();
    }
    await this.connector.disconnect();
  }

  isConnected(): boolean {
    if (this.edgeConnector) {
      return this.edgeConnector.isConnected();
    }
    return this.connector.status === "CONNECTED";
  }

  async readTag(tagAddress: string): Promise<IndustrialDataPoint | null> {
    if (this.edgeConnector) {
      const res = this.edgeConnector.readTag(tagAddress);
      return res.supported && res.point ? res.point : null;
    }
    return null;
  }

  async readManyTags(tagAddresses: string[]): Promise<Map<string, IndustrialDataPoint>> {
    const map = new Map<string, IndustrialDataPoint>();
    for (const tag of tagAddresses) {
      const pt = await this.readTag(tag);
      if (pt) map.set(tag, pt);
    }
    return map;
  }

  subscribeTag(tagAddress: string, callback: DataSubscriptionCallback): () => void {
    return () => {};
  }

  subscribeAll(callback: BatchSubscriptionCallback): () => void {
    return () => {};
  }

  async writeTag(request: TagWriteRequest): Promise<TagWriteResult> {
    if (this.edgeConnector) {
      const res = await this.edgeConnector.writeTag(request.tag, request.value as any);
      return {
        success: res.success,
        tag: request.tag,
        newValue: request.value,
        timestamp: new Date().toISOString(),
        source: this.source,
        message: res.message,
      };
    }

    const res = await this.connector.writeRawSetpoint(request.tag, request.value, request.operatorId);
    return {
      success: res.success,
      tag: request.tag,
      newValue: request.value,
      timestamp: new Date().toISOString(),
      source: this.source,
      message: res.message,
    };
  }

  async getDiagnostics(): Promise<ConnectionDiagnostics> {
    if (this.edgeConnector) {
      const diag = this.edgeConnector.getDiagnostics();
      return {
        connected: diag.status === "CONNECTED",
        status: diag.status === "CONNECTED" ? "ONLINE" : "OFFLINE",
        protocol: this.protocol,
        source: this.source,
        lastPingMs: diag.latencyMs,
        packetsReceived: diag.packetsReceived,
        packetsSent: diag.packetsSent,
        errorRatePercent: diag.qualityBadPercentage,
        uptimeSeconds: diag.uptimeSeconds,
        serverTime: new Date().toISOString(),
      };
    }
    return this.connector.getHealthDiagnostics();
  }

  async browseTags(): Promise<IndustrialTagDefinition[]> {
    return [];
  }
}
