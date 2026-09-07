import {
  IndustrialDataPoint,
  DataQuality,
  ProtocolType,
} from "../../../types";
import {
  OpcUaSecurityPolicy,
  OpcUaSecurityMode,
  OpcUaAuthMode,
  OpcUaEndpointInfo,
  OpcUaSubscriptionConfig,
  OpcUaNodeDefinition,
  EdgeConnectorDiagnostics,
  EdgeConnectionStatus,
} from "../types";

export interface OpcUaConnectionOptions {
  id: string;
  name: string;
  endpointUrl: string;
  securityPolicy: OpcUaSecurityPolicy;
  securityMode: OpcUaSecurityMode;
  authMode: OpcUaAuthMode;
  username?: string;
  secretRef?: string;
  certRef?: string;
  timeoutMs: number;
  sessionTimeoutMs: number;
  reconnectBackoffMs: number;
  subscriptionConfig: OpcUaSubscriptionConfig;
}

export class OpcUaConnector {
  readonly id: string;
  readonly name: string;
  readonly options: OpcUaConnectionOptions;

  private status: EdgeConnectionStatus = "DISCONNECTED";
  private statusMessage: string = "Inicializado sin conexión activa";
  private connectedSince: string | null = null;
  private lastSeen: string | null = null;
  private lastError: string | null = null;

  // Operational metrics
  private latencyMs: number = 0;
  private packetsReceived: number = 0;
  private packetsSent: number = 0;
  private reconnectCount: number = 0;
  private errorCount: number = 0;
  private timeoutCount: number = 0;
  private clockSkewMs: number = 0;

  // Monitored nodes & subscriptions
  private monitoredNodes = new Map<string, {
    samplingIntervalMs: number;
    lastValue: any;
    lastSourceTimestamp: string;
    subscribers: Set<(point: IndustrialDataPoint) => void>;
  }>();

  private subscriptionTimer: any = null;

  // Server address space cache (hierarchical)
  private addressSpaceCache: OpcUaNodeDefinition[] = [
    {
      nodeId: "ns=2;s=Milling.Tandem.TCH_Actual",
      browseName: "TCH_Actual",
      displayName: "Flujo de Caña TCH Molienda Actual",
      nodeClass: "Variable",
      dataType: "Double",
      accessLevel: "CurrentReadOrWrite",
      description: "Tasa horaria de molienda en toneladas de caña fresca por hora",
    },
    {
      nodeId: "ns=2;s=Milling.Tandem.Extraction_Percent",
      browseName: "Extraction_Percent",
      displayName: "Porcentaje Extracción Sacarosa",
      nodeClass: "Variable",
      dataType: "Double",
      accessLevel: "CurrentRead",
      description: "Eficiencia de extracción de sacarosa en tándem de molinos",
    },
    {
      nodeId: "ns=2;s=Milling.Mill3.VibrationRMS",
      browseName: "VibrationRMS",
      displayName: "Vibración Molino 3 Chumacera",
      nodeClass: "Variable",
      dataType: "Double",
      accessLevel: "CurrentRead",
      description: "Velocidad de vibración RMS en chumacera principal ISO 10816",
    },
    {
      nodeId: "ns=2;s=Boiler1.Steam_Pressure_HP",
      browseName: "Steam_Pressure_HP",
      displayName: "Presión Vapor Alta Caldera 1",
      nodeClass: "Variable",
      dataType: "Double",
      accessLevel: "CurrentReadOrWrite",
      description: "Presión manométrica de vapor sobrecalentado a 485°C",
    },
    {
      nodeId: "ns=2;s=Grid.Substation.ExportPower_MW",
      browseName: "ExportPower_MW",
      displayName: "Potencia Eléctrica Despacho Red",
      nodeClass: "Variable",
      dataType: "Double",
      accessLevel: "CurrentReadOrWrite",
      description: "Potencia activa neta inyectada al Sistema Eléctrico Nacional",
    },
    {
      nodeId: "ns=2;s=Evaporator.Body4.Syrup_Brix",
      browseName: "Syrup_Brix",
      displayName: "Grados Brix Meladura Salida Evaporador",
      nodeClass: "Variable",
      dataType: "Double",
      accessLevel: "CurrentRead",
      description: "Densidad refractométrica de meladura concentrada en cuerpo 4",
    },
  ];

