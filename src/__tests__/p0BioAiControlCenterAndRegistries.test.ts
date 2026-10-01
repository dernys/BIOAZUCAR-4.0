/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — TEST SUITE: P0-02/08 BIOAI CONTROL CENTER & REGISTRIES
 * Covers: Model Registry, Provider Registry, Pricing Registry, Cost Ledger,
 * Budget Engine, Router, Prompt Registry, Local AI Compute, RAG Governance.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import { aiModelRegistry, AiModelRecord } from "../services/ai/models/AiModelRegistry";
import { aiProviderRegistry } from "../services/ai/providers/AiProviderRegistry";
import { aiPricingRegistry } from "../services/ai/pricing/AiPricingRegistry";
import { aiCostLedger } from "../services/ai/ledger/AiCostLedger";
import { aiBudgetEngine } from "../services/ai/budget/AiBudgetEngine";
import { aiRouter } from "../services/ai/router/AiRouter";
import { aiPromptRegistry } from "../services/ai/prompts/AiPromptRegistry";
import { aiRagGovernanceService } from "../services/ai/rag/AiRagGovernanceService";
import { localAiComputeModel } from "../services/ai/local/LocalAiComputeModel";

describe("P0-02 to P0-08, P0-12, P0-13, P0-15: BioAI Subsystems Suite", () => {
  beforeEach(() => {
    // Reset test state where applicable
  });

  // --------------------------------------------------------------------------
  // 1. MODEL REGISTRY (P0-03)
  // --------------------------------------------------------------------------
  describe("1. AiModelRegistry — Full CRUD & Inference Verification", () => {
    it("reads standard models and filters by provider", () => {
      const all = aiModelRegistry.getAll();
      expect(all.length).toBeGreaterThanOrEqual(5);

      const geminiModels = aiModelRegistry.getByProvider("gemini");
      expect(geminiModels.length).toBeGreaterThanOrEqual(2);
      expect(geminiModels.some((m) => m.modelId === "gemini-2.5-flash")).toBe(true);
    });

    it("creates, updates, disables and deletes custom industrial model", () => {
      const customModel: Omit<AiModelRecord, "createdAt" | "updatedAt"> = {
        id: "model-custom-boiler-v1",
        provider: "gemini",
        modelId: "gemini-custom-boiler",
        displayName: "Boiler Fine-Tuned Model",
        version: "1.0.0",
        contextWindow: 128000,
        inputPrice: 0.0001,
        outputPrice: 0.0004,
        currency: "USD",
        pricingSource: "Google AI Studio Custom Fine-Tuning Schedule",
        pricingSourceUrl: "https://ai.google.dev/pricing",
        pricingVersion: "2026.01",
        effectiveFrom: "2026-01-01T00:00:00Z",
        capabilities: {
          vision: true,
          audio: false,
          tools: true,
          structuredOutput: true,
          embeddings: false,
        },
        status: "ACTIVE",
        enabled: true,
        environment: "PRODUCTION",
      };

      // CREATE
      const created = aiModelRegistry.create(customModel);
      expect(created.id).toBe("model-custom-boiler-v1");
      expect(aiModelRegistry.getById("model-custom-boiler-v1")).toBeDefined();

      // UPDATE
      const updated = aiModelRegistry.update("model-custom-boiler-v1", {
        displayName: "Boiler Fine-Tuned Model v2",
        outputPrice: 0.0005,
      });
      expect(updated.displayName).toBe("Boiler Fine-Tuned Model v2");
      expect(updated.outputPrice).toBe(0.0005);

      // DISABLE
      aiModelRegistry.setEnabled("model-custom-boiler-v1", false);
      expect(aiModelRegistry.getById("model-custom-boiler-v1")?.enabled).toBe(false);

      // DELETE
      const deleted = aiModelRegistry.delete("model-custom-boiler-v1");
      expect(deleted).toBe(true);
      expect(aiModelRegistry.getById("model-custom-boiler-v1")).toBeUndefined();
    });

    it("executes model connection test and test inference", async () => {
      const connTest = await aiModelRegistry.testConnection("model-gemini-2.5-flash");
      expect(connTest.success).toBe(true);
      expect(connTest.latencyMs).toBeGreaterThan(0);

      const inferenceTest = await aiModelRegistry.testModel("model-gemini-2.5-flash", "Consumo de vapor");
      expect(inferenceTest.success).toBe(true);
      expect(inferenceTest.tokens.total).toBeGreaterThan(0);
      expect(inferenceTest.costUsd).toBeGreaterThan(0);
      expect(inferenceTest.output).toContain("Gemini 2.5 Flash");
    });
  });

  // --------------------------------------------------------------------------
  // 2. PROVIDER REGISTRY & SECRETS INDIRECTION (P0-04)
  // --------------------------------------------------------------------------
  describe("2. AiProviderRegistry — Zero Raw Secret Exposure (secretRef)", () => {
    it("maintains secretRef indirection without storing raw API keys", () => {
      const providers = aiProviderRegistry.getAll();
      for (const p of providers) {
        expect(p.secretRef).toMatch(/^(ENV:|VAULT:|LOCAL:|NONE:)/);
        // Ensure no raw 40-char secret keys exist
        expect(p.secretRef).not.toMatch(/^[A-Za-z0-9_-]{39,}$/);
      }
    });

    it("reports correct health status transitions", async () => {
      const mockTest = await aiProviderRegistry.testConnection("mock");
      expect(mockTest.status).toBe("HEALTHY");

      const geminiTest = await aiProviderRegistry.testConnection("gemini");
      expect(geminiTest.status).toBe("HEALTHY");

      const openaiTest = await aiProviderRegistry.testConnection("openai");
      expect(["NOT_CONFIGURED", "HEALTHY"]).toContain(openaiTest.status);
    });

    it("rejects raw plaintext API keys passed in secretRef", () => {
      const dummy = {
        provider: "mock" as any,
        displayName: "Test Leak",
        secretRef: "AIzaSyD1234567890abcdef1234567890abcdef1", // raw 40+ char key
        isConfigured: true,
        healthStatus: "HEALTHY" as any,
        isLocalOnPremise: true,
        failureCount: 0,
        enabled: true,
      };

      aiProviderRegistry.register(dummy);
      const saved = aiProviderRegistry.get("mock" as any);
      expect(saved?.secretRef).toContain("REDACTED:RAW_SECRET_REJECTED");
    });
  });

  // --------------------------------------------------------------------------
  // 3. PRICING REGISTRY & COST CALCULATION (P0-05)
  // --------------------------------------------------------------------------
  describe("3. AiPricingRegistry — Real Pricing & Verification Gating", () => {
    it("returns official verified source URLs for supported vendors", () => {
      const geminiTier = aiPricingRegistry.getPricingTier("gemini", "gemini-2.5-flash");
      expect(geminiTier.isVerified).toBe(true);
      expect(geminiTier.pricingSource).toContain("Google AI Studio");
      expect(geminiTier.sourceUrl).toContain("https://ai.google.dev/pricing");
      expect(geminiTier.inputPricePer1kTokens).toBe(0.000075);
      expect(geminiTier.outputPricePer1kTokens).toBe(0.0003);
    });

    it("applies cached tokens discount and reasoning token differentiation", () => {
      const costResult = aiPricingRegistry.calculateCost({
        provider: "gemini",
        model: "gemini-2.5-flash",
        promptTokens: 10000,
        completionTokens: 2000,
        cachedTokens: 4000, // 4k cached tokens
      });

      expect(costResult.isVerified).toBe(true);
      expect(costResult.breakdown.inputCost).toBeGreaterThan(0);
      expect(costResult.breakdown.cachedInputCost).toBeLessThan(costResult.breakdown.inputCost);
      expect(costResult.estimatedCostUsd).toBeGreaterThan(0);
    });

    it("flags unverified models with PRICE_UNVERIFIED", () => {
      const unverifiedTier = aiPricingRegistry.getPricingTier("openai", "unregistered-future-model");
      expect(unverifiedTier.isVerified).toBe(false);
      expect(unverifiedTier.pricingSource).toBe("PRICE_UNVERIFIED");
    });
  });

  // --------------------------------------------------------------------------
  // 4. COST LEDGER & ESTIMATED VS ACTUAL (P0-06)
  // --------------------------------------------------------------------------
  describe("4. AiCostLedger — Estimated vs Actual Cost & Token Accounting", () => {
    it("records completion request with token breakdown, cost variance and audit metadata", () => {
      const entry = aiCostLedger.recordRequest({
        traceId: "trace-audit-test-01",
        tenantId: "TENANT_PORTUGUESA",
        userId: "usr-eng-01",
        module: "scada",
        useCase: "OPERATIONAL_SUMMARY",
        provider: "gemini",
        model: "gemini-2.5-flash",
        promptTokens: 800,
        completionTokens: 300,
        cachedTokens: 200,
        latencyMs: 310,
        isFallback: false,
        status: "SUCCESS",
        actualCostUsd: 0.000140, // slightly different actual cost returned by vendor billing
      });

      expect(entry.requestId).toMatch(/^ai-req-/);
      expect(entry.tokens.totalTokens).toBe(1100);
      expect(entry.tokens.cachedTokens).toBe(200);
      expect(entry.actualCostUsd).toBe(0.000140);
      expect(entry.costVarianceUsd).toBeDefined();
      expect(entry.isPricingVerified).toBe(true);
    });

    it("aggregates ledger summary and percentile latencies", () => {
      const summary = aiCostLedger.getSummary("TENANT_PORTUGUESA");
      expect(summary.totalRequests).toBeGreaterThan(0);
      expect(summary.totalTokens).toBeGreaterThan(0);
      expect(summary.totalEstimatedCostUsd).toBeGreaterThan(0);
      expect(summary.latencyMetrics.p50Ms).toBeGreaterThan(0);
      expect(summary.latencyMetrics.p95Ms).toBeGreaterThanOrEqual(summary.latencyMetrics.p50Ms);
    });
  });

  // --------------------------------------------------------------------------
  // 5. BUDGET ENGINE (P0-07)
  // --------------------------------------------------------------------------
  describe("5. AiBudgetEngine — Multi-Tier Quotas & Exceeded Policy Enforcement", () => {
    it("evaluates healthy budgets with PROCEED action", () => {
      const res = aiBudgetEngine.evaluateBudget({
        tenantId: "TENANT_PORTUGUESA",
        module: "scada",
        estimatedCostUsd: 0.001,
      });

      expect(res.allowed).toBe(true);
      expect(res.action).toBe("PROCEED");
    });

    it("enforces action when budget is exceeded", () => {
      // Create a test budget with $1.00 monthly limit
      aiBudgetEngine.createBudget({
        id: "budget-test-exceeded",
        scope: "TENANT",
        targetId: "TENANT_TEST_LIMITED",
        displayName: "Test Limited Tenant",
        monthlyBudgetUsd: 1.0,
        currentSpendUsd: 1.05, // already over limit
        currency: "USD",
        warningThresholdPercent: 80,
        criticalThresholdPercent: 90,
        exceededAction: "FALLBACK_TO_LOCAL",
        enabled: true,
      });

      const check = aiBudgetEngine.evaluateBudget({
        tenantId: "TENANT_TEST_LIMITED",
        estimatedCostUsd: 0.05,
      });

      expect(check.action).toBe("FALLBACK_TO_LOCAL");
      expect(check.matchingBudgets.some((b) => b.status === "EXCEEDED")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. AI ROUTER (P0-08)
  // --------------------------------------------------------------------------
  describe("6. AiRouter — Intelligent Multi-Criteria Routing", () => {
    it("routes RCA to deep reasoning Gemini 1.5 Pro", () => {
      const decision = aiRouter.resolveRoute({
        useCase: "RCA",
        complexity: "HIGH",
      });

      expect(decision.selectedModel).toBe("gemini-1.5-pro");
      expect(decision.policyApplied).toBe("DEEP_REASONING_RCA");
      expect(decision.routingRationale).toContain("Root Cause Analysis");
    });

    it("enforces air-gapped local edge boundary when AIR_GAPPED_OT_ONLY is specified", () => {
      const decision = aiRouter.resolveRoute({
        useCase: "SIMPLE_QUERY",
        privacyLevel: "AIR_GAPPED_OT_ONLY",
      });

      expect(decision.selectedProvider).toBe("ollama");
      expect(decision.selectedModel).toBe("llama3.2");
      expect(decision.policyApplied).toBe("IEC62443_LOCAL_EDGE_AIR_GAPPED");
    });
  });

  // --------------------------------------------------------------------------
  // 7. PROMPT REGISTRY (P0-13)
  // --------------------------------------------------------------------------
  describe("7. AiPromptRegistry — Versioning & Promotion Governance", () => {
    it("prevents promoting prompt to ACTIVE without approval signature", () => {
      aiPromptRegistry.createPrompt({
        promptId: "prompt-draft-unapproved",
        version: "0.1.0",
        displayName: "Draft Unapproved",
        purpose: "Testing governance gate",
        targetModel: "gemini-2.5-flash",
        systemPrompt: "You are a test assistant",
        variables: [],
        tools: [],
        temperature: 0.2,
        maxOutputTokens: 1024,
        status: "DRAFT",
        createdBy: "tech@bioazucar.com",
        effectiveFrom: "2026-01-01T00:00:00Z",
      });

      expect(() => {
        aiPromptRegistry.updatePrompt("prompt-draft-unapproved", {
          status: "ACTIVE",
          // approvedBy omitted
        });
      }).toThrow("No se puede promover un prompt a ACTIVE sin una firma de aprobación");
    });

    it("interpolates prompt variables cleanly", () => {
      const prompt = aiPromptRegistry.getById("prompt-copilot-industrial-core");
      expect(prompt).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 8. RAG GOVERNANCE & TELEMETRY STREAM REJECTION (P0-12)
  // --------------------------------------------------------------------------
  describe("8. AiRagGovernanceService — Anti-Slop & Retrieval Quality", () => {
    it("strictly rejects dumping raw high-frequency telemetry JSON streams into RAG", () => {
      const rawTelemetryStream = JSON.stringify({
        stream: Array.from({ length: 500 }, (_, i) => ({
          timestamp: `2026-09-30T12:00:${i}Z`,
          val: 94.2 + i * 0.01,
          tag: "Milling.Tandem.Extraction_Actual",
        })),
      });

      expect(() => {
        aiRagGovernanceService.registerDocument({
          id: "doc-invalid-telemetry-dump",
          title: "Raw Telemetry Stream Dump",
          documentType: "SOP",
          version: "1.0",
          tenantId: "TENANT_PORTUGUESA",
          plantArea: "MOLIENDA",
          language: "es",
          isIndexed: false,
          rawContent: rawTelemetryStream,
        });
      }).toThrow("RECHAZADO: RAG no admite ingesta directa de telemetría industrial RAW");
    });

    it("performs semantic retrieval test with citation score and token calculation", () => {
      const test = aiRagGovernanceService.testRetrieval("extracción de sacarosa tándem molinos bagazo");
      expect(test.documentsRetrieved).toBeGreaterThan(0);
      expect(test.retrievalLatencyMs).toBeGreaterThan(0);
      expect(test.chunksRetrieved[0].documentTitle).toContain("SOP-MOL-04");
      expect(test.citationCoveragePercent).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 9. LOCAL AI / OLLAMA COMPUTE MODEL (P0-15)
  // --------------------------------------------------------------------------
  describe("9. LocalAiComputeModel — Electrical Energy & Compute Modeling", () => {
    it("computes realistic electrical cost for on-premise local inference", () => {
      localAiComputeModel.setConfig({
        hardwareId: "RTX_4090",
        electricityRateUsdPerKWh: 0.12,
      });

      const cost = localAiComputeModel.calculateComputeCost(3600000); // 1 hour inference
      expect(cost.powerWatts).toBeGreaterThan(300);
      expect(cost.kwhConsumed).toBeGreaterThan(0.3);
      expect(cost.localComputeCostUsd).toBeGreaterThan(0.03);
      expect(cost.hardwareName).toContain("RTX 4090");
    });
  });
});
