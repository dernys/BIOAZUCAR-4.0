/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — UNIFIED INDUSTRIAL AI MODEL GATEWAY
 * Estándar: IEC 62443-3-3 SL3 / ISA-95 L3/L4 Industrial Architecture
 * Módulo: [P0-08] AI MODEL GATEWAY MULTI-PROVEEDOR & OBSERVABILIDAD
 * ============================================================================
 */

import { randomUUID } from "node:crypto";
import {
  AiProviderType,
  AiModelConfig,
  AiGatewayRequest,
  AiGatewayResponse,
  AiObservabilityRecord,
  AiGatewayStats,
  IAiProviderAdapter,
} from "./types.js";
import { GeminiAdapter } from "./adapters/GeminiAdapter.js";
import { OpenAiAdapter } from "./adapters/OpenAiAdapter.js";
import { AnthropicAdapter } from "./adapters/AnthropicAdapter.js";
import { AzureOpenAiAdapter } from "./adapters/AzureOpenAiAdapter.js";
import { OllamaAdapter } from "./adapters/OllamaAdapter.js";
import { MockAiAdapter } from "./adapters/MockAiAdapter.js";

export class AiModelGatewayService {
  private static instance: AiModelGatewayService | null = null;

  private primaryProvider: AiProviderType = "gemini";
  private fallbackChain: AiProviderType[] = ["ollama", "mock"];
  private adapters = new Map<AiProviderType, IAiProviderAdapter>();
  private configs = new Map<AiProviderType, AiModelConfig>();

  // Observability & Auditing Ring Buffer (capped at 1000 items)
  private observabilityRecords: AiObservabilityRecord[] = [];
  private readonly maxRecordHistory = 1000;

