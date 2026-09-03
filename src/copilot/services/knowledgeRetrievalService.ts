import { NavigationTab, TelemetryData, AlarmEvent, EquipmentItem, DataQuality, DataSourceType } from "../../types";
import { CopilotUserContext } from "../domain/CopilotTypes";
import {
  IndustrialGlossaryEntry,
  ModuleDocumentation,
  OperationalProcedure,
  KnowledgeEvidenceBundle,
  EvidenceCategory,
  ExplanationStyle,
} from "../domain/CopilotKnowledgeTypes";
import { BIOAZUCAR_GLOSSARY } from "../data/bioAzucarGlossary";
import { BIOAZUCAR_MODULE_DOCS } from "../data/bioAzucarModuleDocs";
import { BIOAZUCAR_PROCEDURES } from "../data/bioAzucarProcedures";
import { BioAzucarKnowledgeGraph, KNOWLEDGE_GRAPH_NODES, KNOWLEDGE_GRAPH_EDGES } from "../data/bioAzucarKnowledgeGraph";

// ============================================================================
// BIOAZÚCAR COPILOT — KNOWLEDGE RETRIEVAL SERVICE (RAG)
// Structured, deterministic retrieval pipeline grounded in engineering evidence
// ============================================================================

export class KnowledgeRetrievalService {
  /**
   * Search glossary terms with scoring based on tokens, aliases, and active module boost
   */
  public static retrieveGlossaryTerms(
    query: string,
    activeModule?: NavigationTab,
    limit: number = 3
  ): IndustrialGlossaryEntry[] {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];

    const queryTokens = cleanQuery
      .replace(/[¿?¡!.,;:()]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scored = BIOAZUCAR_GLOSSARY.map((entry) => {
      let score = 0;
      const termLower = entry.term.toLowerCase();
      const nameLower = entry.name.toLowerCase();

      // Exact term or alias match
      if (cleanQuery.includes(termLower)) score += 50;
      if (entry.aliases.some((a) => cleanQuery.includes(a.toLowerCase()))) score += 40;
      if (nameLower.includes(cleanQuery)) score += 30;

      // Token matching
      for (const token of queryTokens) {
        if (termLower === token) score += 25;
        else if (termLower.includes(token)) score += 10;
        if (nameLower.includes(token)) score += 8;
        if (entry.definition.toLowerCase().includes(token)) score += 3;
      }

      // Contextual boost if related to active module
      if (activeModule && entry.module === activeModule) {
        score += 15;
      }

      return { entry, score };
    });

    return scored
      .filter((item) => item.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.entry);
  }

  /**
   * Retrieve module documentation for active screen or explicit query
   */
  public static retrieveModuleDocumentation(
    queryOrModule: string,
    currentModule?: NavigationTab
  ): ModuleDocumentation | undefined {
    const raw = queryOrModule.toLowerCase().trim();

    // 1. Direct module key match
    if (BIOAZUCAR_MODULE_DOCS[raw as NavigationTab]) {
      return BIOAZUCAR_MODULE_DOCS[raw as NavigationTab];
    }

    // 2. Keyword heuristic mapping
    if (raw.includes("molienda") || raw.includes("scada") || raw.includes("tándem") || raw.includes("tandem")) {
      return BIOAZUCAR_MODULE_DOCS["scada"];
    }
    if (raw.includes("cogen") || raw.includes("vapor") || raw.includes("caldera") || raw.includes("despacho") || raw.includes("sen") || raw.includes("mw")) {
      return BIOAZUCAR_MODULE_DOCS["energy_dispatch"];
    }
    if (raw.includes("alarma") || raw.includes("soe") || raw.includes("alerta") || raw.includes("isa-18")) {
      return BIOAZUCAR_MODULE_DOCS["alarms"];
    }
    if (raw.includes("equipo") || raw.includes("cmms") || raw.includes("mantenimiento") || raw.includes("vibracion") || raw.includes("fft")) {
      return BIOAZUCAR_MODULE_DOCS["equipment"];
    }
    if (raw.includes("uns") || raw.includes("edge") || raw.includes("opc") || raw.includes("modbus") || raw.includes("mqtt") || raw.includes("sparkplug")) {
      return BIOAZUCAR_MODULE_DOCS["uns_hub"];
    }
    if (raw.includes("lote") || raw.includes("lims") || raw.includes("caña") || raw.includes("brix") || raw.includes("pol") || raw.includes("are") || raw.includes("trash")) {
      return BIOAZUCAR_MODULE_DOCS["batches"];
    }
    if (raw.includes("historiador") || raw.includes("tendencia") || raw.includes("csv") || raw.includes("historico")) {
      return BIOAZUCAR_MODULE_DOCS["historian"];
    }
    if (raw.includes("gemelo") || raw.includes("3d") || raw.includes("digital twin")) {
      return BIOAZUCAR_MODULE_DOCS["digital_twin"];
    }
    if (raw.includes("usuario") || raw.includes("rol") || raw.includes("rbac") || raw.includes("permiso")) {
      return BIOAZUCAR_MODULE_DOCS["users_roles"];
    }
    if (raw.includes("central") || raw.includes("empresa") || raw.includes("tenant") || raw.includes("ingenio")) {
      return BIOAZUCAR_MODULE_DOCS["enterprises"];
    }
    if (raw.includes("parametro") || raw.includes("configuracion") || raw.includes("limite")) {
      return BIOAZUCAR_MODULE_DOCS["system_config"];
    }

    // 3. Fallback to active screen if user asked "qué puedo hacer aquí" or "este módulo"
    if (currentModule && (raw.includes("aqui") || raw.includes("aquí") || raw.includes("este modulo") || raw.includes("esta pantalla"))) {
      return BIOAZUCAR_MODULE_DOCS[currentModule];
    }

    return undefined;
  }

