import { describe, it, expect } from "vitest";
import { CopilotIntentClassifier } from "../copilot/domain/CopilotIntentClassifier";
import { copilotContextService } from "../copilot/services/copilotContextService";
import { copilotService } from "../copilot/services/copilotService";
import { IndustrialToolExecutor } from "../copilot/tools/industrialToolExecutor";
import { BioAzucarKnowledgeGraph } from "../copilot/data/bioAzucarKnowledgeGraph";
import { KnowledgeRetrievalService } from "../copilot/services/knowledgeRetrievalService";
import { PREDEFINED_USERS } from "../services/authService";
import { INITIAL_TENANTS } from "../services/dbService";
import { INITIAL_TELEMETRY } from "../data/mockIndustrialData";

describe("Suite 11: BioAzúcar Copilot — Industrial Integration & EROS Connectivity", () => {
  const adminUser = PREDEFINED_USERS.find((u) => u.role === "administrador") || PREDEFINED_USERS[0];
  const operatorUser = PREDEFINED_USERS.find((u) => u.role === "operador") || PREDEFINED_USERS[3];
  const observerUser = PREDEFINED_USERS.find((u) => u.role === "observador") || PREDEFINED_USERS[4];
  const activeTenant = INITIAL_TENANTS[0];

  const adminContext = copilotContextService.buildContext(adminUser, "administrador", activeTenant, "uns_hub");
  const operatorContext = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "scada");
  const observerContext = copilotContextService.buildContext(observerUser, "observador", activeTenant, "dashboard");

  // ==========================================================================
  // 1. INTENT RECOGNITION & SUB-INTENTS
  // ==========================================================================
  describe("1. Intent Classification for Industrial Integration & EROS", () => {
    it("1.1 MUST classify '¿Cómo conecto el sistema a EROS?' as INTEGRATION / EROS_INTEGRATION", () => {
      const result = CopilotIntentClassifier.classify("¿Cómo conecto el sistema a EROS?", adminContext);
      expect(result.intent).toBe("INTEGRATION");
      expect(result.subIntent).toBe("EROS_INTEGRATION");
      expect(result.integrationProvider).toBe("eros");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("1.2 MUST recognize varied EROS connectivity queries without depending solely on 'conectar'", () => {
      const queries = [
        "Integrar DCS EROS",
        "Configuración de EROS",
        "¿EROS está en línea?",
        "¿Qué datos vienen de EROS?",
        "Parámetros para conectar EROS",
        "Estado del conector EROS DCS",
        "Vincular tándem de molienda con EROS",
        "Interfaz OPC_UA_BRIDGE para EROS",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, operatorContext);
        expect(result.intent).toBe("INTEGRATION");
        expect(result.subIntent).toBe("EROS_INTEGRATION");
        expect(result.integrationProvider).toBe("eros");
      }
    });

    it("1.3 MUST classify OPC UA integration queries as INTEGRATION / OPC_UA_INTEGRATION", () => {
      const queries = [
        "Conectar OPC UA",
        "Integración con KEPServerEX",
        "Configuración de suscripción IEC 62541",
        "Endpoint del servidor OPC UA",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, adminContext);
        expect(result.intent).toBe("INTEGRATION");
        expect(result.subIntent).toBe("OPC_UA_INTEGRATION");
        expect(result.integrationProvider).toBe("opcua");
      }
    });

    it("1.4 MUST classify Modbus TCP integration queries as INTEGRATION / MODBUS_INTEGRATION", () => {
      const queries = [
        "Estado de la conexión Modbus",
        "Conectar analizadores de potencia Modbus TCP",
        "Holding registers de pasarela Moxa",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, adminContext);
        expect(result.intent).toBe("INTEGRATION");
        expect(result.subIntent).toBe("MODBUS_INTEGRATION");
        expect(result.integrationProvider).toBe("modbus");
      }
    });

    it("1.5 MUST classify MQTT and Sparkplug B queries as INTEGRATION / SPARKPLUG_INTEGRATION", () => {
      const queries = [
        "Conectar broker MQTT UNS",
        "Publicación de telemetría Sparkplug B",
        "Tópicos spBv1.0 hacia EMQX",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, adminContext);
        expect(result.intent).toBe("INTEGRATION");
        expect(["SPARKPLUG_INTEGRATION", "MQTT_INTEGRATION"]).toContain(result.subIntent);
      }
    });

    it("1.6 MUST classify connectivity diagnostics as INTEGRATION / CONNECTIVITY_DIAGNOSTIC", () => {
      const queries = [
        "Diagnóstico de conectividad",
        "Latencia de enlaces industriales OT",
        "Diagnóstico de paquetes y ping en edge",
        "Estado de los conectores industriales",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, adminContext);
        expect(result.intent).toBe("INTEGRATION");
        expect(result.subIntent).toBe("CONNECTIVITY_DIAGNOSTIC");
      }
    });

    it("1.7 MUST classify Industrial Edge node queries as INTEGRATION / INDUSTRIAL_EDGE", () => {
      const queries = [
        "Estado del Industrial Edge node",
        "Buffer Store and forward en edge",
        "Configuración de nodo edge industrial",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, adminContext);
        expect(result.intent).toBe("INTEGRATION");
        expect(result.subIntent).toBe("INDUSTRIAL_EDGE");
      }
    });
  });

  // ==========================================================================
  // 2. COPILOT RESPONSE DISCIPLINE & ZERO-HALLUCINATION WORKFLOW
  // ==========================================================================
  describe("2. End-to-End Copilot Response Execution for EROS", () => {
    it("2.1 MUST NOT return generic fallback 'Puedo ayudarte con...' when asked about EROS", async () => {
      const response = await copilotService.sendMessage({
        message: "¿Cómo conecto el sistema a EROS?",
        context: adminContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("INTEGRATION");
      expect(response.message).not.toContain(
        "Puedo ayudarte con producción, KPIs, alarmas, equipos, energía, estadísticas o navegación."
      );
    });

    it("2.2 MUST explain EROS, architectural flow, technical steps, live diagnostics and security isolation", async () => {
      const response = await copilotService.sendMessage({
        message: "¿Cómo conecto el sistema a EROS?",
        context: adminContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      // 1. What EROS is
      expect(response.message).toContain("EROS");
      expect(response.message).toContain("Sistema de Control Distribuido");

      // 2. Architectural flow
      expect(response.message).toContain("EROS Connector");
      expect(response.message).toContain("Industrial Edge");
      expect(response.message).toContain("Normalización");
      expect(response.message).toContain("UNS/MQTT");

      // 3. Technical connection steps & interfaces
      expect(response.message).toContain("OPC_UA_BRIDGE");
      expect(response.message).toContain("DIRECT_TCP");
      expect(response.message).toContain("MODBUS_GATEWAY");
      expect(response.message).toContain("REST_API");
      expect(response.message).toContain("192.168.15.100:9000");

      // 4. Diagnostic status from tool
      expect(response.message).toMatch(/(CONECTADO|DESCONECTADO)/);
      expect(response.message).toContain("Latencia");

      // 5. IEC 62443 Security isolation statement
      expect(response.message).toContain("IEC 62443");
      expect(response.message).toContain("Copilot");
      expect(response.message).toContain("RBAC");

      // 6. Tools executed & widgets/actions attached
      expect(response.executionMetrics.toolsExecuted).toContain("get_integration_status");
      expect(response.actions?.length).toBeGreaterThan(0);
      expect(response.widgets?.length).toBeGreaterThan(0);
    });

    it("2.3 MUST return live diagnostic status when asked for connectivity diagnostics", async () => {
      const response = await copilotService.sendMessage({
        message: "Diagnóstico de conectividad OT de la planta",
        context: operatorContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("INTEGRATION");
      expect(response.message).toContain("Diagnóstico de Conectividad");
      expect(response.message).toContain("EROS DCS");
      expect(response.message).toContain("OPC UA");
      expect(response.message).toContain("Modbus");
      expect(response.message).toContain("MQTT UNS");
      expect(response.executionMetrics.toolsExecuted).toContain("get_integration_status");
    });
  });

  // ==========================================================================
  // 3. TOOL EXECUTOR & DIAGNOSTIC DATA PROVENANCE
  // ==========================================================================
  describe("3. Industrial Tool Executor for Integrations", () => {
    it("3.1 MUST execute get_integration_status for EROS with accurate telemetry and metrics", async () => {
      const res = await IndustrialToolExecutor.execute({
        toolName: "get_integration_status",
        args: { provider: "eros" },
        context: adminContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(res.data).toBeDefined();
      expect(res.data.integrations).toBeDefined();
      expect(res.data.integrations.length).toBeGreaterThan(0);

      const eros = res.data.integrations.find((i: any) => i.id === "eros");
      expect(eros).toBeDefined();
      expect(eros.name).toContain("EROS");
      expect(eros.endpoint).toBe("192.168.15.100:9000");
      expect(eros.details.activeInterface).toBeDefined();
      expect(eros.environment).toBe("PRODUCTION_OT");

      // Verify widgets
      expect(res.widgets).toBeDefined();
      expect(res.widgets?.some((w) => w.type === "TABLE" && w.title.includes("Conectividad"))).toBe(true);
    });

    it("3.2 MUST execute get_provider_status and return connector profile", async () => {
      const res = await IndustrialToolExecutor.execute({
        toolName: "get_provider_status",
        args: { provider: "eros" },
        context: adminContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(res.data.provider).toBe("eros");
      expect(res.data.profile).toBeDefined();
      expect(res.data.profile.interfaces).toContain("OPC_UA_BRIDGE");
      expect(res.data.profile.interfaces).toContain("DIRECT_TCP");
    });
  });

  // ==========================================================================
  // 4. KNOWLEDGE GRAPH & EVIDENCE DIFFERENTIATION
  // ==========================================================================
  describe("4. Knowledge Graph Relationships & Evidence Classification", () => {
    it("4.1 MUST have EROS DCS nodes and helper methods in BioAzucarKnowledgeGraph", () => {
      const kpis = BioAzucarKnowledgeGraph.getErosKpis();
      expect(kpis.length).toBeGreaterThan(0);
      expect(kpis.some((k) => k.name.includes("Molienda") || k.name.includes("TCH"))).toBe(true);

      const tags = BioAzucarKnowledgeGraph.getErosTags();
      expect(tags.length).toBeGreaterThan(0);

      const equipment = BioAzucarKnowledgeGraph.getErosEquipment();
      expect(equipment.length).toBeGreaterThan(0);
      expect(equipment.some((e) => e.name.includes("Molino"))).toBe(true);

      const impact = BioAzucarKnowledgeGraph.getErosImpactIfDisconnected();
      expect(impact.severity).toBe("CRITICAL");

      const protocol = BioAzucarKnowledgeGraph.getErosProtocol();
      expect(protocol).toBeDefined();
      expect(protocol?.name).toContain("EROS");
    });

    it("4.2 MUST accurately classify evidence categories (CONFIGURATION, DIAGNOSTIC, CURRENT_CONNECTION_STATUS)", () => {
      const configBundle = KnowledgeRetrievalService.buildEvidenceBundle(
        "¿Cómo configurar el endpoint y conectar EROS?",
        adminContext,
        INITIAL_TELEMETRY,
        [],
        []
      );
      expect(configBundle.evidenceCategory).toBe("CONFIGURATION");

      const statusBundle = KnowledgeRetrievalService.buildEvidenceBundle(
        "¿Cuál es el estado de conexión del enlace EROS?",
        adminContext,
        INITIAL_TELEMETRY,
        [],
        []
      );
      expect(statusBundle.evidenceCategory).toBe("CURRENT_CONNECTION_STATUS");

      const diagBundle = KnowledgeRetrievalService.buildEvidenceBundle(
        "Diagnóstico de ping, paquetes y latencia del conector",
        adminContext,
        INITIAL_TELEMETRY,
        [],
        []
      );
      expect(diagBundle.evidenceCategory).toBe("DIAGNOSTIC");
    });

    it("4.3 MUST link EROS graph nodes in EvidenceBundle graph relations", () => {
      const bundle = KnowledgeRetrievalService.buildEvidenceBundle(
        "consultar arquitectura eros",
        adminContext,
        INITIAL_TELEMETRY,
        [],
        []
      );
      const nodeIds = bundle.graphRelations.nodes.map((n) => n.id);
      expect(nodeIds.some((id) => id.includes("eros"))).toBe(true);
    });
  });

  // ==========================================================================
  // 5. RBAC & TENANT ISOLATION
  // ==========================================================================
  describe("5. RBAC & Tenant Isolation for Integration Queries", () => {
    it("5.1 Operator and Observer can view integration status without error", async () => {
      const opResponse = await copilotService.sendMessage({
        message: "¿EROS está en línea?",
        context: operatorContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });
      expect(opResponse.intent).toBe("INTEGRATION");
      expect(opResponse.message).toContain("EROS");

      const obsResponse = await copilotService.sendMessage({
        message: "Diagnóstico de conectividad",
        context: observerContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });
      expect(obsResponse.intent).toBe("INTEGRATION");
    });

    it("5.2 Multi-tenant isolation preserves tenant binding in context", () => {
      expect(adminContext.plantId).toBe(activeTenant.id);
      expect(adminContext.plantCode).toBe(activeTenant.code);
    });
  });
});
