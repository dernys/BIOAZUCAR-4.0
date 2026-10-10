/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — ASSET & PROCESS GRAPH ENGINE (ISA-95 TOPOLOGY)
 * Traversal, Upstream/Downstream Lineage, and Inter-Asset Relations
 * ============================================================================
 */

import {
  TwinAssetMetadata,
  TwinSensorDefinition,
  TwinActuatorDefinition,
  ProcessFlowConnection,
  AssetGraphNode,
  AssetGraphEdge,
  AssetGraphSnapshot,
  TwinVariableLineage,
} from "../domain/DigitalTwinTypes";
import {
  CANONICAL_TWIN_ASSETS,
  CANONICAL_TWIN_SENSORS,
  CANONICAL_TWIN_ACTUATORS,
  CANONICAL_TWIN_FLOWS,
} from "../domain/TwinAssetCatalog";
import { CANONICAL_KPI_DEFINITIONS } from "../../kpiEngine";

export class AssetGraphEngine {
  private static instance: AssetGraphEngine | null = null;

  private assetsMap = new Map<string, TwinAssetMetadata>();
  private sensorsMap = new Map<string, TwinSensorDefinition>();
  private actuatorsMap = new Map<string, TwinActuatorDefinition>();
  private flows: ProcessFlowConnection[] = [];

  // Indexing maps for O(1) traversal
  private sensorsByEquipment = new Map<string, TwinSensorDefinition[]>();
  private actuatorsByEquipment = new Map<string, TwinActuatorDefinition[]>();
  private flowsBySource = new Map<string, ProcessFlowConnection[]>();
  private flowsByTarget = new Map<string, ProcessFlowConnection[]>();
  private tagToSensor = new Map<string, TwinSensorDefinition>();
  private addressToSensor = new Map<string, TwinSensorDefinition>();

  private constructor() {
    this.initializeCatalog();
  }

  public static getInstance(): AssetGraphEngine {
    if (!AssetGraphEngine.instance) {
      AssetGraphEngine.instance = new AssetGraphEngine();
    }
    return AssetGraphEngine.instance;
  }

  public static resetInstance(): void {
    AssetGraphEngine.instance = null;
  }

  private initializeCatalog(): void {
    // 1. Load Assets
    for (const asset of CANONICAL_TWIN_ASSETS) {
      this.assetsMap.set(asset.id, asset);
    }

    // 2. Load Sensors
    for (const sensor of CANONICAL_TWIN_SENSORS) {
      this.sensorsMap.set(sensor.id, sensor);
      this.tagToSensor.set(sensor.tagId, sensor);
      if (sensor.plcMemoryAddress) {
        this.addressToSensor.set(sensor.plcMemoryAddress, sensor);
      }

      const list = this.sensorsByEquipment.get(sensor.equipmentId) || [];
      list.push(sensor);
      this.sensorsByEquipment.set(sensor.equipmentId, list);
    }

    // 3. Load Actuators
    for (const actuator of CANONICAL_TWIN_ACTUATORS) {
      this.actuatorsMap.set(actuator.id, actuator);
      const list = this.actuatorsByEquipment.get(actuator.equipmentId) || [];
      list.push(actuator);
      this.actuatorsByEquipment.set(actuator.equipmentId, list);
    }

    // 4. Load Flows
    this.flows = [...CANONICAL_TWIN_FLOWS];
    for (const flow of this.flows) {
      const srcList = this.flowsBySource.get(flow.sourceEquipmentId) || [];
      srcList.push(flow);
      this.flowsBySource.set(flow.sourceEquipmentId, srcList);

      const tgtList = this.flowsByTarget.get(flow.targetEquipmentId) || [];
      tgtList.push(flow);
      this.flowsByTarget.set(flow.targetEquipmentId, tgtList);
    }
  }

  public getAsset(equipmentId: string): TwinAssetMetadata | undefined {
    return this.assetsMap.get(equipmentId);
  }

  public getAllAssets(): TwinAssetMetadata[] {
    return Array.from(this.assetsMap.values());
  }

  public getEquipmentSensors(equipmentId: string): TwinSensorDefinition[] {
    return this.sensorsByEquipment.get(equipmentId) || [];
  }

  public getEquipmentActuators(equipmentId: string): TwinActuatorDefinition[] {
    return this.actuatorsByEquipment.get(equipmentId) || [];
  }

  public getEquipmentFlows(equipmentId: string): {
    incoming: ProcessFlowConnection[];
    outgoing: ProcessFlowConnection[];
  } {
    return {
      incoming: this.flowsByTarget.get(equipmentId) || [],
      outgoing: this.flowsBySource.get(equipmentId) || [],
    };
  }

  public getUpstreamEquipment(equipmentId: string): TwinAssetMetadata[] {
    const incomingFlows = this.flowsByTarget.get(equipmentId) || [];
    const upstreamAssets: TwinAssetMetadata[] = [];
    for (const flow of incomingFlows) {
      const asset = this.assetsMap.get(flow.sourceEquipmentId);
      if (asset && !upstreamAssets.some((a) => a.id === asset.id)) {
        upstreamAssets.push(asset);
      }
    }
    return upstreamAssets;
  }

