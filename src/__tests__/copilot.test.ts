import { describe, it, expect } from "vitest";
import { copilotContextService } from "../copilot/services/copilotContextService";
import { checkToolAuthorization } from "../copilot/domain/CopilotPermissions";
import { IndustrialToolExecutor } from "../copilot/tools/industrialToolExecutor";
import { copilotKnowledgeService } from "../copilot/services/copilotKnowledgeService";
import { KnowledgeRetrievalService } from "../copilot/services/knowledgeRetrievalService";
import { copilotService } from "../copilot/services/copilotService";
import { CopilotIntentClassifier } from "../copilot/domain/CopilotIntentClassifier";
import { BIOAZUCAR_GLOSSARY } from "../copilot/data/bioAzucarGlossary";
import { BIOAZUCAR_MODULE_DOCS } from "../copilot/data/bioAzucarModuleDocs";
import { BIOAZUCAR_PROCEDURES } from "../copilot/data/bioAzucarProcedures";
import {
  BioAzucarKnowledgeGraph,
  KNOWLEDGE_GRAPH_NODES,
  KNOWLEDGE_GRAPH_EDGES,
} from "../copilot/data/bioAzucarKnowledgeGraph";
import { INITIAL_TELEMETRY } from "../data/mockIndustrialData";
import { INITIAL_TENANTS } from "../services/dbService";
import { PREDEFINED_USERS } from "../services/authService";