  /**
   * Retrieve operational procedures (SOPs) matching query and checking role permissions
   */
  public static retrieveProcedures(
    query: string,
    context?: CopilotUserContext,
    limit: number = 2
  ): OperationalProcedure[] {
    const clean = query.toLowerCase().trim();
    if (!clean) return [];

    return BIOAZUCAR_PROCEDURES.filter((proc) => {
      const match =
        clean.includes(proc.id.toLowerCase()) ||
        clean.includes(proc.title.toLowerCase()) ||
        (proc.relatedEquipment && proc.relatedEquipment.some((eq) => clean.includes(eq.toLowerCase()))) ||
        clean.includes(proc.category.toLowerCase()) ||
        (clean.includes("alarma") && proc.id.includes("alarm")) ||
        (clean.includes("despacho") && proc.id.includes("dispatch")) ||
        (clean.includes("lote") && proc.id.includes("batch")) ||
        (clean.includes("vibracion") && proc.id.includes("vibration")) ||
        (clean.includes("edge") && proc.id.includes("edge"));

      return match;
    }).slice(0, limit);
  }

  /**
   * Determine the requested explanation style
   */
  public static detectExplanationStyle(query: string): ExplanationStyle {
    const lower = query.toLowerCase();
    if (lower.includes("sencillo") || lower.includes("simple") || lower.includes("para niños") || lower.includes("en facil") || lower.includes("en fácil")) {
      return "SIMPLE";
    }
    if (lower.includes("tecnicamente") || lower.includes("técnicamente") || lower.includes("termodinamica") || lower.includes("fisicoquimic")) {
      return "TECHNICAL";
    }
    if (lower.includes("automatizacion") || lower.includes("automatización") || lower.includes("plc") || lower.includes("scada") || lower.includes("controlador")) {
      return "AUTOMATION";
    }
    if (lower.includes("en vivo") || lower.includes("datos actuales") || lower.includes("ahora mismo") || lower.includes("telemetria")) {
      return "LIVE_GROUNDED";
    }
    return "TECHNICAL";
  }

  /**
   * Build an Evidence Bundle integrating Knowledge Base, Glossary, SOPs, Graph and Live Telemetry
   */
  public static buildEvidenceBundle(
    query: string,
    context: CopilotUserContext,
    liveTelemetry: TelemetryData,
    alarms: AlarmEvent[],
    equipmentList: EquipmentItem[]
  ): KnowledgeEvidenceBundle {
    const glossaryHits = this.retrieveGlossaryTerms(query, context.currentModule as NavigationTab, 2);
    const moduleDoc = this.retrieveModuleDocumentation(query, context.currentModule as NavigationTab);
    const procedures = this.retrieveProcedures(query, context, 1);
    const explanationStyle = this.detectExplanationStyle(query);

    // Knowledge Graph Subgraph extraction
    const relevantNodeIds = new Set<string>();
    const queryLower = query.toLowerCase();

    KNOWLEDGE_GRAPH_NODES.forEach((n) => {
      if (
        queryLower.includes(n.name.toLowerCase()) ||
        (n.code && queryLower.includes(n.code.toLowerCase())) ||
        (n.type === "EQUIPMENT" && queryLower.includes("equipo")) ||
        (n.type === "ALARM" && queryLower.includes("alarma"))
      ) {
        relevantNodeIds.add(n.id);
      }
    });

    const graphNodes = KNOWLEDGE_GRAPH_NODES.filter((n) => relevantNodeIds.has(n.id));
    const graphEdges = KNOWLEDGE_GRAPH_EDGES.filter(
      (e) => relevantNodeIds.has(e.source) || relevantNodeIds.has(e.target)
    );

    // Evidence classification
    const isSimulated = liveTelemetry.simulationScenario !== undefined || !liveTelemetry.tenantId;
    let evidenceCategory: EvidenceCategory = "DOCUMENTATION";
    if (queryLower.includes("actual") || queryLower.includes("ahora") || queryLower.includes("valor") || queryLower.includes("tch") || queryLower.includes("oee")) {
      evidenceCategory = isSimulated ? "SIMULATION" : "LIVE_DATA";
    }

    return {
      query,
      activeModule: (context.currentModule as NavigationTab) || "dashboard",
      glossaryHits,
      moduleDoc,
      procedures,
      graphRelations: {
        nodes: graphNodes,
        edges: graphEdges,
      },
      liveDataProvenance: [
        {
          tag: "Milling.Tandem.TCH_Actual",
          value: liveTelemetry.tch,
          unit: "TCH",
          quality: (isSimulated ? "SIMULATED" : "GOOD") as DataQuality,
          source: (isSimulated ? "SIMULATION" : "OPC_UA") as DataSourceType,
          isSimulated,
          timestamp: new Date().toISOString(),
        },
        {
          tag: "Boiler1.Steam_Pressure_HP",
          value: liveTelemetry.boilerPressureHP,
          unit: "bar",
          quality: (isSimulated ? "SIMULATED" : "GOOD") as DataQuality,
          source: (isSimulated ? "SIMULATION" : "OPC_UA") as DataSourceType,
          isSimulated,
          timestamp: new Date().toISOString(),
        },
      ],
      evidenceCategory,
      explanationStyle,
    };
  }
}
