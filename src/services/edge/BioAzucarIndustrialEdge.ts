import {
  IndustrialDataPoint,
  DataQuality,
  DataSourceType,
  ProtocolType,
} from "../../types";
import {
  EdgeConnectorDiagnostics,
  EdgeConnectionStatus,
  CommandExecutionContract,
} from "./types";
import { StoreAndForwardQueue } from "./StoreAndForwardQueue";
import { OpcUaConnector } from "./connectors/OpcUaConnector";
import { ModbusConnector } from "./connectors/ModbusConnector";
import { ErosConnector } from "./connectors/ErosConnector";
import { MqttSparkplugConnector } from "./connectors/MqttSparkplugConnector";
import { commandService, CommandDispatcher } from "./CommandService";

export interface EdgeNodeConfig {
  edgeNodeId: string;
  name: string;
  siteId: string;
  tenantId: string;
  hardwareArch: string;
  osVersion: string;
  ipAddress: string;
  cloudBrokerUrl: string;
}

export class BioAzucarIndustrialEdge implements CommandDispatcher {
  private static instance: BioAzucarIndustrialEdge;

  readonly config: EdgeNodeConfig;
  readonly storeAndForward: StoreAndForwardQueue;

  // Active connectors
  readonly opcUa: OpcUaConnector;
  readonly modbus: ModbusConnector;
  readonly eros: ErosConnector;
  readonly sparkplug: MqttSparkplugConnector;

  // Live cache of latest points per tag
  private currentPoints = new Map<string, IndustrialDataPoint>();
  private tagSubscribers = new Map<string, Set<(point: IndustrialDataPoint) => void>>();
  private allSubscribers = new Set<(points: Map<string, IndustrialDataPoint>) => void>();

  private isRunning: boolean = false;
  private syncTimer: any = null;

  private constructor() {
    this.config = {
      edgeNodeId: "EDGE-CENTRAL-01",
      name: "BioAzúcar Industrial Edge Node #1 (Procesos Centrales)",
      siteId: "SITE_CENTRAL_01",
      tenantId: "TENANT_AZUCAR_01",
      hardwareArch: "IPC Advantech x86_64 Dual NIC (OT/DMZ)",
      osVersion: "Ubuntu Core Linux 22.04 LTS (Real-Time Kernel)",
      ipAddress: "192.168.10.2",
      cloudBrokerUrl: "tls://mqtt.bioazucar.internal:8883",
    };

    this.storeAndForward = new StoreAndForwardQueue(50000);

    // Initialize connectors with plant-standard configurations
    this.opcUa = new OpcUaConnector({
      id: "edge-opcua-main",
      name: "OPC UA Gateway IEC 62541 (KEPServerEX)",
      endpointUrl: "opc.tcp://192.168.10.50:4840/BioAzucarServer",
      securityPolicy: "Basic256Sha256",
      securityMode: "SignAndEncrypt",
      authMode: "Certificate",
      certRef: "vault://certs/opcua-edge-client.der",
      secretRef: "vault://secrets/opcua-key",
      timeoutMs: 3000,
      sessionTimeoutMs: 60000,
      reconnectBackoffMs: 2000,
      subscriptionConfig: {
        samplingIntervalMs: 500,
        publishingIntervalMs: 1000,
        queueSize: 10,
        discardOldest: true,
      },
    });

    this.modbus = new ModbusConnector({
      id: "edge-modbus-moxa",
      name: "Modbus TCP Gateway (Moxa NPort 5150A)",
      mode: "TCP",
      host: "192.168.20.15",
      port: 502,
      timeoutMs: 2500,
      maxRetries: 3,
      pollIntervalMs: 1000,
    });

    this.eros = new ErosConnector({
      plantId: "TENANT_AZUCAR_01",
      siteName: "SITE_CENTRAL_01",
      version: "4.8",
      supportedInterfaces: ["DIRECT_TCP", "OPC_UA_BRIDGE", "MODBUS_GATEWAY", "REST_API"],
      activeInterface: "OPC_UA_BRIDGE",
      host: "192.168.15.100",
      port: 9000,
      secretRef: "vault://secrets/eros-creds",
      pollingIntervalMs: 1000,
      timeoutMs: 3000,
      readOnlyMode: false,
    });

    this.sparkplug = new MqttSparkplugConnector({
      brokerUrl: "tls://mqtt.bioazucar.internal:8883",
      groupId: "BioAzucar",
      edgeNodeId: "Central-01",
      clientId: "bioazucar-edge-node-01",
      qos: 1,
      useTls: true,
      keepAliveSec: 30,
      cleanSession: false,
      certRef: "vault://certs/sparkplug-ca.crt",
    });

    // Register this Edge runtime as the Command Service dispatcher
    commandService.registerDispatcher(this);

    // Register standard Modbus tags
    this.registerStandardModbusTags();

    // Setup ingestion listener pipelines
    this.modbus.onDataPoint((pt) => this.ingestPoint(pt));
    this.sparkplug.onDataPoint((pt) => this.ingestPoint(pt));
  }

