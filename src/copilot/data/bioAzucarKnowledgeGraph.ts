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
  { id: "sys-eros-dcs", type: "EQUIPMENT", name: "Sistema de Control Distribuido EROS DCS", code: "DCS-EROS" },
  { id: "connector-eros", type: "PROTOCOL", name: "EROS Connector (Edge Adapter)", code: "CONN-EROS" },
  { id: "tag-eros-speed", type: "TAG", name: "Velocidad Turbina Molino (EROS)", code: "EROS.Tandem.Turbine_Speed_RPM" },
  { id: "tag-eros-hydraulic", type: "TAG", name: "Presión Hidráulica Molino 1 (EROS)", code: "EROS.Mill1.Hydraulic_Pressure_Bar" },
  { id: "tag-eros-donnelly", type: "TAG", name: "Nivel Tolva Donnelly (EROS)", code: "EROS.Chute.Donnelly_Level_Pct" },
  { id: "tag-eros-imbibition", type: "TAG", name: "Flujo Agua Imbibición (EROS)", code: "EROS.Milling.Imbibition_Flow_M3H" },

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

  // EROS Architecture & Integration Relationships
  { source: "sys-eros-dcs", target: "connector-eros", relation: "USES_PROTOCOL" },
  { source: "connector-eros", target: "eq-edge-node-1", relation: "FEEDS" },
  { source: "sys-eros-dcs", target: "tag-tch", relation: "MONITORS" },
  { source: "sys-eros-dcs", target: "tag-milling-ext", relation: "MONITORS" },
  { source: "sys-eros-dcs", target: "tag-eros-speed", relation: "MONITORS" },
  { source: "sys-eros-dcs", target: "tag-eros-hydraulic", relation: "MONITORS" },
  { source: "sys-eros-dcs", target: "tag-eros-donnelly", relation: "MONITORS" },
  { source: "sys-eros-dcs", target: "tag-eros-imbibition", relation: "MONITORS" },
  { source: "tag-eros-speed", target: "kpi-tch", relation: "FEEDS" },
  { source: "tag-eros-imbibition", target: "kpi-milling-extraction", relation: "FEEDS" },
  { source: "tag-eros-hydraulic", target: "eq-molino-1", relation: "MONITORS" },
  { source: "sys-eros-dcs", target: "eq-molino-1", relation: "GOVERNS" },
  { source: "sys-eros-dcs", target: "eq-molino-3", relation: "GOVERNS" },
  { source: "sys-eros-dcs", target: "eq-molino-5", relation: "GOVERNS" },
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
      (n) => n.type === "ALARM" && (n.id.toLowerCase() === term || (n.code && n.code.toLowerCase() === term) || n.id.toLowerCase().includes(term) || (n.code && n.code.toLowerCase().includes(term)))
    );
    if (!alarmNode) return undefined;

    // 1. Direct equipment monitor
    const directEqEdge = KNOWLEDGE_GRAPH_EDGES.find(
      (e) => e.target === alarmNode.id && e.relation === "MONITORS" && e.source.startsWith("eq-")
    );
    if (directEqEdge) {
      return KNOWLEDGE_GRAPH_NODES.find((n) => n.id === directEqEdge.source);
    }

    // 2. Upstream through tag
    const tagEdge = KNOWLEDGE_GRAPH_EDGES.find(
      (e) => e.target === alarmNode.id && e.relation === "TRIGGERS"
    );
    if (tagEdge) {
      const eqEdge = KNOWLEDGE_GRAPH_EDGES.find(
        (e) => e.target === tagEdge.source && e.relation === "MONITORS"
      );
      if (eqEdge) {
        return KNOWLEDGE_GRAPH_NODES.find((n) => n.id === eqEdge.source);
      }
    }

    return undefined;
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

  /**
   * Returns all KPIs that depend directly or indirectly on data originating from EROS
   */
  public static getErosKpis(): Array<{ id: string; name: string; code: string; reason: string }> {
    return [
      {
        id: "kpi-tch",
        name: "Toneladas de Caña por Hora (TCH)",
        code: "kpi-tch",
        reason: "Alimentado por la velocidad de turbinas y pesaje de caña reportados por EROS.",
      },
      {
        id: "kpi-milling-extraction",
        name: "Extracción de Sacarosa en Molienda (%)",
        code: "kpi-milling-extraction",
        reason: "Calculado a partir de flujo de imbibición y presión hidráulica de mazas leídas desde EROS.",
      },
      {
        id: "kpi-oee-overall",
        name: "Efectividad Global del Tándem (OEE)",
        code: "kpi-oee-overall",
        reason: "Depende del rendimiento (TCH real vs nominal) y paradas operativas registradas en EROS.",
      },
    ];
  }

  /**
   * Returns all industrial tags monitored or controlled through EROS
   */
  public static getErosTags(): Array<{ id: string; name: string; code: string; unit: string; description: string }> {
    return [
      {
        id: "tag-tch",
        name: "Molienda Instantánea",
        code: "Milling.Tandem.TCH_Actual",
        unit: "TCH",
        description: "Tasa horaria de molienda transmitida por EROS.",
      },
      {
        id: "tag-milling-ext",
        name: "Extracción Sacarosa Tándem",
        code: "Milling.Extraction_Percent",
        unit: "%",
        description: "Porcentaje de extracción en tándem de molinos.",
      },
      {
        id: "tag-eros-speed",
        name: "Velocidad Turbina Molino",
        code: "EROS.Tandem.Turbine_Speed_RPM",
        unit: "RPM",
        description: "Velocidad de rotación del accionamiento primario de molinos.",
      },
      {
        id: "tag-eros-hydraulic",
        name: "Presión Hidráulica Molino 1",
        code: "EROS.Mill1.Hydraulic_Pressure_Bar",
        unit: "bar",
        description: "Presión hidráulica en chumaceras superiores del molino desmenuzador.",
      },
      {
        id: "tag-eros-donnelly",
        name: "Nivel Tolva Donnelly",
        code: "EROS.Chute.Donnelly_Level_Pct",
        unit: "%",
        description: "Columna de caña desfibrada para alimentación forzada.",
      },
      {
        id: "tag-eros-imbibition",
        name: "Flujo Agua Imbibición",
        code: "EROS.Milling.Imbibition_Flow_M3H",
        unit: "m³/h",
        description: "Caudal de agua caliente aplicada en el penúltimo molino.",
      },
    ];
  }

  /**
   * Returns equipment associated with EROS DCS control loops
   */
  public static getErosEquipment(): Array<{ id: string; name: string; code: string; role: string }> {
    return [
      {
        id: "eq-molino-1",
        name: "Molino 1 (Desmenuzador)",
        code: "MOL-01",
        role: "Control de velocidad y presión de mazas regulado por lazo EROS.",
      },
      {
        id: "eq-molino-3",
        name: "Molino 3",
        code: "MOL-03",
        role: "Regulación de flotación de maza superior y velocidad de turbina.",
      },
      {
        id: "eq-molino-5",
        name: "Molino 5 (Bagazo Final)",
        code: "MOL-05",
        role: "Control de imbibición compuesta y humedad residual del bagazo.",
      },
      {
        id: "eq-edge-node-1",
        name: "BioAzúcar Industrial Edge Node 01",
        code: "EDGE-01",
        role: "Pasarela local OT/IT que ejecuta ErosConnector y normaliza a IndustrialDataPoint hacia el UNS.",
      },
    ];
  }

  /**
   * Explains the operational and analytical impact if EROS disconnects
   */
  public static getErosImpactIfDisconnected(): {
    severity: "CRITICAL" | "HIGH" | "MEDIUM";
    affectedKpis: string[];
    affectedTags: string[];
    consequences: string[];
    fallbackAction: string;
  } {
    return {
      severity: "CRITICAL",
      affectedKpis: ["TCH (Molienda)", "Extracción de Sacarosa (%)", "OEE Global", "Balance de Masa"],
      affectedTags: [
        "Milling.Tandem.TCH_Actual",
        "Milling.Extraction_Percent",
        "EROS.Tandem.Turbine_Speed_RPM",
        "EROS.Mill1.Hydraulic_Pressure_Bar",
        "EROS.Chute.Donnelly_Level_Pct",
        "EROS.Milling.Imbibition_Flow_M3H",
      ],
      consequences: [
        "Pérdida de telemetría en tiempo real del tándem de molinos en SCADA y Copilot.",
        "Degradación del cálculo de OEE a estimación histórica o simulación matemática.",
        "Imposibilidad de supervisar presión hidráulica y nivel de tolva Donnelly.",
        "Calidad de datos marcada como 'COMMUNICATION_LOST' en el UNS.",
      ],
      fallbackAction: "El Industrial Edge conmuta automáticamente a la cola Store & Forward y mantiene las últimas muestras válidas con marca de calidad degradada hasta el restablecimiento del enlace.",
    };
  }

  /**
   * Returns current protocol and connector parameters for EROS
   */
  public static getErosProtocol(): {
    name: string;
    primaryProtocol: string;
    activeInterface: string;
    endpoint: string;
    port: number;
    readOnlyMode: boolean;
    dataFlow: string;
  } {
    return {
      name: "EROS Native Industrial Protocol",
      primaryProtocol: "EROS-NATIVE",
      activeInterface: "OPC_UA_BRIDGE",
      endpoint: "192.168.15.100",
      port: 9000,
      readOnlyMode: false,
      dataFlow: "EROS/DCS -> EROS Connector -> Industrial Edge -> Data Normalization -> IndustrialDataPoint -> UNS/MQTT -> BioAzúcar Platform -> Copilot/SCADA/KPIs",
    };
  }
}
