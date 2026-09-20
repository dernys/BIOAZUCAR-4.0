import {
  AiGatewayRequest,
  AiModelConfig,
  AiGatewayResponse,
  IAiProviderAdapter,
} from "../types.js";

export class MockAiAdapter implements IAiProviderAdapter {
  readonly provider = "mock" as const;

  isConfigured(_config: AiModelConfig): boolean {
    return true;
  }

  async generateCompletion(
    request: AiGatewayRequest,
    config: AiModelConfig
  ): Promise<Omit<AiGatewayResponse, "traceId" | "isFallback" | "fallbackReason">> {
    const startTime = Date.now();
    const model = config.model || "mock-industrial-v1";

    let text = "";
    let parsedJson: Record<string, any> | undefined;

    if (request.responseFormat === "json") {
      parsedJson = {
        message: "Respuesta del modelo determinista industrial local (Mock/Deterministic Mode)",
        intent: "SYSTEM_INFORMATION",
        confidence: 0.99,
        clientToolCalls: [],
        timestamp: new Date().toISOString(),
      };
      text = JSON.stringify(parsedJson);
    } else {
      text = `BioAzúcar 4.0 Mock Response: processed "${request.prompt.slice(0, 50)}..." successfully.`;
    }

    const promptTokens = Math.ceil(
      (request.prompt.length + (request.systemInstruction?.length || 0)) / 4
    );
    const completionTokens = Math.ceil(text.length / 4);
    const totalTokens = promptTokens + completionTokens;

    const estimatedCostUsd = Number(
      (
        (promptTokens / 1000) * config.costPer1kInputTokensUsd +
        (completionTokens / 1000) * config.costPer1kOutputTokensUsd
      ).toFixed(6)
    );

    return {
      text,
      parsedJson,
      provider: "mock",
      model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
      latencyMs: Math.max(1, Date.now() - startTime),
      timestamp: new Date().toISOString(),
    };
  }
}