  public static getInstance(): BioAzucarIndustrialEdge {
    if (!BioAzucarIndustrialEdge.instance) {
      BioAzucarIndustrialEdge.instance = new BioAzucarIndustrialEdge();
    }
    return BioAzucarIndustrialEdge.instance;
  }

  /**
   * Start Edge Engine & establish industrial OT channels
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Connect to OT channels in parallel
    await Promise.allSettled([
      this.opcUa.connect(),
      this.modbus.connect(),
      this.eros.connect(),
      this.sparkplug.connect(),
    ]);

    // Start background sync loop for Store & Forward
    this.startStoreAndForwardSyncLoop();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    await Promise.allSettled([
      this.opcUa.disconnect(),
      this.modbus.disconnect(),
      this.eros.disconnect(),
      this.sparkplug.disconnect(),
    ]);
  }

  /**
   * Central Ingestion pipeline:
   * Validates quality, stores in Store & Forward buffer, updates live memory, and notifies subscribers.
   */
  public ingestPoint(point: IndustrialDataPoint): void {
    // 1. Data Quality Enforcement
    let evaluatedQuality: DataQuality = point.quality;
    let qualityReason = point.qualityReason;

    if (point.engMin !== undefined && typeof point.value === "number" && point.value < point.engMin) {
      evaluatedQuality = "OUT_OF_RANGE";
      qualityReason = `Valor ${point.value} inferior al rango mínimo (${point.engMin} ${point.unit})`;
    } else if (point.engMax !== undefined && typeof point.value === "number" && point.value > point.engMax) {
      evaluatedQuality = "OUT_OF_RANGE";
      qualityReason = `Valor ${point.value} superior al rango máximo (${point.engMax} ${point.unit})`;
    }

    const normalizedPoint: IndustrialDataPoint = {
      ...point,
      quality: evaluatedQuality,
      qualityReason,
      assetId: point.assetId || point.equipmentId,
      sequenceNumber: point.sequenceNumber ?? point.sequence,
    };

    // 2. Buffer into Store & Forward queue (preserves original deviceTimestamp & sequence)
    this.storeAndForward.enqueue(normalizedPoint);

    // 3. Update memory map
    this.currentPoints.set(normalizedPoint.tag, normalizedPoint);

    // 4. Notify tag subscribers
    const subs = this.tagSubscribers.get(normalizedPoint.tag);
    if (subs) {
      subs.forEach((cb) => cb(normalizedPoint));
    }
  }

  /**
   * Read single tag from Edge cache or active physical connector
   */
  public async readTag(tag: string): Promise<IndustrialDataPoint | null> {
    if (this.currentPoints.has(tag)) {
      return this.currentPoints.get(tag)!;
    }

    // Attempt direct reading from connector if tag belongs to specific subsystem
    if (tag.includes("EROS")) {
      const res = this.eros.readTag(tag);
      if (res.supported && res.point) {
        this.ingestPoint(res.point);
        return res.point;
      }
    } else if (tag.includes("Modbus") || tag.includes("Weight") || tag.includes("TruckScale")) {
      const pt = this.modbus.readTag(tag);
      if (pt) {
        this.ingestPoint(pt);
        return pt;
      }
    } else if (tag.includes("Milling") || tag.includes("Boiler") || tag.includes("Grid")) {
      const pt = await this.opcUa.readNode(`ns=2;s=${tag}`);
      if (pt) {
        this.ingestPoint(pt);
        return pt;
      }
    }

    return null;
  }

  /**
   * Batch read tags
   */
  public async readManyTags(tags: string[]): Promise<Map<string, IndustrialDataPoint>> {
    const res = new Map<string, IndustrialDataPoint>();
    for (const t of tags) {
      const pt = await this.readTag(t);
      if (pt) res.set(t, pt);
    }
    return res;
  }

