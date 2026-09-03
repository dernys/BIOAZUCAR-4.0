import { KnowledgeGraphNode, KnowledgeGraphEdge } from "../domain/CopilotKnowledgeTypes";

// ============================================================================
// BIOAZÚCAR 4.0 — INDUSTRIAL KNOWLEDGE GRAPH
// Explicit relational graph connecting Assets, Tags, KPIs, Alarms and SOPs
// ============================================================================

export const KNOWLEDGE_GRAPH_NODES: KnowledgeGraphNode[] = [
  // Tenants & Sites
  { id: "tenant-central-principal", type: "TENANT", name: "Central Azucarero Principal", code: "CENTRAL-01" },
  { id: "site-san-carlos", type: "SITE", name: "Planta Industrial San Carlos", code: "SITE-01" },

  // Areas
  { id: "area-recepcion", type: "AREA", name: "Recepción y Muestreo de Caña", code: "AREA-REC" },
  { id: "area-molienda", type: "AREA", name: "Tándem de Molienda y Extracción", code: "AREA-MOL" },
  { id: "area-calderas", type: "AREA", name: "Generación de Vapor & Calderas", code: "AREA-CAL" },
  { id: "area-cogeneracion", type: "AREA", name: "Turbogeneración & Despacho", code: "AREA-GEN" },
  { id: "area-evaporacion", type: "AREA", name: "Evaporación & Fabricación", code: "AREA-FAB" },
  { id: "area-uns", type: "AREA", name: "Infraestructura OT & UNS Hub", code: "AREA-UNS" },

  // Equipment
  { id: "eq-bascula-1", type: "EQUIPMENT", name: "Báscula de Entrada de Caña 1", code: "BAS-01" },
  { id: "eq-molino-1", type: "EQUIPMENT", name: "Molino 1 (Desmenuzador)", code: "MOL-01" },
  { id: "eq-molino-3", type: "EQUIPMENT", name: "Molino 3", code: "MOL-03" },
  { id: "eq-molino-5", type: "EQUIPMENT", name: "Molino 5 (Bagazo Final)", code: "MOL-05" },
  { id: "eq-caldera-1", type: "EQUIPMENT", name: "Caldera Acuotubular 1 (210 t/h)", code: "CAL-01" },
  { id: "eq-turbo-1", type: "EQUIPMENT", name: "Turbogenerador de Vapor 1 (35 MW)", code: "TG-01" },
  { id: "eq-subestacion-138", type: "EQUIPMENT", name: "Subestación Eléctrica 138 kV", code: "SE-138" },
  { id: "eq-edge-node-1", type: "EQUIPMENT", name: "BioAzúcar Industrial Edge Node 01", code: "EDGE-01" },

  // Industrial Tags
  { id: "tag-tch", type: "TAG", name: "Molienda Instantánea", code: "Milling.Tandem.TCH_Actual" },
  { id: "tag-milling-ext", type: "TAG", name: "Extracción Sacarosa Tándem", code: "Milling.Extraction_Percent" },
  { id: "tag-boiler-press-hp", type: "TAG", name: "Presión Vapor Alta HP", code: "Boiler1.Steam_Pressure_HP" },
  { id: "tag-boiler-temp-hp", type: "TAG", name: "Temperatura Vapor HP", code: "Boiler1.Steam_Temp_HP" },
  { id: "tag-boiler-flow-hp", type: "TAG", name: "Caudal Vapor HP", code: "Boiler1.Steam_Flow_HP" },
  { id: "tag-power-export", type: "TAG", name: "Potencia Exportada Red", code: "Grid.ExportPower_MW" },
  { id: "tag-mill3-vib-rms", type: "TAG", name: "Vibración Chumacera Molino 3", code: "Mill3.Bearing.Vibration_RMS" },
  { id: "tag-bagasse-moisture", type: "TAG", name: "Humedad de Bagazo", code: "Bagasse.Moisture_Percent" },
  { id: "tag-syrup-brix", type: "TAG", name: "Brix Meladura Evaporadores", code: "Evaporator.Syrup_Brix" },

  // Canonical KPIs
  { id: "kpi-tch", type: "KPI", name: "Toneladas de Caña por Hora (TCH)", code: "kpi-tch" },
  { id: "kpi-milling-extraction", type: "KPI", name: "Extracción de Sacarosa (%)", code: "kpi-milling-extraction" },
  { id: "kpi-steam-hp", type: "KPI", name: "Presión Vapor HP (bar)", code: "kpi-steam-hp" },
  { id: "kpi-power-export", type: "KPI", name: "Potencia Exportada (MW)", code: "kpi-power-export" },
  { id: "kpi-boiler-efficiency", type: "KPI", name: "Eficiencia Caldera ASME (%)", code: "kpi-boiler-efficiency" },
  { id: "kpi-oee-overall", type: "KPI", name: "Efectividad Global OEE (%)", code: "kpi-oee-overall" },

  // Alarms
  { id: "alm-boiler-high-press", type: "ALARM", name: "Alta Presión de Vapor en Domo Caldera 1", code: "ALM-BOILER-HIGH-PRESS" },
  { id: "alm-mill3-high-vib", type: "ALARM", name: "Alta Vibración Mecánica en Molino 3", code: "ALM-MILL3-HIGH-VIB" },
  { id: "alm-steam-temp-low", type: "ALARM", name: "Baja Temperatura de Vapor Sobrecalentado", code: "ALM-STEAM-TEMP-LOW" },
  { id: "alm-tch-low", type: "ALARM", name: "Baja Tasa de Molienda TCH", code: "ALM-TCH-LOW" },

  // Protocols & Connectors
  { id: "proto-opc-ua", type: "PROTOCOL", name: "OPC UA Connector (IEC 62541)", code: "OPC-UA" },
  { id: "proto-modbus-tcp", type: "PROTOCOL", name: "Modbus TCP Gateway", code: "MODBUS-TCP" },
  { id: "proto-sparkplug-b", type: "PROTOCOL", name: "MQTT Sparkplug B Broker", code: "MQTT-SPARKPLUG" },
  { id: "proto-eros-native", type: "PROTOCOL", name: "EROS DCS Sugar Adapter", code: "EROS-NATIVE" },

  // Procedures
  { id: "sop-change-dispatch-mw", type: "PROCEDURE", name: "Ajustar Consigna de Despacho MW", code: "SOP-DISP-01" },
  { id: "sop-acknowledge-alarm", type: "PROCEDURE", name: "Reconocer Alarma ISA-18.2", code: "SOP-ALM-01" },
  { id: "sop-register-batch", type: "PROCEDURE", name: "Registrar Lote de Caña LIMS", code: "SOP-BAT-01" },
  { id: "sop-diagnose-vibration", type: "PROCEDURE", name: "Diagnóstico Vibración FFT Molino", code: "SOP-VIB-01" },
  { id: "sop-switch-edge-provider", type: "PROCEDURE", name: "Conmutar a Edge Industrial OT", code: "SOP-EDGE-01" },
];

