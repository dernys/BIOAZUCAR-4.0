import {
  AiGatewayRequest,
  AiModelConfig,
  AiGatewayResponse,
  IAiProviderAdapter,
} from "../types.js";

export class AnthropicAdapter implements IAiProviderAdapter {
  readonly provider = "anthropic" as const;

  isConfigured(config: AiModelConfig): boolean {
    return Boolean(config.apiKey || process.env.ANTHROPIC_API_KEY);
  }

  async generateCompletion(
    request: AiGatewayRequest,
    config: AiModelConfig
  ): Promise<Omit<AiGatewayResponse, "traceId" | "isFallback" | "fallbackReason">> {
    const startTime = Date.now();
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const endpoint = config.endpointUrl || "https://api.anthropic.com/v1/messages";
    const model = config.model || "claude-3-5-sonnet-20241022";

    const body: Record<string, any> = {
      model,
      max_tokens: config.maxOutputTokens ?? 2048,
      messages: [{ role: "user", content: request.prompt }],
    };

    if (request.systemInstruction) {
      body.system = request.systemInstruction;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": config.apiVersion || "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error [${response.status}]: ${errorText}`);
      }

      const data = await response.json();
      const latencyMs = Math.max(1, Date.now() - startTime);

      const text =
        data.content
          ?.filter((c: any) => c.type === "text")
          ?.map((c: any) => c.text)
          ?.join("\n") || "";

      const promptTokens =
        data.usage?.input_tokens ??
        Math.ceil((request.prompt.length + (request.systemInstruction?.length || 0)) / 4);
      const completionTokens =
        data.usage?.output_tokens ?? Math.ceil(text.length / 4);
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
        provider: "anthropic",
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
    } finally {
      clearTimeout(timeout);
    }
  }
}