  /**
   * Dispatches an authorized write contract to physical field device (CommandDispatcher implementation)
   */
  public async dispatchWrite(contract: CommandExecutionContract): Promise<{
    success: boolean;
    message: string;
    source: DataSourceType;
    protocol: ProtocolType;
  }> {
    const { tag, requestedValue } = contract;

    // Route to appropriate connector based on tag mapping
    if (tag.includes("EROS")) {
      const res = await this.eros.writeTag(tag, requestedValue as any);
      return {
        success: res.success,
        message: res.message,
        source: "EROS",
        protocol: "EROS-NATIVE",
      };
    }

    if (tag.includes("Modbus") || tag.includes("Scale") || tag.includes("Lab")) {
      const res = await this.modbus.writeTag(tag, requestedValue as any);
      return {
        success: res.success,
        message: res.message,
        source: "MODBUS",
        protocol: "MODBUS-TCP",
      };
    }

    if (tag.includes("Sparkplug") || tag.includes("UNS")) {
      const res = await this.sparkplug.handleCommand(tag, requestedValue);
      return {
        success: res.success,
        message: res.message,
        source: "MQTT",
        protocol: "MQTT-SPARKPLUG",
      };
    }

    // Default to OPC UA for process automation loops
    const nodeId = tag.startsWith("ns=") ? tag : `ns=2;s=${tag}`;
    const res = await this.opcUa.writeNode(nodeId, requestedValue);
    return {
      success: res.success,
      message: res.message,
      source: "OPC_UA",
      protocol: "OPC-UA",
    };
  }

  /**
   * Subscribe to single tag updates
   */
  public subscribeTag(tag: string, callback: (point: IndustrialDataPoint) => void): () => void {
    if (!this.tagSubscribers.has(tag)) {
      this.tagSubscribers.set(tag, new Set());
    }
    const subs = this.tagSubscribers.get(tag)!;
    subs.add(callback);

    // If point exists, emit immediately
    const existing = this.currentPoints.get(tag);
    if (existing) callback(existing);

    return () => {
      subs.delete(callback);
    };
  }

  /**
   * Subscribe to all tag updates
   */
  public subscribeAll(callback: (points: Map<string, IndustrialDataPoint>) => void): () => void {
    this.allSubscribers.add(callback);
    return () => {
      this.allSubscribers.delete(callback);
    };
  }

  /**
   * Get consolidated health diagnostics across all Edge connectors
   */
  public getConsolidatedDiagnostics(): {
    edgeNode: EdgeNodeConfig;
    connectors: EdgeConnectorDiagnostics[];
    storeAndForward: ReturnType<StoreAndForwardQueue["getState"]>;
    overallHealth: "HEALTHY" | "DEGRADED" | "CRITICAL";
  } {
    const connectors = [
      this.opcUa.getDiagnostics(),
      this.modbus.getDiagnostics(),
      this.eros.getDiagnostics(),
      this.sparkplug.getDiagnostics(),
    ];
    const healthyCount = connectors.filter((c) => c.status === "CONNECTED").length;
    const overallHealth =
      healthyCount === connectors.length ? "HEALTHY" : healthyCount > 0 ? "DEGRADED" : "CRITICAL";

    return {
      edgeNode: { ...this.config },
      connectors,
      storeAndForward: this.storeAndForward.getState(),
      overallHealth,
    };
  }

  private registerStandardModbusTags(): void {
    this.modbus.registerTags([
      {
        tag: "Modbus.Scale1.GrossWeight_Tons",
        name: "Báscula Camiones Caña 01 (Bruto)",
        unitId: 1,
        functionCode: 3,
        registerAddress: 40001,
        registerType: "HOLDING_REGISTER",
        dataType: "FLOAT32",
        byteOrder: "CDAB",
        scale: 0.001,
        offset: 0,
        unit: "t",
        pollingIntervalMs: 1000,
        timeoutMs: 2000,
        retries: 3,
        assetId: "eq-bascula-1",
        areaId: "RECEPCION_CANA",
        tenantId: this.config.tenantId,
      },
      {
        tag: "Modbus.Lab.Polarimeter_Brix",
        name: "Analizador NIR Laboratorio Brix",
        unitId: 2,
        functionCode: 4,
        registerAddress: 30010,
        registerType: "INPUT_REGISTER",
        dataType: "FLOAT32",
        byteOrder: "AB",
        scale: 0.1,
        offset: 0,
        unit: "°Bx",
        pollingIntervalMs: 2000,
        timeoutMs: 2000,
        retries: 3,
        assetId: "eq-lab-nir",
        areaId: "LABORATORIO",
        tenantId: this.config.tenantId,
      },
    ]);
  }

  private startStoreAndForwardSyncLoop(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);

    // Sync batches every 1500ms
    this.syncTimer = setInterval(() => {
      if (!this.storeAndForward.getCloudConnectivity()) return;

      const batch = this.storeAndForward.prepareForwardBatch(50);
      if (batch && batch.points.length > 0) {
        // Simulated transmission across DMZ to Cloud Historian
        this.storeAndForward.acknowledgeBatch(batch.batchId);
      }
    }, 1500);
  }
}

export const industrialEdge = BioAzucarIndustrialEdge.getInstance();
