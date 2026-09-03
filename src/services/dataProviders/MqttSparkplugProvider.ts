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
import { MqttSparkplugConnector } from "../edge/connectors/MqttSparkplugConnector";

export class MqttSparkplugProvider implements IIndustrialDataProvider {
  readonly id: string;
  readonly name: string;
  readonly source: DataSourceType = "MQTT";
  readonly protocol: ProtocolType = "MQTT-SPARKPLUG";

  private brokerUrl: string;
  private groupId: string;
  private edgeNodeId: string;
  private connected: boolean = false;
  private edgeConnector: MqttSparkplugConnector | null = null;
  private receivedPoints = new Map<string, IndustrialDataPoint>();

  constructor(
    id: string = "provider-sparkplug-broker",
    name: string = "EMQX Sparkplug B / Unified Namespace",
    brokerUrl: string = "tls://mqtt.bioazucar.internal:8883",
    groupId: string = "BioAzucar",
    edgeNodeId: string = "Central-01",
    edgeConnector?: MqttSparkplugConnector
  ) {
    this.id = id;
    this.name = name;
    this.brokerUrl = brokerUrl;
    this.groupId = groupId;
    this.edgeNodeId = edgeNodeId;
    if (edgeConnector) {
      this.edgeConnector = edgeConnector;
      this.edgeConnector.onDataPoint((pt) => {
        this.receivedPoints.set(pt.tag, pt);
      });
    }
  }

  public setEdgeConnector(edgeConnector: MqttSparkplugConnector): void {
    this.edgeConnector = edgeConnector;
    this.edgeConnector.onDataPoint((pt) => {
      this.receivedPoints.set(pt.tag, pt);
    });
  }

  public getEdgeConnector(): MqttSparkplugConnector | null {
    return this.edgeConnector;
  }

  async connect(): Promise<boolean> {
    if (this.edgeConnector) {
      this.connected = await this.edgeConnector.connect();
      return this.connected;
    }
    this.connected = false;
    return false;
  }

  async disconnect(): Promise<void> {
    if (this.edgeConnector) {
      await this.edgeConnector.disconnect();
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.edgeConnector ? this.edgeConnector.isConnected() : this.connected;
  }

  async readTag(tagAddress: string): Promise<IndustrialDataPoint | null> {
    return this.receivedPoints.get(tagAddress) || null;
  }

  async readManyTags(tagAddresses: string[]): Promise<Map<string, IndustrialDataPoint>> {
    const map = new Map<string, IndustrialDataPoint>();
    for (const tag of tagAddresses) {
      const pt = this.receivedPoints.get(tag);
      if (pt) map.set(tag, pt);
    }
    return map;
  }

  subscribeTag(tagAddress: string, callback: DataSubscriptionCallback): () => void {
    if (this.edgeConnector) {
      this.edgeConnector.onDataPoint((pt) => {
        if (pt.tag === tagAddress) callback(pt);
      });
    }
    return () => {};
  }

  subscribeAll(callback: BatchSubscriptionCallback): () => void {
    return () => {};
  }

  async writeTag(request: TagWriteRequest): Promise<TagWriteResult> {
    if (this.edgeConnector) {
      const res = await this.edgeConnector.handleCommand(request.tag, request.value);
      return {
        success: res.success,
        tag: request.tag,
        newValue: request.value,
        timestamp: new Date().toISOString(),
        source: this.source,
        message: res.message,
      };
    }

    return {
      success: false,
      tag: request.tag,
      newValue: request.value,
      timestamp: new Date().toISOString(),
      source: this.source,
      message: `Comando NCMD Sparkplug B no despachado: Broker ${this.brokerUrl} sin enlace activo.`,
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
