/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — REAL AI PRICING REGISTRY (IEC 62443 / ISA-95)
 * [P0-05] AI PRICING REGISTRY WITH VERSIONING & VERIFIED SOURCES
 * ============================================================================
 */

import { AiProviderType } from "../gateway/types";

export interface AiPricingTier {
  id: string;
  provider: AiProviderType;
  model: string;
  version: string;
  currency: "USD" | "EUR";
  inputPricePer1kTokens: number;
  outputPricePer1kTokens: number;
  cachedInputPricePer1kTokens?: number;
  cacheWritePricePer1kTokens?: number;
  reasoningPricePer1kTokens?: number;
  audioInputPricePerMinute?: number;
  audioOutputPricePerMinute?: number;
  imagePricePerImage?: number;
  toolCallPricePerCall?: number;
  pricingSource: string;
  sourceUrl: string;
  isVerified: boolean;
  verifiedAt: string;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
}

export const INITIAL_PRICING_CATALOG: AiPricingTier[] = [
  {
    id: "pricing-gemini-2.5-flash-v2026",
    provider: "gemini",
    model: "gemini-2.5-flash",
    version: "2026.03",
    currency: "USD",
    inputPricePer1kTokens: 0.000075, // $0.075 per 1M tokens
    outputPricePer1kTokens: 0.0003,   // $0.30 per 1M tokens
    cachedInputPricePer1kTokens: 0.00001875,
    cacheWritePricePer1kTokens: 0.000075,
    audioInputPricePerMinute: 0.00002,
    imagePricePerImage: 0.00002,
    pricingSource: "Google AI Studio Official Documentation & Pricing API",
    sourceUrl: "https://ai.google.dev/pricing",
    isVerified: true,
    verifiedAt: "2026-03-15T00:00:00Z",
    effectiveFrom: "2025-01-01T00:00:00Z",
    notes: "Default industrial operational model for SCADA & Copilot summarization",
  },
  {
    id: "pricing-gemini-1.5-pro-v2026",
    provider: "gemini",
    model: "gemini-1.5-pro",
    version: "2026.01",
    currency: "USD",
    inputPricePer1kTokens: 0.00125, // $1.25 per 1M tokens (<128k)
    outputPricePer1kTokens: 0.005,   // $5.00 per 1M tokens
    cachedInputPricePer1kTokens: 0.0003125,
    pricingSource: "Google Cloud Vertex AI & Gemini Official Pricing",
    sourceUrl: "https://cloud.google.com/vertex-ai/generative-ai/pricing",
    isVerified: true,
    verifiedAt: "2026-01-10T00:00:00Z",
    effectiveFrom: "2024-09-01T00:00:00Z",
    notes: "High reasoning capacity for root cause analysis (RCA)",
  },
  {
    id: "pricing-openai-gpt-4o-mini-v2025",
    provider: "openai",
    model: "gpt-4o-mini",
    version: "2025.12",
    currency: "USD",
    inputPricePer1kTokens: 0.00015, // $0.15 per 1M
    outputPricePer1kTokens: 0.0006,  // $0.60 per 1M
    cachedInputPricePer1kTokens: 0.000075,
    pricingSource: "OpenAI Pricing Schedule Official Documentation",
    sourceUrl: "https://openai.com/api/pricing/",
    isVerified: true,
    verifiedAt: "2025-12-01T00:00:00Z",
    effectiveFrom: "2024-07-18T00:00:00Z",
  },
  {
    id: "pricing-openai-gpt-4o-v2025",
    provider: "openai",
    model: "gpt-4o",
    version: "2025.10",
    currency: "USD",
    inputPricePer1kTokens: 0.0025,
    outputPricePer1kTokens: 0.010,
    cachedInputPricePer1kTokens: 0.00125,
    pricingSource: "OpenAI Pricing Schedule Official Documentation",
    sourceUrl: "https://openai.com/api/pricing/",
    isVerified: true,
    verifiedAt: "2025-10-15T00:00:00Z",
    effectiveFrom: "2024-05-13T00:00:00Z",
  },
  {
    id: "pricing-anthropic-claude-3-5-sonnet-v2025",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    version: "2025.11",
    currency: "USD",
    inputPricePer1kTokens: 0.003,
    outputPricePer1kTokens: 0.015,
    cachedInputPricePer1kTokens: 0.0003,
    cacheWritePricePer1kTokens: 0.00375,
    pricingSource: "Anthropic API Commercial Documentation",
    sourceUrl: "https://www.anthropic.com/pricing",
    isVerified: true,
    verifiedAt: "2025-11-20T00:00:00Z",
    effectiveFrom: "2024-10-22T00:00:00Z",
  },
  {
    id: "pricing-azure-openai-gpt-4o-v2025",
    provider: "azure_openai",
    model: "gpt-4o",
    version: "2025.09",
    currency: "USD",
    inputPricePer1kTokens: 0.0025,
    outputPricePer1kTokens: 0.010,
    pricingSource: "Microsoft Azure Cognitive Services Pricing",
    sourceUrl: "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/",
    isVerified: true,
    verifiedAt: "2025-09-01T00:00:00Z",
    effectiveFrom: "2024-06-01T00:00:00Z",
  },
  {
    id: "pricing-ollama-local-llama32",
    provider: "ollama",
    model: "llama3.2",
    version: "2026.01",
    currency: "USD",
    inputPricePer1kTokens: 0.0,
    outputPricePer1kTokens: 0.0,
    pricingSource: "On-Premises Industrial Edge Compute (Local Infrastructure)",
    sourceUrl: "https://ollama.com/library/llama3.2",
    isVerified: true,
    verifiedAt: "2026-01-01T00:00:00Z",
    effectiveFrom: "2024-09-25T00:00:00Z",
    notes: "API license is $0. Operational electrical cost modeled in LocalAiComputeModel",
  },
  {
    id: "pricing-mock-deterministic",
    provider: "mock",
    model: "mock-industrial-v1",
    version: "2026.01",
    currency: "USD",
    inputPricePer1kTokens: 0.0,
    outputPricePer1kTokens: 0.0,
    pricingSource: "Deterministic Simulation Unit Test Harness",
    sourceUrl: "internal://mock-pricing",
    isVerified: true,
    verifiedAt: "2026-01-01T00:00:00Z",
    effectiveFrom: "2024-01-01T00:00:00Z",
  },
];