  constructor(options: OpcUaConnectionOptions) {
    this.id = options.id;
    this.name = options.name;
    this.options = options;
  }

  /**
   * Endpoint discovery service (OPC UA Discovery Service Set: FindServers / GetEndpoints)
   */
  public async getEndpoints(): Promise<OpcUaEndpointInfo[]> {
    this.packetsSent++;
    this.packetsReceived++;
    const endpoints: OpcUaEndpointInfo[] = [
      {
        endpointUrl: this.options.endpointUrl,
        serverName: "KEPServerEX / BioAzúcar DCS Gateway",
        securityPolicy: "Basic256Sha256",
        securityMode: "SignAndEncrypt",
        transportProfileUri: "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary",
        certificateThumbprint: "7A4F903B1E62C8F3341850AA62E4091C9A0F612B",
      },
    ];

    // SEC-9: Insecure endpoints (SecurityPolicy=None, SecurityMode=None) strictly limited to dev/test environments
    if (process.env.NODE_ENV !== "production") {
      endpoints.push({
        endpointUrl: `${this.options.endpointUrl}/None`,
        serverName: "KEPServerEX / BioAzúcar DCS Gateway (Insecure Test Only - DEV/TEST)",
        securityPolicy: "None",
        securityMode: "None",
        transportProfileUri: "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary",
      });
    }

    return endpoints;
  }

  /**
   * Establishes OPC UA Secure Channel and creates a client session
   */
  public async connect(): Promise<boolean> {
    try {
      this.status = "RECONNECTING";
      this.statusMessage = `Negociando canal seguro OPC UA (${this.options.securityPolicy} / ${this.options.securityMode}) con ${this.options.endpointUrl}...`;

      const t0 = Date.now();
      await new Promise((r) => setTimeout(r, 120)); // simulated cryptographic handshake
      this.latencyMs = Date.now() - t0;
      this.clockSkewMs = -3; // slight clock difference between PLC and Edge server

      this.status = "CONNECTED";
      this.statusMessage = `Canal seguro y sesión OPC UA activa. Modo de cifrado: ${this.options.securityMode}, Política: ${this.options.securityPolicy}.`;
      this.connectedSince = new Date().toISOString();
      this.lastSeen = new Date().toISOString();
      this.reconnectCount++;

      this.startSubscriptionWorker();
      return true;
    } catch (err: any) {
      this.status = "PROTOCOL_ERROR";
      this.statusMessage = `Error de protocolo OPC UA al establecer sesión: ${err.message}`;
      this.lastError = err.message;
      this.errorCount++;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.subscriptionTimer) {
      clearInterval(this.subscriptionTimer);
      this.subscriptionTimer = null;
    }
    this.status = "DISCONNECTED";
    this.statusMessage = "Sesión cerrada correctamente.";
  }

  public isConnected(): boolean {
    return this.status === "CONNECTED";
  }

  /**
   * Browse address space (OPC UA View Service Set: Browse / BrowseNext)
   */
  public async browse(nodeId: string = "RootFolder"): Promise<OpcUaNodeDefinition[]> {
    this.packetsSent++;
    this.packetsReceived++;
    if (!this.isConnected()) {
      return [];
    }
    return this.addressSpaceCache;
  }

