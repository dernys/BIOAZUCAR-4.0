import {
  AiGatewayRequest,
  AiModelConfig,
  AiGatewayResponse,
  IAiProviderAdapter,
} from "../types.js";

export class OpenAiAdapter implements IAiProviderAdapter {
  readonly provider = "openai" as const;

  isConfigured(config: AiModelConfig): boolean {
    return Boolean(config.apiKey || process.env.OPENAI_API_KEY);
  }

  async generateCompletion(
    request: AiGatewayRequest,
    config: AiModelConfig
  ): Promise<Omit<AiGatewayResponse, "traceId" | "isFallback" | "fallbackReason">> {
    const startTime = Date.now();
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const endpoint = config.endpointUrl || "https://api.openai.com/v1/chat/completions";
    const model = config.model || "gpt-4o-mini";

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemInstruction) {
      messages.push({ role: "system", content: request.systemInstruction });
    }
    messages.push({ role: "user", content: request.prompt });

    const body: Record<string, any> = {
      model,
      messages,
      temperature: config.temperature ?? 0.2,
      max_tokens: config.maxOutputTokens ?? 2048,
    };

    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error [${response.status}]: ${errorText}`);
      }

      const data = await response.json();
      const latencyMs = Math.max(1, Date.now() - startTime);
      const text = data.choices?.[0]?.message?.content || "";

      const promptTokens =
        data.usage?.prompt_tokens ??
        Math.ceil((request.prompt.length + (request.systemInstruction?.length || 0)) / 4);
      const completionTokens =
        data.usage?.completion_tokens ?? Math.ceil(text.length / 4);
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
        provider: "openai",
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
