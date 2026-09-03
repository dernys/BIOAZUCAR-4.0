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
import { industrialEdge, BioAzucarIndustrialEdge } from "../edge/BioAzucarIndustrialEdge";
import { commandService } from "../edge/CommandService";

export class EdgeDataProvider implements IIndustrialDataProvider {
  readonly id: string = "provider-bioazucar-edge";
  readonly name: string = "BioAzúcar Industrial Edge (OT/DMZ Multi-Protocol)";
  readonly source: DataSourceType = "OPC_UA"; // Canonical primary source
  readonly protocol: ProtocolType = "OPC-UA";

  private edge: BioAzucarIndustrialEdge;
  private connected: boolean = false;

  constructor(edgeInstance: BioAzucarIndustrialEdge = industrialEdge) {
    this.edge = edgeInstance;
  }

  async connect(): Promise<boolean> {
    try {
      await this.edge.start();
      this.connected = true;
      return true;
    } catch (err) {
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.edge.stop();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async readTag(tagAddress: string): Promise<IndustrialDataPoint | null> {
    return await this.edge.readTag(tagAddress);
  }

  async readManyTags(tagAddresses: string[]): Promise<Map<string, IndustrialDataPoint>> {
    return await this.edge.readManyTags(tagAddresses);
  }

  subscribeTag(tagAddress: string, callback: DataSubscriptionCallback): () => void {
    return this.edge.subscribeTag(tagAddress, callback);
  }

  subscribeAll(callback: BatchSubscriptionCallback): () => void {
    return this.edge.subscribeAll((pointMap) => {
      callback(Array.from(pointMap.values()));
    });
  }

  async writeTag(request: TagWriteRequest): Promise<TagWriteResult> {
    // Route write through industrial Command Service for strict RBAC & validation
    const execution = await commandService.executeCommand(
      {
        tag: request.tag,
        commandType: "CHANGE_SETPOINT",
        requestedValue: request.value,
        operatorId: request.operatorId || "OPERATOR-DEFAULT",
        reason: request.reason || "Ajuste operacional de proceso vía Edge Gateway",
        clientIp: "127.0.0.1",
        securityClearanceLevel: 2,
      },
      false
    );

    return {
      success: execution.status === "EXECUTED",
      tag: request.tag,
      newValue: request.value,
      timestamp: execution.contract?.timestamp || new Date().toISOString(),
      source: (execution.contract?.result?.source as any) || this.source,
      message: execution.message,
    };
  }

  async getDiagnostics(): Promise<ConnectionDiagnostics> {
    const diag = this.edge.getConsolidatedDiagnostics();
    const opcDiag = diag.connectors.find((c) => c.source === "OPC_UA");

    const totalSent = diag.connectors.reduce((acc, c) => acc + c.packetsSent, 0);
    const totalRecv = diag.connectors.reduce((acc, c) => acc + c.packetsReceived, 0);
    const totalErrors = diag.connectors.reduce((acc, c) => acc + c.errorCount, 0);
    const totalPackets = totalSent + totalRecv;
    const errorRate = totalPackets > 0 ? (totalErrors / totalPackets) * 100 : 0;

    return {
      connected: this.connected,
      status: this.connected ? "ONLINE" : "OFFLINE",
      protocol: this.protocol,
      source: this.source,
      lastPingMs: opcDiag?.latencyMs || 15,
      packetsReceived: totalRecv,
      packetsSent: totalSent,
      errorRatePercent: Number(errorRate.toFixed(1)),
      uptimeSeconds: opcDiag?.uptimeSeconds || 0,
      serverTime: new Date().toISOString(),
    };
  }

  async browseTags(): Promise<IndustrialTagDefinition[]> {
    const nodes = await this.edge.opcUa.browse();
    return nodes.map((n) => ({
      id: `tag-edge-${n.browseName}`,
      name: n.displayName,
      description: n.description || n.displayName,
      area: "MOLIENDA",
      equipmentId: "eq-molino-1",
      equipmentName: "BioAzúcar Edge Process Controller",
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

  public getEdgeInstance(): BioAzucarIndustrialEdge {
    return this.edge;
  }
}