  /**
   * Read single node (OPC UA Attribute Service Set: Read)
   */
  public async readNode(nodeId: string): Promise<IndustrialDataPoint | null> {
    const nodeDef = this.addressSpaceCache.find((n) => n.nodeId === nodeId);
    const nodeName = nodeDef?.browseName || nodeId;

    const sourceTimestamp = new Date(Date.now() + this.clockSkewMs).toISOString(); // PLC timestamp
    const ingestionTimestamp = new Date().toISOString(); // Edge receipt timestamp

    this.packetsSent++;

    if (!this.isConnected()) {
      this.timeoutCount++;
      return {
        id: `dp-opc-${Date.now()}`,
        tag: nodeId,
        equipmentId: this.deriveAssetId(nodeId),
        assetId: this.deriveAssetId(nodeId),
        areaId: this.deriveAreaId(nodeId),
        value: 0,
        unit: this.deriveUnit(nodeId),
        dataType: "FLOAT",
        source: "OPC_UA",
        protocol: "OPC-UA",
        quality: "COMMUNICATION_LOST",
        qualityReason: "Servidor OPC UA fuera de línea o sesión desconectada (StatusCode: BadServerNotConnected)",
        deviceTimestamp: sourceTimestamp,
        ingestionTimestamp,
        sequence: ++this.packetsReceived,
        isHistorical: false,
        isSimulated: true, // SEC-10: Simulated connector
        provenance: "SIMULATED_PROCESS_MODEL",
      };
    }

    this.packetsReceived++;
    this.lastSeen = ingestionTimestamp;

    // Simulated value reading from physical address
    const val = this.getSimulatedPhysicalValue(nodeId);

    return {
      id: `dp-opc-${Date.now()}`,
      tag: nodeId,
      equipmentId: this.deriveAssetId(nodeId),
      assetId: this.deriveAssetId(nodeId),
      areaId: this.deriveAreaId(nodeId),
      value: val,
      unit: this.deriveUnit(nodeId),
      dataType: "FLOAT",
      source: "OPC_UA",
      protocol: "OPC-UA",
      quality: "SIMULATED", // SEC-10: Must reflect simulated nature
      provenance: "SIMULATED_PROCESS_MODEL",
      deviceTimestamp: sourceTimestamp,
      ingestionTimestamp,
      sequence: this.packetsReceived,
      isHistorical: false,
      isSimulated: true, // SEC-10: Simulated connector
      description: nodeDef?.description,
    };
  }

  /**
   * Batch Read (OPC UA Attribute Service Set: Read multiple DataValues)
   */
  public async readNodes(nodeIds: string[]): Promise<Map<string, IndustrialDataPoint>> {
    const results = new Map<string, IndustrialDataPoint>();
    for (const id of nodeIds) {
      const pt = await this.readNode(id);
      if (pt) results.set(id, pt);
    }
    return results;
  }

  /**
   * Write node value (OPC UA Attribute Service Set: Write)
   */
  public async writeNode(nodeId: string, value: number | string | boolean): Promise<{ success: boolean; message: string }> {
    this.packetsSent++;

    if (!this.isConnected()) {
      return {
        success: false,
        message: `Fallo al escribir en ${nodeId}: Servidor OPC UA desconectado (StatusCode: BadNoCommunication)`,
      };
    }

    const nodeDef = this.addressSpaceCache.find((n) => n.nodeId === nodeId);
    if (nodeDef && nodeDef.accessLevel === "CurrentRead") {
      return {
        success: false,
        message: `Nodo ${nodeId} es de solo lectura en el servidor OPC UA (StatusCode: BadNotWritable)`,
      };
    }

    this.packetsReceived++;
    this.lastSeen = new Date().toISOString();

    return {
      success: true,
      message: `Escritura OPC UA confirmada en ${nodeId} con valor ${value} (StatusCode: Good, StatusCodeId: 0x00000000).`,
    };
  }

  /**
   * Subscribe to node data changes (OPC UA MonitoredItemServiceSet: CreateMonitoredItems)
   */
  public subscribeNode(nodeId: string, callback: (point: IndustrialDataPoint) => void): () => void {
    if (!this.monitoredNodes.has(nodeId)) {
      this.monitoredNodes.set(nodeId, {
        samplingIntervalMs: this.options.subscriptionConfig.samplingIntervalMs,
        lastValue: null,
        lastSourceTimestamp: "",
        subscribers: new Set(),
      });
    }

    const entry = this.monitoredNodes.get(nodeId)!;
    entry.subscribers.add(callback);

    // Immediately trigger first read
    this.readNode(nodeId).then((pt) => {
      if (pt) callback(pt);
    });

    return () => {
      entry.subscribers.delete(callback);
      if (entry.subscribers.size === 0) {
        this.monitoredNodes.delete(nodeId);
      }
    };
  }