export const KNOWLEDGE_GRAPH_EDGES: KnowledgeGraphEdge[] = [
  // Hierarchy: Tenant -> Site -> Areas
  { source: "tenant-central-principal", target: "site-san-carlos", relation: "CONTAINS" },
  { source: "site-san-carlos", target: "area-recepcion", relation: "CONTAINS" },
  { source: "site-san-carlos", target: "area-molienda", relation: "CONTAINS" },
  { source: "site-san-carlos", target: "area-calderas", relation: "CONTAINS" },
  { source: "site-san-carlos", target: "area-cogeneracion", relation: "CONTAINS" },
  { source: "site-san-carlos", target: "area-evaporacion", relation: "CONTAINS" },
  { source: "site-san-carlos", target: "area-uns", relation: "CONTAINS" },

  // Areas -> Equipment
  { source: "area-recepcion", target: "eq-bascula-1", relation: "CONTAINS" },
  { source: "area-molienda", target: "eq-molino-1", relation: "CONTAINS" },
  { source: "area-molienda", target: "eq-molino-3", relation: "CONTAINS" },
  { source: "area-molienda", target: "eq-molino-5", relation: "CONTAINS" },
  { source: "area-calderas", target: "eq-caldera-1", relation: "CONTAINS" },
  { source: "area-cogeneracion", target: "eq-turbo-1", relation: "CONTAINS" },
  { source: "area-cogeneracion", target: "eq-subestacion-138", relation: "CONTAINS" },
  { source: "area-uns", target: "eq-edge-node-1", relation: "CONTAINS" },

  // Equipment -> Tags
  { source: "eq-molino-1", target: "tag-tch", relation: "MONITORS" },
  { source: "eq-molino-5", target: "tag-milling-ext", relation: "MONITORS" },
  { source: "eq-molino-3", target: "tag-mill3-vib-rms", relation: "MONITORS" },
  { source: "eq-caldera-1", target: "tag-boiler-press-hp", relation: "MONITORS" },
  { source: "eq-caldera-1", target: "tag-boiler-temp-hp", relation: "MONITORS" },
  { source: "eq-caldera-1", target: "tag-boiler-flow-hp", relation: "MONITORS" },
  { source: "eq-subestacion-138", target: "tag-power-export", relation: "MONITORS" },

  // Tags -> Protocols
  { source: "tag-tch", target: "proto-opc-ua", relation: "USES_PROTOCOL" },
  { source: "tag-boiler-press-hp", target: "proto-opc-ua", relation: "USES_PROTOCOL" },
  { source: "tag-power-export", target: "proto-modbus-tcp", relation: "USES_PROTOCOL" },
  { source: "tag-mill3-vib-rms", target: "proto-opc-ua", relation: "USES_PROTOCOL" },
  { source: "eq-edge-node-1", target: "proto-sparkplug-b", relation: "USES_PROTOCOL" },

  // Tags -> KPIs
  { source: "tag-tch", target: "kpi-tch", relation: "FEEDS" },
  { source: "tag-milling-ext", target: "kpi-milling-extraction", relation: "FEEDS" },
  { source: "tag-boiler-press-hp", target: "kpi-steam-hp", relation: "FEEDS" },
  { source: "tag-power-export", target: "kpi-power-export", relation: "FEEDS" },
  { source: "tag-boiler-press-hp", target: "kpi-boiler-efficiency", relation: "FEEDS" },
  { source: "tag-boiler-flow-hp", target: "kpi-boiler-efficiency", relation: "FEEDS" },
  { source: "kpi-tch", target: "kpi-oee-overall", relation: "FEEDS" },
  { source: "kpi-milling-extraction", target: "kpi-oee-overall", relation: "FEEDS" },

  // Tags/Equipment -> Alarms
  { source: "tag-boiler-press-hp", target: "alm-boiler-high-press", relation: "TRIGGERS" },
  { source: "tag-mill3-vib-rms", target: "alm-mill3-high-vib", relation: "TRIGGERS" },
  { source: "tag-boiler-temp-hp", target: "alm-steam-temp-low", relation: "TRIGGERS" },
  { source: "tag-tch", target: "alm-tch-low", relation: "TRIGGERS" },
  { source: "eq-molino-3", target: "alm-mill3-high-vib", relation: "MONITORS" },
  { source: "eq-caldera-1", target: "alm-boiler-high-press", relation: "MONITORS" },

  // Alarms / Entities -> Procedures
  { source: "alm-boiler-high-press", target: "sop-acknowledge-alarm", relation: "RESOLVES" },
  { source: "alm-mill3-high-vib", target: "sop-diagnose-vibration", relation: "RESOLVES" },
  { source: "eq-subestacion-138", target: "sop-change-dispatch-mw", relation: "RESOLVES" },
  { source: "eq-bascula-1", target: "sop-register-batch", relation: "RESOLVES" },
  { source: "eq-edge-node-1", target: "sop-switch-edge-provider", relation: "RESOLVES" },
];