  // Cumulative performance counters
  private stats: AiGatewayStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    fallbackRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalEstimatedCostUsd: 0,
    averageLatencyMs: 0,
    providerBreakdown: {
      gemini: { requests: 0, failures: 0, totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0 },
      openai: { requests: 0, failures: 0, totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0 },
      anthropic: { requests: 0, failures: 0, totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0 },
      azure_openai: { requests: 0, failures: 0, totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0 },
      ollama: { requests: 0, failures: 0, totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0 },
      mock: { requests: 0, failures: 0, totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0 },
    },
  };

  private constructor() {
    this.registerDefaultAdapters();
    this.initializeDefaultConfigs();

    // Check environment override
    const envProvider = process.env.AI_PRIMARY_PROVIDER as AiProviderType;
    if (envProvider && this.adapters.has(envProvider)) {
      this.primaryProvider = envProvider;
    }
  }

  public static getInstance(): AiModelGatewayService {
    if (!AiModelGatewayService.instance) {
      AiModelGatewayService.instance = new AiModelGatewayService();
    }
    return AiModelGatewayService.instance;
  }

  private registerDefaultAdapters(): void {
    this.adapters.set("gemini", new GeminiAdapter());
    this.adapters.set("openai", new OpenAiAdapter());
    this.adapters.set("anthropic", new AnthropicAdapter());
    this.adapters.set("azure_openai", new AzureOpenAiAdapter());
    this.adapters.set("ollama", new OllamaAdapter());
    this.adapters.set("mock", new MockAiAdapter());
  }

  private initializeDefaultConfigs(): void {
    this.configs.set("gemini", {
      provider: "gemini",
      model: "gemini-2.5-flash",
      temperature: 0.2,
      maxOutputTokens: 2048,
      costPer1kInputTokensUsd: 0.000075,
      costPer1kOutputTokensUsd: 0.0003,
      timeoutMs: 20000,
    });

    this.configs.set("openai", {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.2,
      maxOutputTokens: 2048,
      costPer1kInputTokensUsd: 0.00015,
      costPer1kOutputTokensUsd: 0.0006,
      timeoutMs: 20000,
    });

    this.configs.set("anthropic", {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.2,
      maxOutputTokens: 2048,
      costPer1kInputTokensUsd: 0.003,
      costPer1kOutputTokensUsd: 0.015,
      timeoutMs: 25000,
    });

    this.configs.set("azure_openai", {
      provider: "azure_openai",
      model: "gpt-4o",
      temperature: 0.2,
      maxOutputTokens: 2048,
      costPer1kInputTokensUsd: 0.0025,
      costPer1kOutputTokensUsd: 0.01,
      timeoutMs: 20000,
    });

    this.configs.set("ollama", {
      provider: "ollama",
      model: "llama3.2",
      endpointUrl: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
      temperature: 0.2,
      maxOutputTokens: 2048,
      costPer1kInputTokensUsd: 0.0,
      costPer1kOutputTokensUsd: 0.0,
      isLocalOnPremise: true,
      timeoutMs: 30000,
    });

    this.configs.set("mock", {
      provider: "mock",
      model: "mock-industrial-v1",
      temperature: 0.0,
      maxOutputTokens: 1024,
      costPer1kInputTokensUsd: 0.0,
      costPer1kOutputTokensUsd: 0.0,
      isLocalOnPremise: true,
      timeoutMs: 5000,
    });
  }

  public getActiveProvider(): AiProviderType {
    return this.primaryProvider;
  }

  public setActiveProvider(provider: AiProviderType): void {
    if (!this.adapters.has(provider)) {
      throw new Error(`Unsupported AI Provider: ${provider}`);
    }
    this.primaryProvider = provider;
  }

  public getFallbackChain(): AiProviderType[] {
    return [...this.fallbackChain];
  }

  public setFallbackChain(chain: AiProviderType[]): void {
    this.fallbackChain = chain.filter((p) => this.adapters.has(p));
  }

  public configureProvider(
    provider: AiProviderType,
    configUpdates: Partial<AiModelConfig>
  ): AiModelConfig {
    const existing = this.configs.get(provider);
    if (!existing) {
      throw new Error(`Provider config not found: ${provider}`);
    }
    const updated = { ...existing, ...configUpdates };
    this.configs.set(provider, updated);
    return updated;
  }

  public getProviderConfig(provider: AiProviderType): AiModelConfig | undefined {
    return this.configs.get(provider);
  }

  public getConfiguredProviders(): Array<{
    provider: AiProviderType;
    configured: boolean;
    isPrimary: boolean;
    isLocalOnPremise: boolean;
    model: string;
  }> {
    return Array.from(this.configs.values()).map((cfg) => {
      const adapter = this.adapters.get(cfg.provider);
      return {
        provider: cfg.provider,
        configured: adapter ? adapter.isConfigured(cfg) : false,
        isPrimary: cfg.provider === this.primaryProvider,
        isLocalOnPremise: Boolean(cfg.isLocalOnPremise),
        model: cfg.model,
      };
    });
  }

  /**
   * Main completion entry point: Dispatches request with automatic failover,
   * latency measurement, token usage extraction, and IEC 62443 observability records.
   */
  public async generateCompletion(request: AiGatewayRequest): Promise<AiGatewayResponse> {
    const traceId = request.traceId || `ai-trace-${randomUUID()}`;
    const tenantId = request.tenantId || request.context?.tenantId || "default-tenant";
    const userId = request.userId || request.context?.userId || "anonymous";

    this.stats.totalRequests++;

    const providerSequence: AiProviderType[] = [];
    if (request.preferredProvider && this.adapters.has(request.preferredProvider)) {
      providerSequence.push(request.preferredProvider);
    }
    if (!providerSequence.includes(this.primaryProvider)) {
      providerSequence.push(this.primaryProvider);
    }
    for (const fb of this.fallbackChain) {
      if (!providerSequence.includes(fb)) {
        providerSequence.push(fb);
      }
    }

    let lastError: Error | null = null;
    let attemptedCount = 0;

    for (const provider of providerSequence) {
      const adapter = this.adapters.get(provider);
      const config = this.configs.get(provider);

      if (!adapter || !config) continue;

      attemptedCount++;
      const isFallback = attemptedCount > 1;

      try {
        const rawRes = await adapter.generateCompletion(request, config);

        const response: AiGatewayResponse = {
          ...rawRes,
          traceId,
          isFallback,
          fallbackReason: isFallback && lastError ? lastError.message : undefined,
        };

        this.recordSuccessTelemetry({
          traceId,
          tenantId,
          userId,
          provider,
          model: config.model,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          estimatedCostUsd: response.usage.estimatedCostUsd,
          latencyMs: response.latencyMs,
          isLocalOnPremise: Boolean(config.isLocalOnPremise),
          isFallback,
        });

        return response;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.recordFailureTelemetry({
          traceId,
          tenantId,
          userId,
          provider,
          model: config.model,
          latencyMs: 0,
          isLocalOnPremise: Boolean(config.isLocalOnPremise),
          errorMessage: lastError.message,
        });
      }
    }

    this.stats.failedRequests++;
    throw new Error(
      `AI Gateway exhausted all available providers. Last error: ${lastError?.message || "Unknown"}`
    );
  }

  private recordSuccessTelemetry(params: {
    traceId: string;
    tenantId: string;
    userId: string;
    provider: AiProviderType;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    latencyMs: number;
    isLocalOnPremise: boolean;
    isFallback: boolean;
  }): void {
    this.stats.successfulRequests++;
    if (params.isFallback) {
      this.stats.fallbackRequests++;
    }
    this.stats.totalPromptTokens += params.promptTokens;
    this.stats.totalCompletionTokens += params.completionTokens;
    this.stats.totalEstimatedCostUsd += params.estimatedCostUsd;

    // Moving average latency
    this.stats.averageLatencyMs =
      this.stats.averageLatencyMs === 0
        ? params.latencyMs
        : Math.round((this.stats.averageLatencyMs * 0.9 + params.latencyMs * 0.1) * 10) / 10;

    const pb = this.stats.providerBreakdown[params.provider];
    if (pb) {
      pb.requests++;
      pb.totalTokens += params.totalTokens;
      pb.totalCostUsd += params.estimatedCostUsd;
      pb.avgLatencyMs =
        pb.avgLatencyMs === 0
          ? params.latencyMs
          : Math.round((pb.avgLatencyMs * 0.9 + params.latencyMs * 0.1) * 10) / 10;
    }

    const record: AiObservabilityRecord = {
      id: `ai-obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      traceId: params.traceId,
      timestamp: new Date().toISOString(),
      tenantId: params.tenantId,
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      status: params.isFallback ? "FALLBACK" : "SUCCESS",
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      estimatedCostUsd: params.estimatedCostUsd,
      latencyMs: params.latencyMs,
      isLocalOnPremise: params.isLocalOnPremise,
    };

    this.pushObservabilityRecord(record);
  }

  private recordFailureTelemetry(params: {
    traceId: string;
    tenantId: string;
    userId: string;
    provider: AiProviderType;
    model: string;
    latencyMs: number;
    isLocalOnPremise: boolean;
    errorMessage: string;
  }): void {
    const pb = this.stats.providerBreakdown[params.provider];
    if (pb) {
      pb.failures++;
    }

    const record: AiObservabilityRecord = {
      id: `ai-obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      traceId: params.traceId,
      timestamp: new Date().toISOString(),
      tenantId: params.tenantId,
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      status: "FAILED",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: params.latencyMs,
      isLocalOnPremise: params.isLocalOnPremise,
      errorMessage: params.errorMessage,
    };

    this.pushObservabilityRecord(record);
  }

  private pushObservabilityRecord(record: AiObservabilityRecord): void {
    this.observabilityRecords.unshift(record);
    if (this.observabilityRecords.length > this.maxRecordHistory) {
      this.observabilityRecords.length = this.maxRecordHistory;
    }
  }

  public getStats(): AiGatewayStats {
    return JSON.parse(JSON.stringify(this.stats));
  }

  public getRecentRecords(limit = 50): AiObservabilityRecord[] {
    return this.observabilityRecords.slice(0, Math.min(limit, this.maxRecordHistory));
  }

  /**
   * Prometheus / OpenMetrics Exposition Format (OpenMetrics v0.0.4)
   */
  public exportPrometheusMetrics(): string {
    const lines: string[] = [
      "# HELP bioazucar_ai_requests_total Total number of AI completions processed by provider and status",
      "# TYPE bioazucar_ai_requests_total counter",
    ];

    for (const [provider, pStats] of Object.entries(this.stats.providerBreakdown)) {
      lines.push(
        `bioazucar_ai_requests_total{provider="${provider}",status="success"} ${pStats.requests}`
      );
      lines.push(
        `bioazucar_ai_requests_total{provider="${provider}",status="failure"} ${pStats.failures}`
      );
    }

    lines.push(
      "",
      "# HELP bioazucar_ai_tokens_total Total tokens consumed by provider",
      "# TYPE bioazucar_ai_tokens_total counter"
    );
    for (const [provider, pStats] of Object.entries(this.stats.providerBreakdown)) {
      lines.push(
        `bioazucar_ai_tokens_total{provider="${provider}"} ${pStats.totalTokens}`
      );
    }

    lines.push(
      "",
      "# HELP bioazucar_ai_estimated_cost_usd_total Estimated cost in USD across providers",
      "# TYPE bioazucar_ai_estimated_cost_usd_total counter"
    );
    for (const [provider, pStats] of Object.entries(this.stats.providerBreakdown)) {
      lines.push(
        `bioazucar_ai_estimated_cost_usd_total{provider="${provider}"} ${pStats.totalCostUsd.toFixed(6)}`
      );
    }

    lines.push(
      "",
      "# HELP bioazucar_ai_latency_ms Moving average latency per provider in milliseconds",
      "# TYPE bioazucar_ai_latency_ms gauge"
    );
    for (const [provider, pStats] of Object.entries(this.stats.providerBreakdown)) {
      lines.push(
        `bioazucar_ai_latency_ms{provider="${provider}"} ${pStats.avgLatencyMs}`
      );
    }

    return lines.join("\n") + "\n";
  }
}
