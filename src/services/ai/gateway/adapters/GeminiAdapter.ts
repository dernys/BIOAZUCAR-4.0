import { GoogleGenAI } from "@google/genai";
import {
  AiGatewayRequest,
  AiModelConfig,
  AiGatewayResponse,
  IAiProviderAdapter,
} from "../types.js";

export class GeminiAdapter implements IAiProviderAdapter {
  readonly provider = "gemini" as const;
  private client: GoogleGenAI | null = null;
  private cachedApiKey: string | null = null;

  private getClient(apiKey?: string): GoogleGenAI {
    const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
    if (!effectiveKey) {
      throw new Error("GEMINI_API_KEY is not configured in server environment");
    }
    if (!this.client || this.cachedApiKey !== effectiveKey) {
      this.client = new GoogleGenAI({ apiKey: effectiveKey });
      this.cachedApiKey = effectiveKey;
    }
    return this.client;
  }

  isConfigured(config: AiModelConfig): boolean {
    return Boolean(config.apiKey || process.env.GEMINI_API_KEY);
  }

  async generateCompletion(
    request: AiGatewayRequest,
    config: AiModelConfig
  ): Promise<Omit<AiGatewayResponse, "traceId" | "isFallback" | "fallbackReason">> {
    const startTime = Date.now();
    const ai = this.getClient(config.apiKey);
    const model = config.model || "gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model,
      contents: request.prompt,
      config: {
        responseMimeType: request.responseFormat === "json" ? "application/json" : undefined,
        systemInstruction: request.systemInstruction,
        temperature: config.temperature ?? 0.2,
        maxOutputTokens: config.maxOutputTokens ?? 2048,
      },
    });

    const latencyMs = Math.max(1, Date.now() - startTime);
    const text = response.text || "";

    // Extract real usage metadata or approximate based on token heuristics (4 chars/token)
    const usageMetadata = response.usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount ?? Math.ceil((request.prompt.length + (request.systemInstruction?.length || 0)) / 4);
    const completionTokens = usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);
    const totalTokens = promptTokens + completionTokens;

    const estimatedCostUsd =
      (promptTokens / 1000) * config.costPer1kInputTokensUsd +
      (completionTokens / 1000) * config.costPer1kOutputTokensUsd;

    let parsedJson: Record<string, any> | undefined;
    if (request.responseFormat === "json") {
      try {
        parsedJson = JSON.parse(text);
      } catch {
        parsedJson = undefined;
      }
    }

    return {
      text,
      parsedJson,
      provider: "gemini",
      model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
      },
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }
}