  public getDownstreamEquipment(equipmentId: string): TwinAssetMetadata[] {
    const outgoingFlows = this.flowsBySource.get(equipmentId) || [];
    const downstreamAssets: TwinAssetMetadata[] = [];
    for (const flow of outgoingFlows) {
      const asset = this.assetsMap.get(flow.targetEquipmentId);
      if (asset && !downstreamAssets.some((a) => a.id === asset.id)) {
        downstreamAssets.push(asset);
      }
    }
    return downstreamAssets;
  }

  /**
   * Builds complete topological graph snapshot around the plant or a focused equipment
   */
  public buildGraphSnapshot(focusEquipmentId?: string): AssetGraphSnapshot {
    const nodes: AssetGraphNode[] = [];
    const edges: AssetGraphEdge[] = [];
    const now = new Date().toISOString();

    const targetAssets = focusEquipmentId
      ? [
          this.assetsMap.get(focusEquipmentId),
          ...this.getUpstreamEquipment(focusEquipmentId),
          ...this.getDownstreamEquipment(focusEquipmentId),
        ].filter(Boolean) as TwinAssetMetadata[]
      : Array.from(this.assetsMap.values());

    for (const asset of targetAssets) {
      // Asset Node
      nodes.push({
        id: asset.id,
        label: asset.name,
        category: "EQUIPMENT",
        status: "RUNNING",
        metadata: {
          code: asset.code,
          areaId: asset.areaId,
          nominalCapacity: asset.designCapacity.nominalValue,
          unit: asset.designCapacity.unit,
        },
      });

      // Child Sensors
      const sensors = this.getEquipmentSensors(asset.id);
      for (const s of sensors) {
        nodes.push({
          id: s.id,
          label: s.name,
          category: "SENSOR",
          status: "NORMAL",
          parentId: asset.id,
          metadata: {
            tagId: s.tagId,
            unit: s.engineeringUnit,
            protocol: s.protocol,
            address: s.plcMemoryAddress,
          },
        });

        edges.push({
          id: `edge-${asset.id}-${s.id}`,
          sourceId: asset.id,
          targetId: s.id,
          relationType: "MEASURES",
        });
      }

      // Associated KPIs
      for (const kpi of CANONICAL_KPI_DEFINITIONS) {
        const matches = kpi.inputTags.some((tag) =>
          sensors.some((s) => s.tagId === tag)
        );
        if (matches) {
          const kpiNodeId = `kpi-${kpi.id}`;
          if (!nodes.some((n) => n.id === kpiNodeId)) {
            nodes.push({
              id: kpiNodeId,
              label: kpi.name,
              category: "KPI",
              status: "NORMAL",
              metadata: {
                unit: kpi.unit,
                formula: kpi.formula,
                targetValue: kpi.targetValue,
              },
            });
          }

          edges.push({
            id: `edge-${asset.id}-${kpiNodeId}`,
            sourceId: asset.id,
            targetId: kpiNodeId,
            relationType: "ASSOCIATED_KPI",
          });
        }
      }
    }

    // Material and Energy Flow Edges between visible nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const flow of this.flows) {
      if (nodeIds.has(flow.sourceEquipmentId) && nodeIds.has(flow.targetEquipmentId)) {
        edges.push({
          id: flow.id,
          sourceId: flow.sourceEquipmentId,
          targetId: flow.targetEquipmentId,
          relationType: flow.flowType === "MATERIAL" ? "FEEDS_MATERIAL" : "FEEDS_ENERGY",
          attributes: {
            rate: flow.currentRate,
            unit: flow.rateUnit,
            material: flow.materialSubtype,
            energy: flow.energySubtype,
            tag: flow.pipelineOrConveyorTag,
          },
        });
      }
    }

    return { nodes, edges, updatedAt: now };
  }

  /**
   * Resolves visual end-to-end data lineage for any tag or memory address:
   * Equipment -> Sensor -> Tag -> Provider -> Protocol -> Address
   */
  public resolveLineage(
    identifier: string,
    currentValue: number | string | boolean = 0,
    quality: any = "GOOD"
  ): TwinVariableLineage | undefined {
    const sensor =
      this.tagToSensor.get(identifier) ||
      this.addressToSensor.get(identifier) ||
      Array.from(this.sensorsMap.values()).find(
        (s) => s.id === identifier || s.variableName.toLowerCase() === identifier.toLowerCase()
      );

    if (!sensor) return undefined;

    const asset = this.assetsMap.get(sensor.equipmentId);
    return {
      variableName: sensor.name,
      currentValue,
      unit: sensor.engineeringUnit,
      quality,
      timestamp: new Date().toISOString(),
      chain: {
        equipmentName: asset ? asset.name : "Equipo Desconocido",
        equipmentCode: asset ? asset.code : "N/A",
        sensorName: sensor.name,
        tagPath: sensor.tagId,
        plcMemoryAddress: sensor.plcMemoryAddress,
        protocol: sensor.protocol,
        driverId: `driver-${sensor.protocol.toLowerCase()}-client-01`,
        sourceDevice: `PLC-${asset?.code || "DEFAULT"}`,
        provenance: quality === "SIMULATED" ? "SIMULATED" : "LIVE_OT",
        deviceClockSyncDeltaMs: 14,
      },
    };
  }
}

export const assetGraphEngine = AssetGraphEngine.getInstance();
