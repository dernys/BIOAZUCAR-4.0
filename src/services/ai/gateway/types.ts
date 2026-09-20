/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — AI MODEL GATEWAY TYPES & SCHEMAS
 * Estándar: IEC 62443-3-3 / ISA-95 L3/L4 Industrial AI Architecture
 * Referencia: [P0-08] AI MODEL GATEWAY MULTI-PROVEEDOR & OBSERVABILIDAD
 * ============================================================================
 */

export type AiProviderType =
  | "gemini"
  | "openai"
  | "anthropic"
  | "azure_openai"
  | "ollama"
  | "mock";

export interface AiModelConfig {
  provider: AiProviderType;
  model: string;
  endpointUrl?: string;
  apiKey?: string;
  apiVersion?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  costPer1kInputTokensUsd: number;
  costPer1kOutputTokensUsd: number;
  isLocalOnPremise?: boolean;
}

export interface AiGatewayRequest {
  prompt: string;
  systemInstruction?: string;
  responseFormat?: "text" | "json";
  context?: {
    currentModule?: string;
    roles?: string[];
    tenantId?: string;
    userId?: string;
    plantKpis?: Record<string, number | string>;
  };
  traceId?: string;
  tenantId?: string;
  userId?: string;
  preferredProvider?: AiProviderType;
}

export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiGatewayResponse {
  text: string;
  parsedJson?: Record<string, any>;
  provider: AiProviderType;
  model: string;
  usage: AiTokenUsage;
  latencyMs: number;
  timestamp: string;
  traceId: string;
  isFallback: boolean;
  fallbackReason?: string;
}

export interface AiObservabilityRecord {
  id: string;
  traceId: string;
  timestamp: string;
  tenantId: string;
  userId: string;
  provider: AiProviderType;
  model: string;
  status: "SUCCESS" | "FAILED" | "FALLBACK";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  isLocalOnPremise: boolean;
  errorMessage?: string;
}

export interface AiGatewayStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalEstimatedCostUsd: number;
  averageLatencyMs: number;
  providerBreakdown: Record<
    AiProviderType,
    {
      requests: number;
      failures: number;
      totalTokens: number;
      totalCostUsd: number;
      avgLatencyMs: number;
    }
  >;
}

export interface IAiProviderAdapter {
  readonly provider: AiProviderType;
  generateCompletion(
    request: AiGatewayRequest,
    config: AiModelConfig
  ): Promise<Omit<AiGatewayResponse, "traceId" | "isFallback" | "fallbackReason">>;
  isConfigured(config: AiModelConfig): boolean;
}