  /**
   * Query OPC UA HDA Historical Access (OPC UA Part 11)
   */
  public async readRawHistory(
    nodeId: string,
    startTime: string,
    endTime: string,
    maxPoints: number = 50
  ): Promise<IndustrialDataPoint[]> {
    this.packetsSent++;
    this.packetsReceived++;

    const points: IndustrialDataPoint[] = [];
    const tStart = new Date(startTime).getTime();
    const tEnd = new Date(endTime).getTime();
    const step = (tEnd - tStart) / maxPoints;

    for (let i = 0; i < maxPoints; i++) {
      const ts = new Date(tStart + i * step).toISOString();
      points.push({
        id: `hda-${nodeId}-${i}`,
        tag: nodeId,
        equipmentId: this.deriveAssetId(nodeId),
        areaId: this.deriveAreaId(nodeId),
        value: Number((450 + Math.sin(i * 0.2) * 20).toFixed(1)),
        unit: this.deriveUnit(nodeId),
        dataType: "FLOAT",
        source: "OPC_UA",
        protocol: "OPC-UA",
        quality: "SIMULATED",
        provenance: "SIMULATED_PROCESS_MODEL",
        deviceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: i,
        isHistorical: true,
        isSimulated: true,
      });
    }

    return points;
  }

  private startSubscriptionWorker(): void {
    if (this.subscriptionTimer) clearInterval(this.subscriptionTimer);

    this.subscriptionTimer = setInterval(async () => {
      if (!this.isConnected()) return;

      for (const [nodeId, item] of this.monitoredNodes.entries()) {
        const pt = await this.readNode(nodeId);
        if (pt) {
          item.subscribers.forEach((cb) => cb(pt));
        }
      }
    }, this.options.subscriptionConfig.publishingIntervalMs || 1000);
  }

  private deriveAssetId(nodeId: string): string {
    if (nodeId.includes("Milling") || nodeId.includes("Mill")) return "eq-molino-1";
    if (nodeId.includes("Boiler")) return "eq-caldera-1";
    if (nodeId.includes("Grid") || nodeId.includes("Substation")) return "eq-turbina-1";
    if (nodeId.includes("Evaporator")) return "eq-evaporadores";
    return "eq-generic-ot";
  }

  private deriveAreaId(nodeId: string): string {
    if (nodeId.includes("Milling") || nodeId.includes("Mill")) return "MOLIENDA";
    if (nodeId.includes("Boiler")) return "CALDERAS";
    if (nodeId.includes("Grid")) return "COGENERACION";
    if (nodeId.includes("Evaporator")) return "EVAPORACION";
    return "GENERAL";
  }

  private deriveUnit(nodeId: string): string {
    if (nodeId.includes("TCH")) return "TCH";
    if (nodeId.includes("Extraction")) return "%";
    if (nodeId.includes("Vibration")) return "mm/s";
    if (nodeId.includes("Pressure")) return "bar";
    if (nodeId.includes("Power") || nodeId.includes("MW")) return "MW";
    if (nodeId.includes("Brix")) return "°Bx";
    return "";
  }

  private getSimulatedPhysicalValue(nodeId: string): number {
    const hash = nodeId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const base = hash % 500;
    return Number((base + (Math.random() * 2 - 1)).toFixed(2));
  }

  public getDiagnostics(): EdgeConnectorDiagnostics {
    const totalPackets = this.packetsReceived + this.packetsSent;
    const errorRate = totalPackets > 0 ? (this.errorCount / totalPackets) * 100 : 0;
    const goodPercent = 100 - errorRate;

    return {
      connectorId: this.id,
      name: this.name,
      source: "OPC_UA",
      protocol: "OPC-UA",
      status: this.status,
      statusMessage: this.statusMessage,
      lastSeen: this.lastSeen,
      latencyMs: this.latencyMs,
      reconnectCount: this.reconnectCount,
      errorCount: this.errorCount,
      timeoutCount: this.timeoutCount,
      messageRateSec: this.isConnected() ? Math.round(this.monitoredNodes.size * 2) : 0,
      queueDepth: 0,
      qualityGoodPercentage: Number(goodPercent.toFixed(1)),
      qualityBadPercentage: Number(errorRate.toFixed(1)),
      clockSkewMs: this.clockSkewMs,
      packetsReceived: this.packetsReceived,
      packetsSent: this.packetsSent,
      uptimeSeconds: this.connectedSince ? Math.floor((Date.now() - new Date(this.connectedSince).getTime()) / 1000) : 0,
      connectedSince: this.connectedSince,
      lastError: this.lastError,
    };
  }
}
