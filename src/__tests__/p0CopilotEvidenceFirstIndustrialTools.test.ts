/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — TEST SUITE: P0-09/10/11 COPILOT EVIDENCE-FIRST & INDUSTRIAL TOOLS
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { copilotEvidenceEngine } from "../copilot/services/CopilotEvidenceEngine";
import { INITIAL_TELEMETRY, INITIAL_EQUIPMENT, INITIAL_ALARMS } from "../data/mockIndustrialData";
import { checkToolAuthorization, COPILOT_TOOL_POLICIES } from "../copilot/domain/CopilotPermissions";
import { CopilotIntentClassifier } from "../copilot/domain/CopilotIntentClassifier";
import { CopilotService } from "../copilot/services/copilotService";

describe("P0-09/10/11: Copilot Evidence-First & Controlled Industrial Tool Execution", () => {
  const testContext = {
    tenantId: "TENANT_PORTUGUESA",
    tenantName: "Central Azucarero Portuguesa",
    currentRole: "ingeniero" as any,
    telemetry: INITIAL_TELEMETRY,
    alarms: INITIAL_ALARMS,
    equipmentList: INITIAL_EQUIPMENT,
  };

  describe("1. P0-09 Controlled Industrial Tools Execution", () => {
    it("executes queryHistorian with range and point limits without querying raw databases", async () => {
      const res = await copilotEvidenceEngine.executeTool(
        "queryHistorian",
        { tag: "Milling.Tandem.Extraction_Actual", limit: 25, range: "LAST_4_HOURS" },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.provenance).toBe("HISTORICAL");
      expect(res.data.points.length).toBeLessThanOrEqual(26);
      expect(res.sources[0].provenance).toBe("HISTORICAL");
      expect(res.sources[0].historianRange).toBe("LAST_4_HOURS");
    });

    it("executes getLivePlantState, getAlarms, getProduction and getEnergy", async () => {
      const liveRes = await copilotEvidenceEngine.executeTool("getLivePlantState", {}, testContext);
      expect(liveRes.success).toBe(true);
      expect(liveRes.data.tch).toBe(INITIAL_TELEMETRY.tch);
      expect(["REAL", "SIMULATED"]).toContain(liveRes.provenance);

      const alarmRes = await copilotEvidenceEngine.executeTool("getAlarms", { limit: 10 }, testContext);
      expect(alarmRes.success).toBe(true);
      expect(alarmRes.data.alarms).toBeDefined();

      const prodRes = await copilotEvidenceEngine.executeTool("getProduction", {}, testContext);
      expect(prodRes.success).toBe(true);
      expect(prodRes.data.millingExtraction).toBe(INITIAL_TELEMETRY.millingExtraction);

      const energyRes = await copilotEvidenceEngine.executeTool("getEnergy", {}, testContext);
      expect(energyRes.success).toBe(true);
      expect(energyRes.data.powerExportGridMW).toBe(INITIAL_TELEMETRY.powerExportGridMW);
    });

    it("executes getOee, searchRag, calculate, comparePeriods, getMaintenance and getAgricultureState", async () => {
      const oeeRes = await copilotEvidenceEngine.executeTool("getOee", {}, testContext);
      expect(oeeRes.success).toBe(true);
      expect(oeeRes.data.standard).toBe("ISO 22400-2");

      const ragRes = await copilotEvidenceEngine.executeTool("searchRag", { query: "caída de extracción" }, testContext);
      expect(ragRes.success).toBe(true);
      expect(ragRes.provenance).toBe("RAG");
      expect(ragRes.sources[0].provenance).toBe("RAG");

      const calcRes = await copilotEvidenceEngine.executeTool("calculate", { formula: "extraction_balance" }, testContext);
      expect(calcRes.success).toBe(true);
      expect(calcRes.provenance).toBe("HEURISTIC");

      const compareRes = await copilotEvidenceEngine.executeTool("comparePeriods", {}, testContext);
      expect(compareRes.success).toBe(true);
      expect(compareRes.provenance).toBe("HISTORICAL");

      const maintRes = await copilotEvidenceEngine.executeTool("getMaintenance", {}, testContext);
      expect(maintRes.success).toBe(true);

      const agriRes = await copilotEvidenceEngine.executeTool("getAgricultureState", {}, testContext);
      expect(agriRes.success).toBe(true);
      expect(agriRes.data.activeHarvestPlotsCount).toBeGreaterThan(0);
    });
  });

  describe("2. P0-10 & P0-11 Grounded Multi-Source RCA (Extraction Drop)", () => {
    it("classifies query '¿Por qué bajó la extracción?' as ROOT_CAUSE_ANALYSIS", () => {
      const classification = CopilotIntentClassifier.classify("¿Por qué bajó la extracción?");
      expect(classification.intent).toBe("ROOT_CAUSE_ANALYSIS");
      expect(classification.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("executes multi-source RCA correlating Historian, SCADA, Alarms, Maintenance and RAG SOP-MOL-04", async () => {
      const rca = await copilotEvidenceEngine.executeExtractionDropRca(testContext);

      expect(rca.evidenceBadge).toContain("Evidence: Historian / Alarm / SOP / Maintenance");
      expect(rca.answerText).toBeDefined();
      expect(rca.confidencePercent).toBeGreaterThanOrEqual(90);

      // Verify Provenance differentiation (P0-10: REAL, SIMULATED, HISTORICAL, RAG, HEURISTIC, LLM)
      expect(rca.provenanceSummary.HISTORICAL).toBeGreaterThan(0);
      expect(rca.provenanceSummary.RAG).toBeGreaterThan(0);
      expect(rca.provenanceSummary.LLM).toBe(1);

      // Verify tokens and pricing accounting
      expect(rca.tokensUsed.total).toBeGreaterThan(0);
      expect(rca.estimatedCostUsd).toBeGreaterThan(0);
      expect(rca.operationalLimitations.length).toBeGreaterThan(0);
    });

    it("CopilotService processes extraction query end-to-end and returns evidence report", async () => {
      const copilot = CopilotService.getInstance();
      const response = await copilot.sendMessage("¿Por qué bajó la extracción de caña?", {
        currentModule: "scada",
        roles: ["ingeniero"],
        plantId: "TENANT_PORTUGUESA",
      });

      expect(response.intent).toBe("ROOT_CAUSE_ANALYSIS");
      expect(response.message).toContain("Análisis de Causa Raíz (RCA)");
      expect(response.message).toContain("Evidence: Historian / Alarm / SOP / Maintenance");
      expect(response.message).toContain("SOP-MOL-04");
      expect(response.widgets?.some((w) => w.type === "KPI" && (w as any).kpiId === "kpi-milling-extraction")).toBe(true);
    });
  });

  describe("3. Security & Tool Authorization (Fail-Closed)", () => {
    it("allows authorized operator to query telemetry and alarms", () => {
      const check = checkToolAuthorization("queryHistorian", ["operador"], 1, false);
      expect(check.allowed).toBe(true);
    });

    it("blocks unauthorized roles from administrative/security tools", () => {
      const check = checkToolAuthorization("execute_command_edge", ["observador"], 1, false);
      expect(check.allowed).toBe(false);
    });
  });
});
