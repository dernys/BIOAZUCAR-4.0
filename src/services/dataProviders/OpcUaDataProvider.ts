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
import { OpcUaConnector } from "../edge/connectors/OpcUaConnector";

export class OpcUaDataProvider implements IIndustrialDataProvider {
  readonly id: string;
  readonly name: string;
  readonly source: DataSourceType = "OPC_UA";
  readonly protocol: ProtocolType = "OPC-UA";

  private endpointUrl: string;
  private securityPolicy: string;
  private connected: boolean = false;
  private activeTags = new Map<string, IndustrialDataPoint>();
  private edgeConnector: OpcUaConnector | null = null;

  constructor(
    id: string = "provider-opcua-main",
    name: string = "OPC-UA Plant Gateway (IEC 62541)",
    endpointUrl: string = "opc.tcp://192.168.10.50:4840",
    securityPolicy: string = "Basic256Sha256 / SignAndEncrypt",
    edgeConnector?: OpcUaConnector
  ) {
    this.id = id;
    this.name = name;
    this.endpointUrl = endpointUrl;
    this.securityPolicy = securityPolicy;
    if (edgeConnector) {
      this.edgeConnector = edgeConnector;
    }
  }

  public setEdgeConnector(connector: OpcUaConnector): void {
    this.edgeConnector = connector;
  }

  public getEdgeConnector(): OpcUaConnector | null {
    return this.edgeConnector;
  }

  async connect(): Promise<boolean> {
    if (this.edgeConnector) {
      this.connected = await this.edgeConnector.connect();
      return this.connected;
    }
    // Sandbox standalone mode without edge hardware
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
      const nodeId = tagAddress.startsWith("ns=") ? tagAddress : `ns=2;s=${tagAddress}`;
      return await this.edgeConnector.readNode(nodeId);
    }
    return this.activeTags.get(tagAddress) || null;
  }

  async readManyTags(tagAddresses: string[]): Promise<Map<string, IndustrialDataPoint>> {
    if (this.edgeConnector) {
      const nodeIds = tagAddresses.map((t) => (t.startsWith("ns=") ? t : `ns=2;s=${t}`));
      return await this.edgeConnector.readNodes(nodeIds);
    }
    const res = new Map<string, IndustrialDataPoint>();
    tagAddresses.forEach((t) => {
      const p = this.activeTags.get(t);
      if (p) res.set(t, p);
    });
    return res;
  }

  subscribeTag(tagAddress: string, callback: DataSubscriptionCallback): () => void {
    if (this.edgeConnector) {
      const nodeId = tagAddress.startsWith("ns=") ? tagAddress : `ns=2;s=${tagAddress}`;
      return this.edgeConnector.subscribeNode(nodeId, callback);
    }
    return () => {};
  }

  subscribeAll(callback: BatchSubscriptionCallback): () => void {
    return () => {};
  }

  async writeTag(request: TagWriteRequest): Promise<TagWriteResult> {
    if (this.edgeConnector) {
      const nodeId = request.tag.startsWith("ns=") ? request.tag : `ns=2;s=${request.tag}`;
      const res = await this.edgeConnector.writeNode(nodeId, request.value);
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
      message: `No se puede escribir en servidor OPC-UA (${this.endpointUrl}): Enlace físico OT pendiente de despliegue en planta.`,
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
      status: this.connected ? "ONLINE" : "OFFLINE",
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
    if (this.edgeConnector) {
      const nodes = await this.edgeConnector.browse();
      return nodes.map((n) => ({
        id: `tag-${n.browseName}`,
        name: n.displayName,
        description: n.description || n.displayName,
        area: "MOLIENDA",
        equipmentId: "eq-molino-1",
        equipmentName: "Molino Picador & Tándem 1",
        variable: n.browseName,
        unit: "",
        dataType: "FLOAT",
        source: "OPC_UA",
        protocol: "OPC-UA",
        address: n.nodeId,
        accessMode: n.accessLevel === "CurrentReadOrWrite" ? "READ_WRITE" : "READ",
        scanRateMs: 1000,
        deadband: 0.1,
        engMin: 0,
        engMax: 1000,
        historization: true,
        alarmEnabled: false,
        securityLevel: 2,
        status: "ACTIVE",
        tenantId: "TENANT_AZUCAR_01",
        createdAt: new Date().toISOString(),
      }));
    }
    return [];
  }
}