/**
 * Knowledge Graph Query Helpers
 */
export class BioAzucarKnowledgeGraph {
  public static getAlarmsForEquipment(equipmentNameOrId: string): KnowledgeGraphNode[] {
    const term = equipmentNameOrId.toLowerCase();
    const eqNode = KNOWLEDGE_GRAPH_NODES.find(
      (n) =>
        n.type === "EQUIPMENT" &&
        (n.id.toLowerCase() === term || n.name.toLowerCase().includes(term) || (n.code && n.code.toLowerCase() === term))
    );

    if (!eqNode) return [];

    const alarmIds = KNOWLEDGE_GRAPH_EDGES
      .filter((e) => e.source === eqNode.id && (e.relation === "MONITORS" || e.relation === "TRIGGERS"))
      .map((e) => e.target);

    return KNOWLEDGE_GRAPH_NODES.filter((n) => n.type === "ALARM" && alarmIds.includes(n.id));
  }

  public static getTagsForKpi(kpiId: string): KnowledgeGraphNode[] {
    const targetKpi = KNOWLEDGE_GRAPH_NODES.find((n) => n.id === kpiId || n.code === kpiId);
    if (!targetKpi) return [];

    const tagIds = KNOWLEDGE_GRAPH_EDGES
      .filter((e) => e.target === targetKpi.id && e.relation === "FEEDS")
      .map((e) => e.source);

    return KNOWLEDGE_GRAPH_NODES.filter((n) => tagIds.includes(n.id));
  }

  public static getEquipmentForAlarm(alarmCodeOrId: string): KnowledgeGraphNode | undefined {
    const term = alarmCodeOrId.toLowerCase();
    const alarmNode = KNOWLEDGE_GRAPH_NODES.find(
      (n) => n.type === "ALARM" && (n.id.toLowerCase() === term || (n.code && n.code.toLowerCase() === term))
    );
    if (!alarmNode) return undefined;

    const edge = KNOWLEDGE_GRAPH_EDGES.find(
      (e) => e.target === alarmNode.id && (e.relation === "MONITORS" || e.relation === "TRIGGERS")
    );
    if (!edge) return undefined;

    return KNOWLEDGE_GRAPH_NODES.find((n) => n.id === edge.source);
  }

  public static getRelatedEntities(entityId: string): {
    node: KnowledgeGraphNode;
    connectedNodes: Array<{ relation: string; node: KnowledgeGraphNode }>;
  } | undefined {
    const node = KNOWLEDGE_GRAPH_NODES.find(
      (n) => n.id === entityId || (n.code && n.code.toLowerCase() === entityId.toLowerCase())
    );
    if (!node) return undefined;

    const outgoing = KNOWLEDGE_GRAPH_EDGES
      .filter((e) => e.source === node.id)
      .map((e) => ({
        relation: e.relation,
        node: KNOWLEDGE_GRAPH_NODES.find((n) => n.id === e.target)!,
      }))
      .filter((item) => item.node !== undefined);

    const incoming = KNOWLEDGE_GRAPH_EDGES
      .filter((e) => e.target === node.id)
      .map((e) => ({
        relation: `INCOMING_${e.relation}`,
        node: KNOWLEDGE_GRAPH_NODES.find((n) => n.id === e.source)!,
      }))
      .filter((item) => item.node !== undefined);

    return {
      node,
      connectedNodes: [...outgoing, ...incoming],
    };
  }
}