describe("BioAzúcar Copilot — Comprehensive Industrial Knowledge, Context & RBAC Test Suite", () => {
  const superAdminUser = PREDEFINED_USERS[0];
  const adminUser = PREDEFINED_USERS.find((u) => u.role === "administrador") || PREDEFINED_USERS[0];
  const operatorUser = PREDEFINED_USERS.find((u) => u.role === "operador") || PREDEFINED_USERS[3];
  const observerUser = PREDEFINED_USERS.find((u) => u.role === "observador") || PREDEFINED_USERS[4];
  const maintenanceUser = PREDEFINED_USERS.find((u) => u.role === "mantenimiento") || PREDEFINED_USERS[2];

  const activeTenant = INITIAL_TENANTS[0];
  const secondaryTenant = INITIAL_TENANTS[1] || INITIAL_TENANTS[0];

  // ==========================================================================
  // SUITE 1: Context Builder & Multi-Tenant Security Clearance (5 tests)
  // ==========================================================================
  describe("Suite 1: Context Builder & Multi-Tenant Security Clearance", () => {
    it("1.1 should build valid industrial user context for Superadmin with level 5 and ROOT_ACCESS", () => {
      const context = copilotContextService.buildContext(superAdminUser, "superadmin", activeTenant, "dashboard");
      expect(context.userId).toBe(superAdminUser.id);
      expect(context.plantId).toBe(activeTenant.id);
      expect(context.plantCode).toBe(activeTenant.code);
      expect(context.securityLevel).toBe(5);
      expect(context.isSuperAdmin).toBe(true);
      expect(context.permissions).toContain("ROOT_ACCESS");
      expect(context.permissions).toContain("MANAGE_TENANTS");
    });

    it("1.2 should assign restricted operational permissions for Operator role (Level 2/3, no ROOT_ACCESS)", () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "scada");
      expect(context.securityLevel).toBeLessThan(5);
      expect(context.isSuperAdmin).toBe(false);
      expect(context.permissions).toContain("VIEW_TELEMETRY");
      expect(context.permissions).toContain("ACKNOWLEDGE_ALARM");
      expect(context.permissions).not.toContain("ROOT_ACCESS");
      expect(context.permissions).not.toContain("MANAGE_TENANTS");
    });

    it("1.3 should assign read-only clearance (Level 1) for Observer role with no write capabilities", () => {
      const context = copilotContextService.buildContext(observerUser, "observador", activeTenant, "dashboard");
      expect(context.securityLevel).toBe(1);
      expect(context.permissions).toContain("VIEW_TELEMETRY");
      expect(context.permissions).toContain("VIEW_DOCS");
      expect(context.permissions).not.toContain("ACKNOWLEDGE_ALARM");
      expect(context.permissions).not.toContain("REQUEST_SETPOINT_CHANGE");
    });

    it("1.4 should assign maintenance specific capabilities for Maintenance Engineer", () => {
      const context = copilotContextService.buildContext(maintenanceUser, "mantenimiento", activeTenant, "equipment");
      expect(context.permissions).toContain("VIEW_EQUIPMENT");
      expect(context.permissions).toContain("MANAGE_CMMS");
      expect(context.permissions).toContain("ACKNOWLEDGE_ALARM");
      expect(context.permissions).not.toContain("ROOT_ACCESS");
    });

    it("1.5 should isolate tenant context and bind plantId and tenant metadata securely", () => {
      const context1 = copilotContextService.buildContext(adminUser, "administrador", activeTenant, "uns_hub");
      const context2 = copilotContextService.buildContext(adminUser, "administrador", secondaryTenant, "uns_hub");
      expect(context1.plantId).toBe(activeTenant.id);
      expect(context2.plantId).toBe(secondaryTenant.id);
      expect(context1.plantCode).toBe(activeTenant.code);
      expect(context2.plantCode).toBe(secondaryTenant.code);
    });
  });

  // ==========================================================================
  // SUITE 2: RBAC Matrix & Tool Authorization Rules (8 tests)
  // ==========================================================================
  describe("Suite 2: Role-Based Access Control (RBAC) & Authorization Matrix", () => {
    it("2.1 should allow Level 1 telemetry read tools for Operator role", () => {
      const check = checkToolAuthorization("get_current_process_state", ["operador"], 2);
      expect(check.allowed).toBe(true);
    });

    it("2.2 should allow Level 1 data lineage inspection for Observer role", () => {
      const check = checkToolAuthorization("get_data_lineage", ["observador"], 1);
      expect(check.allowed).toBe(true);
    });

    it("2.3 should allow alarm acknowledgment tool for Operator with clearance >= 2", () => {
      const check = checkToolAuthorization("acknowledge_alarm", ["operador"], 2);
      expect(check.allowed).toBe(true);
    });

    it("2.4 should strictly deny alarm acknowledgment tool for Observer role", () => {
      const check = checkToolAuthorization("acknowledge_alarm", ["observador"], 1);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBeDefined();
    });

    it("2.5 should deny critical Level 3 setpoint change tool for low-clearance Operator", () => {
      const check = checkToolAuthorization("request_setpoint_change", ["operador"], 1);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("no tiene autorización");
    });

    it("2.6 should permit critical Level 3 setpoint change tool for Administrator with Level 4", () => {
      const check = checkToolAuthorization("request_setpoint_change", ["administrador"], 4);
      expect(check.allowed).toBe(true);
    });

    it("2.7 should permit all tools for Superadmin with root bypass flag", () => {
      const check = checkToolAuthorization("request_setpoint_change", ["superadmin"], 5, true);
      expect(check.allowed).toBe(true);
    });

    it("2.8 should enforce that AI never auto-approves permissions or elevates operator privileges", () => {
      const opContext = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "scada");
      const checkElevated = checkToolAuthorization("manage_tenants", opContext.roles, opContext.securityLevel, opContext.isSuperAdmin);
      expect(checkElevated.allowed).toBe(false);
    });
  });

  // ==========================================================================
  // SUITE 3: Industrial Knowledge Engine & Module Documentation (8 tests)
  // ==========================================================================
  describe("Suite 3: Industrial Knowledge Engine & Module Documentation", () => {
    it("3.1 should retrieve structured documentation for SCADA milling tandem module", () => {
      const doc = copilotKnowledgeService.getModuleDoc("scada");
      expect(doc).toBeDefined();
      expect(doc!.name).toContain("Molienda");
      expect(doc!.features.length).toBeGreaterThan(0);
      expect(doc!.kpis.length).toBeGreaterThan(0);
    });

    it("3.2 should retrieve structured documentation for Cogeneration / Energy Dispatch module", () => {
      const doc = copilotKnowledgeService.getModuleDoc("energy_dispatch");
      expect(doc).toBeDefined();
      expect(doc!.purpose).toContain("vapor");
      expect(doc!.targetUsers).toContain("operador");
    });

    it("3.3 should retrieve structured documentation for Alarms & SOE module", () => {
      const doc = copilotKnowledgeService.getModuleDoc("alarms");
      expect(doc).toBeDefined();
      expect(doc!.keyConcepts).toContain("ISA-18.2");
      expect(doc!.availableActions.length).toBeGreaterThan(0);
    });

    it("3.4 should retrieve structured documentation for CMMS Equipment Health module", () => {
      const doc = copilotKnowledgeService.getModuleDoc("equipment");
      expect(doc).toBeDefined();
      expect(doc!.features.some((f) => f.toLowerCase().includes("vibraci") || f.toLowerCase().includes("fft"))).toBe(true);
    });

    it("3.5 should retrieve structured documentation for Unified Namespace (UNS Hub)", () => {
      const doc = copilotKnowledgeService.getModuleDoc("uns_hub");
      expect(doc).toBeDefined();
      expect(doc!.keyConcepts).toContain("Unified Namespace");
      expect(doc!.dataSources.length).toBeGreaterThan(0);
    });

    it("3.6 should retrieve structured documentation for Sugar Reception Batches & LIMS", () => {
      const doc = copilotKnowledgeService.getModuleDoc("batches");
      expect(doc).toBeDefined();
      expect(doc!.keyConcepts.some((k) => k.includes("Brix") || k.includes("Pol") || k.includes("LIMS"))).toBe(true);
    });

    it("3.7 should search module documentation with natural language heuristic mapping", () => {
      const docMilling = copilotKnowledgeService.searchModuleDoc("tándem de molinos extracción");
      expect(docMilling).toBeDefined();
      expect(docMilling!.id).toBe("scada");

      const docEnergy = copilotKnowledgeService.searchModuleDoc("generación de vapor y despacho de megawatts");
      expect(docEnergy).toBeDefined();
      expect(docEnergy!.id).toBe("energy_dispatch");
    });

    it("3.8 should fallback to current module context when user asks 'qué puedo hacer en este módulo'", () => {
      const docFallback = copilotKnowledgeService.searchModuleDoc("qué puedo hacer aquí en esta pantalla", "historian");
      expect(docFallback).toBeDefined();
      expect(docFallback!.id).toBe("historian");
    });
  });

  // ==========================================================================
  // SUITE 4: Comprehensive Glossary & Industrial Dictionary (8 tests)
  // ==========================================================================
  describe("Suite 4: Comprehensive Industrial Glossary & Terminology Queries", () => {
    it("4.1 should retrieve exact glossary definition for PLC (Controlador Lógico Programable)", () => {
      const plc = copilotKnowledgeService.getGlossaryTerm("PLC");
      expect(plc).toBeDefined();
      expect(plc!.name).toContain("Controlador Lógico Programable");
      expect(plc!.simpleExplanation).toBeDefined();
      expect(plc!.technicalExplanation).toBeDefined();
      expect(plc!.automationExplanation).toBeDefined();
      expect(plc!.standards).toContain("IEC 61131-3");
    });

    it("4.2 should retrieve exact glossary definition for SCADA with ISA-101 standards", () => {
      const scada = copilotKnowledgeService.getGlossaryTerm("SCADA");
      expect(scada).toBeDefined();
      expect(scada!.definition).toContain("supervisar");
      expect(scada!.standards).toContain("ISA-101 HMI Design");
    });

    it("4.3 should retrieve exact glossary definition for UNS (Unified Namespace)", () => {
      const uns = copilotKnowledgeService.getGlossaryTerm("UNS");
      expect(uns).toBeDefined();
      expect(uns!.name).toContain("Unified Namespace");
      expect(uns!.category).toBe("DATA_GOVERNANCE");
    });

    it("4.4 should retrieve definition for TCH (Toneladas de Caña por Hora)", () => {
      const tch = copilotKnowledgeService.getGlossaryTerm("TCH");
      expect(tch).toBeDefined();
      expect(tch!.category).toBe("SUGAR_PROCESS");
      expect(tch!.technicalExplanation).toContain("molienda");
    });

    it("4.5 should retrieve sugar quality definitions for Brix and Pol", () => {
      const brix = copilotKnowledgeService.getGlossaryTerm("Brix");
      expect(brix).toBeDefined();
      expect(brix!.definition.toLowerCase()).toContain("solubles");

      const pol = copilotKnowledgeService.getGlossaryTerm("Pol");
      expect(pol).toBeDefined();
      expect(pol!.definition.toLowerCase()).toContain("sacarosa");
    });

    it("4.6 should retrieve definition for Bagazo including moisture and caloric calculation", () => {
      const bagazo = copilotKnowledgeService.getGlossaryTerm("Bagazo");
      expect(bagazo).toBeDefined();
      expect(bagazo!.technicalExplanation).toContain("Hugot");
      expect(bagazo!.category).toBe("SUGAR_PROCESS");
    });

    it("4.7 should retrieve industrial protocol entry for OPC UA", () => {
      const opcua = copilotKnowledgeService.getGlossaryTerm("OPC UA");
      expect(opcua).toBeDefined();
      expect(opcua!.category).toBe("COMMUNICATION_PROTOCOL");
      expect(opcua!.standards).toContain("IEC 62541");
    });

    it("4.8 should rank glossary search results by relevance and active module boost", () => {
      const results = copilotKnowledgeService.searchGlossary("protocolo de comunicación industrial", "uns_hub", 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].category).toBe("COMMUNICATION_PROTOCOL");
    });
  });

  // ==========================================================================
  // SUITE 5: Operational Procedures (SOPs) & Safety Preconditions (6 tests)
  // ==========================================================================
  describe("Suite 5: Standard Operating Procedures (SOPs) & Safety Preconditions", () => {
    it("5.1 should retrieve procedure for milling tandem emergency speed reduction", () => {
      const proc = copilotKnowledgeService.getProcedure("sop-milling-trip-reduction");
      expect(proc).toBeDefined();
      expect(proc!.title).toContain("Reducción de Velocidad");
      expect(proc!.safetyPreconditions.length).toBeGreaterThan(0);
      expect(proc!.steps.length).toBeGreaterThan(0);
    });

    it("5.2 should retrieve procedure for boiler high-pressure steam trip", () => {
      const proc = copilotKnowledgeService.getProcedure("sop-boiler-high-pressure-trip");
      expect(proc).toBeDefined();
      expect(proc!.category).toBe("SAFETY");
      expect(proc!.evidenceValidation).toBeDefined();
    });

    it("5.3 should retrieve procedure for energy export curtailment / SEN dispatch", () => {
      const proc = copilotKnowledgeService.getProcedure("sop-dispatch-curtailment");
      expect(proc).toBeDefined();
      expect(proc!.targetModule).toBe("energy_dispatch");
    });

    it("5.4 should enforce safety preconditions in critical operational SOPs", () => {
      const allProcs = BIOAZUCAR_PROCEDURES;
      const criticalProcs = allProcs.filter((p) => p.securityLevel >= 2);
      expect(criticalProcs.length).toBeGreaterThan(0);
      for (const p of criticalProcs) {
        expect(p.safetyPreconditions.length).toBeGreaterThan(0);
      }
    });

    it("5.5 should provide evidence validation criteria for each procedure step", () => {
      for (const p of BIOAZUCAR_PROCEDURES) {
        expect(p.evidenceValidation).toBeDefined();
        expect(p.evidenceValidation.length).toBeGreaterThan(5);
      }
    });

    it("5.6 should search procedures by matching operational equipment and keywords", () => {
      const results = copilotKnowledgeService.searchProcedures("caldera vapor alta presion", 2);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title.toLowerCase()).toContain("caldera");
    });
  });

  // ==========================================================================
  // SUITE 6: Knowledge Graph & Semantic Relational Traversal (6 tests)
  // ==========================================================================
  describe("Suite 6: Knowledge Graph & Semantic Relational Traversal", () => {
    it("6.1 should query Knowledge Graph for alarms connected to specific equipment", () => {
      const alarms = copilotKnowledgeService.queryGraphAlarmsForEquipment("Molino 3");
      expect(alarms).toBeDefined();
      expect(Array.isArray(alarms)).toBe(true);
    });

    it("6.2 should query Knowledge Graph for parent equipment of an alarm code", () => {
      const equipment = copilotKnowledgeService.queryGraphEquipmentForAlarm("ALM-BOILER-HP-01");
      expect(equipment).toBeDefined();
      expect(equipment!.name).toContain("Caldera");
    });

    it("6.3 should query Knowledge Graph for telemetry tags feeding KPI 'kpi-tch'", () => {
      const tags = copilotKnowledgeService.queryGraphTagsForKpi("kpi-tch");
      expect(tags).toBeDefined();
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0].type).toBe("TAG");
    });

    it("6.4 should query Knowledge Graph for related entities and bidirectional edges", () => {
      const related = copilotKnowledgeService.queryGraphRelated("eq-boiler-01");
      expect(related).toBeDefined();
      expect(related!.connectedNodes.length).toBeGreaterThan(0);
    });

    it("6.5 should ensure graph relational integrity without dangling edges", () => {
      const nodeIds = new Set(KNOWLEDGE_GRAPH_NODES.map((n) => n.id));
      for (const edge of KNOWLEDGE_GRAPH_EDGES) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    });

    it("6.6 should extract relevant subgraph nodes based on query semantics", () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "scada");
      const bundle = KnowledgeRetrievalService.buildEvidenceBundle(
        "¿Cuáles son las alarmas activas del tándem de molienda?",
        context,
        INITIAL_TELEMETRY,
        [],
        []
      );
      expect(bundle.graphRelations.nodes).toBeDefined();
    });
  });

  // ==========================================================================
  // SUITE 7: Evidence-First RAG Pipeline & Provenance Bundling (6 tests)
  // ==========================================================================
  describe("Suite 7: Evidence-First RAG Pipeline & Provenance Bundling", () => {
    it("7.1 should tag evidence as SIMULATION when telemetry is marked as simulated", () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "dashboard");
      const simTelemetry = { ...INITIAL_TELEMETRY, simulationScenario: "NORMAL_RUN" as const };
      const bundle = KnowledgeRetrievalService.buildEvidenceBundle("¿Cuál es el TCH actual?", context, simTelemetry, [], []);
      expect(bundle.evidenceCategory).toBe("SIMULATION");
      expect(bundle.liveDataProvenance[0].isSimulated).toBe(true);
    });

    it("7.2 should tag evidence as LIVE_DATA when real production OT telemetry is active", () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "dashboard");
      const prodTelemetry = { ...INITIAL_TELEMETRY, simulationScenario: undefined, tenantId: activeTenant.id };
      const bundle = KnowledgeRetrievalService.buildEvidenceBundle("¿Cuál es el TCH actual en planta?", context, prodTelemetry, [], []);
      expect(bundle.evidenceCategory).toBe("LIVE_DATA");
      expect(bundle.liveDataProvenance[0].isSimulated).toBe(false);
      expect(bundle.liveDataProvenance[0].quality).toBe("GOOD");
    });

    it("7.3 should detect explanation style 'SIMPLE' for plain-language operational inquiries", () => {
      const style = KnowledgeRetrievalService.detectExplanationStyle("explícame cómo funciona la caldera de forma sencilla y en fácil");
      expect(style).toBe("SIMPLE");
    });

    it("7.4 should detect explanation style 'TECHNICAL' for engineering / thermodynamic inquiries", () => {
      const style = KnowledgeRetrievalService.detectExplanationStyle("explícame técnicamente la termodinámica del ciclo Rankine");
      expect(style).toBe("TECHNICAL");
    });

    it("7.5 should detect explanation style 'AUTOMATION' for PLC, SCADA and control loop inquiries", () => {
      const style = KnowledgeRetrievalService.detectExplanationStyle("¿Cómo es la automatización en el PLC y lazo cerrado de nivel?");
      expect(style).toBe("AUTOMATION");
    });

    it("7.6 should build comprehensive provenance bundle attaching telemetry points, glossary, and SOPs", () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "scada");
      const bundle = KnowledgeRetrievalService.buildEvidenceBundle("molienda TCH y extracción de sacarosa", context, INITIAL_TELEMETRY, [], []);
      expect(bundle.glossaryHits.length).toBeGreaterThan(0);
      expect(bundle.liveDataProvenance.length).toBeGreaterThan(0);
      expect(bundle.liveDataProvenance[0].tag).toBeDefined();
      expect(bundle.liveDataProvenance[0].timestamp).toBeDefined();
    });
  });

  // ==========================================================================
  // SUITE 8: Tool Execution & Deterministic Industrial Actions (6 tests)
  // ==========================================================================
  describe("Suite 8: Tool Execution & Deterministic Industrial Actions", () => {
    it("8.1 should execute get_current_process_state tool returning valid industrial sources and widgets", async () => {
      const context = copilotContextService.buildContext(superAdminUser, "superadmin", activeTenant, "dashboard");
      const result = await IndustrialToolExecutor.execute({
        toolName: "get_current_process_state",
        args: {},
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(true);
      expect(result.data.telemetry.tch).toBe(INITIAL_TELEMETRY.tch);
      expect(result.sources).toBeDefined();
      expect(result.sources!.length).toBeGreaterThan(0);
      expect(result.widgets).toBeDefined();
    });

    it("8.2 should execute get_data_lineage tool tracing upstream sensors and physical instruments", async () => {
      const context = copilotContextService.buildContext(superAdminUser, "superadmin", activeTenant, "dashboard");
      const result = await IndustrialToolExecutor.execute({
        toolName: "get_data_lineage",
        args: { kpiId: "kpi-tch" },
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(true);
      expect(result.data.kpiName).toBeDefined();
      expect(result.data.overallQuality).toBeDefined();
      expect(result.widgets).toBeDefined();
      expect(result.widgets![0].type).toBe("DATA_LINEAGE");
    });

    it("8.3 should execute calculate_oee tool adhering to ISO 22400-2 MES KPI standard", async () => {
      const context = copilotContextService.buildContext(superAdminUser, "superadmin", activeTenant, "dashboard");
      const result = await IndustrialToolExecutor.execute({
        toolName: "calculate_oee",
        args: {},
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(true);
      expect(result.data.overallOee).toBeDefined();
      expect(result.data.standard).toBe("ISO 22400-2 MES KPI");
    });

    it("8.4 should execute search_glossary tool through IndustrialToolExecutor", async () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "dashboard");
      const result = await IndustrialToolExecutor.execute({
        toolName: "search_glossary",
        args: { query: "SCADA" },
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(true);
      expect(result.data.terms.length).toBeGreaterThan(0);
      expect(result.data.terms[0].term).toBe("SCADA");
    });

    it("8.5 should execute get_contextual_help tool returning module documentation and navigation action", async () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "scada");
      const result = await IndustrialToolExecutor.execute({
        toolName: "get_contextual_help",
        args: { module: "scada" },
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(true);
      expect(result.data.doc).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.actions![0].type).toBe("NAVIGATE");
    });

    it("8.6 should execute get_procedure tool returning structured SOP steps", async () => {
      const context = copilotContextService.buildContext(operatorUser, "operador", activeTenant, "scada");
      const result = await IndustrialToolExecutor.execute({
        toolName: "get_procedure",
        args: { procedureId: "sop-milling-trip-reduction" },
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(true);
      expect(result.data.procedure).toBeDefined();
      expect(result.data.procedure.steps.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SUITE 9: Two-Phase Confirmation Workflow & Safety Interlocks (4 tests)
  // ==========================================================================
  describe("Suite 9: Two-Phase Confirmation Workflow & Safety Interlocks", () => {
    it("9.1 should require explicit confirmation when requesting setpoint change (Level 3)", async () => {
      const context = copilotContextService.buildContext(superAdminUser, "superadmin", activeTenant, "uns_hub");
      const result = await IndustrialToolExecutor.execute({
        toolName: "request_setpoint_change",
        args: { tag: "Milling.TCH_Setpoint", newValue: 480 },
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(true);
      expect(result.requiredConfirmation).toBe(true);
      expect(result.confirmationDetails).toBeDefined();
      expect(result.confirmationDetails.level).toBe(3);
      expect(result.confirmationDetails.proposedValue).toBe(480);
    });

    it("9.2 should populate targetEntity, proposedValue, and operationalImpact in confirmation details", async () => {
      const context = copilotContextService.buildContext(adminUser, "administrador", activeTenant, "uns_hub");
      const result = await IndustrialToolExecutor.execute({
        toolName: "request_setpoint_change",
        args: { tag: "Boiler1.Pressure_Setpoint", newValue: 62 },
        context,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.confirmationDetails.targetEntity).toContain("Boiler1.Pressure_Setpoint");
      expect(result.confirmationDetails.proposedValue).toBe(62);
      expect(result.confirmationDetails.operationalImpact).toBeDefined();
    });

    it("9.3 should reject critical operations execution when user lacks required clearance", async () => {
      const lowClearanceContext = copilotContextService.buildContext(observerUser, "observador", activeTenant, "scada");
      const result = await IndustrialToolExecutor.execute({
        toolName: "request_setpoint_change",
        args: { tag: "Milling.TCH_Setpoint", newValue: 500 },
        context: lowClearanceContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("no tiene autorización");
    });

    it("9.4 should generate two-phase confirmation request in CopilotService for SETPOINT_CHANGE intent", async () => {
      const adminContext = copilotContextService.buildContext(adminUser, "administrador", activeTenant, "scada");
      const response = await copilotService.sendMessage({
        message: "cambiar setpoint de molienda a 480 TCH",
        context: adminContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.requiresConfirmation).toBe(true);
      expect(response.confirmationDetails).toBeDefined();
      expect(response.confirmationDetails!.level).toBe(3);
    });
  });

  // ==========================================================================
  // SUITE 10: Interactive Step-by-Step Tutorial & Onboarding (3 tests)
  // ==========================================================================
  describe("Suite 10: Interactive Step-by-Step Tutorial & Onboarding", () => {
    it("10.1 should retrieve initial tutorial step tailored to operator role", () => {
      const initialStep = copilotKnowledgeService.getInitialTutorialStep("operador");
      expect(initialStep).toBeDefined();
      expect(initialStep.stepNumber).toBe(1);
      expect(initialStep.title).toBeDefined();
      expect(initialStep.suggestedAction).toBeDefined();
    });

    it("10.2 should retrieve tutorial steps sequentially by step number", () => {
      const step1 = copilotKnowledgeService.getTutorialStep(1);
      const step2 = copilotKnowledgeService.getTutorialStep(2);
      expect(step1).toBeDefined();
      expect(step2).toBeDefined();
      expect(step1!.stepNumber).toBe(1);
      expect(step2!.stepNumber).toBe(2);
      expect(step1!.title).not.toBe(step2!.title);
    });

    it("10.3 should advance tutorial progression with getNextTutorialStep", () => {
      const nextStep = copilotKnowledgeService.getNextTutorialStep(1);
      expect(nextStep).toBeDefined();
      expect(nextStep!.stepNumber).toBe(2);
    });
  });
});
