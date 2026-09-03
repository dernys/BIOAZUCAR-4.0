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
import { ModbusConnector } from "../edge/connectors/ModbusConnector";

export class ModbusDataProvider implements IIndustrialDataProvider {
  readonly id: string;
  readonly name: string;
  readonly source: DataSourceType = "MODBUS";
  readonly protocol: ProtocolType = "MODBUS-TCP";

  private host: string;
  private port: number;
  private unitId: number;
  private connected: boolean = false;
  private edgeConnector: ModbusConnector | null = null;

  constructor(
    id: string = "provider-modbus-moxa",
    name: string = "Modbus-TCP Instrumentation Hub",
    host: string = "192.168.20.15",
    port: number = 502,
    unitId: number = 1,
    edgeConnector?: ModbusConnector
  ) {
    this.id = id;
    this.name = name;
    this.host = host;
    this.port = port;
    this.unitId = unitId;
    if (edgeConnector) {
      this.edgeConnector = edgeConnector;
    }
  }

  public setEdgeConnector(connector: ModbusConnector): void {
    this.edgeConnector = connector;
  }

  public getEdgeConnector(): ModbusConnector | null {
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
    if (this.edgeConnector) {
      return this.edgeConnector.readTag(tagAddress);
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

    return {
      success: false,
      tag: request.tag,
      newValue: request.value,
      timestamp: new Date().toISOString(),
      source: this.source,
      message: `Escritura en registro Modbus ${request.tag} rechazada: Gateway ${this.host}:${this.port} no alcanzable en modo desarrollo.`,
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
