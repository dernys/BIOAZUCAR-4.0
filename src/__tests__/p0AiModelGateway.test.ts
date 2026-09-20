/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — TEST SUITE: P0-08 AI MODEL GATEWAY MULTI-PROVEEDOR
 * Estándar: IEC 62443-3-3 SL3 / ISA-95 L3/L4 Industrial AI Gateway
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AiModelGatewayService } from "../services/ai/gateway/AiModelGatewayService.js";
import { MockAiAdapter } from "../services/ai/gateway/adapters/MockAiAdapter.js";
import { OllamaAdapter } from "../services/ai/gateway/adapters/OllamaAdapter.js";
import { OpenAiAdapter } from "../services/ai/gateway/adapters/OpenAiAdapter.js";
import { AnthropicAdapter } from "../services/ai/gateway/adapters/AnthropicAdapter.js";
import { AzureOpenAiAdapter } from "../services/ai/gateway/adapters/AzureOpenAiAdapter.js";

describe("BIOAZÚCAR 4.0 — P0-08 AI MODEL GATEWAY & OBSERVABILITY SUITE", () => {
  let gateway: AiModelGatewayService;

  beforeEach(() => {
    gateway = AiModelGatewayService.getInstance();
    // Default to mock for deterministic tests
    gateway.setActiveProvider("mock");
    gateway.setFallbackChain(["mock"]);
  });

  describe("1. Provider Registry & Configuration Management", () => {
    it("initializes all standard industrial adapters", () => {
      const providers = gateway.getConfiguredProviders();
      const names = providers.map((p) => p.provider);

      expect(names).toContain("gemini");
      expect(names).toContain("openai");
      expect(names).toContain("anthropic");
      expect(names).toContain("azure_openai");
      expect(names).toContain("ollama");
      expect(names).toContain("mock");
    });

    it("allows dynamic switching of primary provider", () => {
      gateway.setActiveProvider("ollama");
      expect(gateway.getActiveProvider()).toBe("ollama");

      gateway.setActiveProvider("mock");
      expect(gateway.getActiveProvider()).toBe("mock");
    });

    it("rejects unsupported providers gracefully", () => {
      expect(() => {
        gateway.setActiveProvider("unsupported_provider" as any);
      }).toThrow("Unsupported AI Provider: unsupported_provider");
    });

    it("allows fine-tuning of model parameters and pricing rates", () => {
      const updated = gateway.configureProvider("mock", {
        temperature: 0.15,
        maxOutputTokens: 1024,
        costPer1kInputTokensUsd: 0.0002,
        costPer1kOutputTokensUsd: 0.0005,
      });

      expect(updated.temperature).toBe(0.15);
      expect(updated.costPer1kInputTokensUsd).toBe(0.0002);
      expect(updated.costPer1kOutputTokensUsd).toBe(0.0005);
    });
  });

  describe("2. Completion Dispatch, Token Accounting & Cost Calculation", () => {
    it("processes structured JSON request and outputs valid schema with token metrics", async () => {
      gateway.setActiveProvider("mock");

      const response = await gateway.generateCompletion({
        prompt: "Diagnóstico de vibración en molino 3",
        systemInstruction: "Eres un asistente de mantenimiento industrial predictivo",
        responseFormat: "json",
        tenantId: "tenant-central-01",
        userId: "usr-tech-01",
      });

      expect(response).toBeDefined();
      expect(response.provider).toBe("mock");
      expect(response.traceId).toMatch(/^ai-trace-/);
      expect(response.parsedJson).toBeDefined();
      expect(response.parsedJson?.intent).toBe("SYSTEM_INFORMATION");
      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
      expect(response.usage.totalTokens).toBe(
        response.usage.promptTokens + response.usage.completionTokens
      );
      expect(response.latencyMs).toBeGreaterThan(0);
      expect(response.isFallback).toBe(false);
    });

    it("correctly estimates cost based on configured rates", async () => {
      gateway.configureProvider("mock", {
        costPer1kInputTokensUsd: 0.001,
        costPer1kOutputTokensUsd: 0.002,
      });

      const response = await gateway.generateCompletion({
        prompt: "Calcula OEE del tándem de molienda",
        responseFormat: "text",
      });

      const expectedCost =
        (response.usage.promptTokens / 1000) * 0.001 +
        (response.usage.completionTokens / 1000) * 0.002;

      expect(response.usage.estimatedCostUsd).toBeCloseTo(expectedCost, 5);
    });
  });

  describe("3. Multi-Provider Failover & Resilience (Circuit Breaker)", () => {
    it("activates fallback provider when primary provider encounters an error", async () => {
      // Force primary provider to one with unconfigured key (openai without key)
      delete process.env.OPENAI_API_KEY;
      gateway.configureProvider("openai", { apiKey: "" });
      gateway.setActiveProvider("openai");
      gateway.setFallbackChain(["mock"]);

      const response = await gateway.generateCompletion({
        prompt: "¿Cuál es la presión de caldera recomendada?",
        responseFormat: "json",
        tenantId: "tenant-bioazucar-01",
      });

      expect(response).toBeDefined();
      expect(response.isFallback).toBe(true);
      expect(response.provider).toBe("mock");
      expect(response.fallbackReason).toContain("OPENAI_API_KEY is not configured");
    });
  });

  describe("4. Air-Gapped On-Premise Execution (Ollama & Local Industrial Compliance)", () => {
    it("marks local on-premise models as zero-cost and compliant with air-gapped mills", () => {
      const ollamaConfig = gateway.getProviderConfig("ollama");
      expect(ollamaConfig).toBeDefined();
      expect(ollamaConfig?.isLocalOnPremise).toBe(true);
      expect(ollamaConfig?.costPer1kInputTokensUsd).toBe(0.0);
      expect(ollamaConfig?.costPer1kOutputTokensUsd).toBe(0.0);
    });
  });

  describe("5. Observability Ring Buffer & OpenMetrics Exporter", () => {
    it("records telemetry in ring buffer with traceId, tenantId, latency and tokens", async () => {
      const traceId = "test-trace-12345";
      await gateway.generateCompletion({
        prompt: "Revisar presión en domo de caldera",
        responseFormat: "json",
        traceId,
        tenantId: "tenant-bioazucar-testing",
        userId: "auditor-01",
      });

      const records = gateway.getRecentRecords(10);
      const match = records.find((r) => r.traceId === traceId);

      expect(match).toBeDefined();
      expect(match?.tenantId).toBe("tenant-bioazucar-testing");
      expect(match?.userId).toBe("auditor-01");
      expect(match?.totalTokens).toBeGreaterThan(0);
      expect(match?.status).toBe("SUCCESS");
    });

    it("generates valid OpenMetrics v0.0.4 formatted metrics string for Prometheus", () => {
      const metrics = gateway.exportPrometheusMetrics();

      expect(metrics).toContain("# HELP bioazucar_ai_requests_total");
      expect(metrics).toContain("# TYPE bioazucar_ai_requests_total counter");
      expect(metrics).toContain("bioazucar_ai_requests_total{provider=\"mock\",status=\"success\"}");
      expect(metrics).toContain("# HELP bioazucar_ai_tokens_total");
      expect(metrics).toContain("# HELP bioazucar_ai_estimated_cost_usd_total");
      expect(metrics).toContain("# HELP bioazucar_ai_latency_ms");
    });
  });
});