export class AiPricingRegistry {
  private static instance: AiPricingRegistry | null = null;
  private pricingTiers = new Map<string, AiPricingTier>();

  private constructor() {
    for (const tier of INITIAL_PRICING_CATALOG) {
      this.pricingTiers.set(this.buildKey(tier.provider, tier.model), tier);
    }
  }

  public static getInstance(): AiPricingRegistry {
    if (!AiPricingRegistry.instance) {
      AiPricingRegistry.instance = new AiPricingRegistry();
    }
    return AiPricingRegistry.instance;
  }

  private buildKey(provider: string, model: string): string {
    return `${provider.toLowerCase()}::${model.toLowerCase()}`;
  }

  public getAllTiers(): AiPricingTier[] {
    return Array.from(this.pricingTiers.values());
  }

  public getPricingTier(provider: AiProviderType, model: string): AiPricingTier {
    const key = this.buildKey(provider, model);
    const existing = this.pricingTiers.get(key);
    if (existing) {
      return existing;
    }

    // If not found in registry, return unverified fail-safe tier
    return {
      id: `pricing-unverified-${provider}-${model}`,
      provider,
      model,
      version: "UNVERIFIED",
      currency: "USD",
      inputPricePer1kTokens: 0.001,
      outputPricePer1kTokens: 0.003,
      pricingSource: "PRICE_UNVERIFIED",
      sourceUrl: "",
      isVerified: false,
      verifiedAt: new Date().toISOString(),
      effectiveFrom: new Date().toISOString(),
      notes: "Auto-generated unverified placeholder. Please verify rates from official vendor schedule.",
    };
  }

  public registerTier(tier: AiPricingTier): void {
    if (!tier.pricingSource || tier.pricingSource.trim() === "") {
      tier.pricingSource = "PRICE_UNVERIFIED";
      tier.isVerified = false;
    }
    this.pricingTiers.set(this.buildKey(tier.provider, tier.model), tier);
  }

  public calculateCost(params: {
    provider: AiProviderType;
    model: string;
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    toolCallsCount?: number;
  }): {
    estimatedCostUsd: number;
    breakdown: {
      inputCost: number;
      outputCost: number;
      cachedInputCost: number;
      reasoningCost: number;
      toolCallCost: number;
    };
    isVerified: boolean;
    pricingSource: string;
  } {
    const tier = this.getPricingTier(params.provider, params.model);

    const normalInputTokens = Math.max(0, params.promptTokens - (params.cachedTokens || 0));
    const cachedTokens = params.cachedTokens || 0;
    const completionTokens = params.completionTokens;
    const reasoningTokens = params.reasoningTokens || 0;
    const toolCalls = params.toolCallsCount || 0;

    const inputCost = (normalInputTokens / 1000) * tier.inputPricePer1kTokens;
    const cachedInputCost = tier.cachedInputPricePer1kTokens
      ? (cachedTokens / 1000) * tier.cachedInputPricePer1kTokens
      : (cachedTokens / 1000) * (tier.inputPricePer1kTokens * 0.5);

    const outputCost = (completionTokens / 1000) * tier.outputPricePer1kTokens;
    const reasoningCost = tier.reasoningPricePer1kTokens
      ? (reasoningTokens / 1000) * tier.reasoningPricePer1kTokens
      : 0;
    const toolCallCost = tier.toolCallPricePerCall
      ? toolCalls * tier.toolCallPricePerCall
      : 0;

    const total = inputCost + cachedInputCost + outputCost + reasoningCost + toolCallCost;

    return {
      estimatedCostUsd: Math.round(total * 1000000) / 1000000,
      breakdown: {
        inputCost: Math.round(inputCost * 1000000) / 1000000,
        outputCost: Math.round(outputCost * 1000000) / 1000000,
        cachedInputCost: Math.round(cachedInputCost * 1000000) / 1000000,
        reasoningCost: Math.round(reasoningCost * 1000000) / 1000000,
        toolCallCost: Math.round(toolCallCost * 1000000) / 1000000,
      },
      isVerified: tier.isVerified,
      pricingSource: tier.pricingSource,
    };
  }
}

export const aiPricingRegistry = AiPricingRegistry.getInstance();
