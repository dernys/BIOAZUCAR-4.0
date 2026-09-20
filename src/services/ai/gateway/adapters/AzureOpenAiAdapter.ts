import {
  AiGatewayRequest,
  AiModelConfig,
  AiGatewayResponse,
  IAiProviderAdapter,
} from "../types.js";

export class AzureOpenAiAdapter implements IAiProviderAdapter {
  readonly provider = "azure_openai" as const;

  isConfigured(config: AiModelConfig): boolean {
    return Boolean((config.apiKey || process.env.AZURE_OPENAI_API_KEY) && (config.endpointUrl || process.env.AZURE_OPENAI_ENDPOINT));
  }

  async generateCompletion(
    request: AiGatewayRequest,
    config: AiModelConfig
  ): Promise<Omit<AiGatewayResponse, "traceId" | "isFallback" | "fallbackReason">> {
    const startTime = Date.now();
    const apiKey = config.apiKey || process.env.AZURE_OPENAI_API_KEY;
    const endpoint = config.endpointUrl || process.env.AZURE_OPENAI_ENDPOINT;
    if (!apiKey || !endpoint) {
      throw new Error("AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required");
    }

    const apiVersion = config.apiVersion || "2024-02-15-preview";
    const deployment = config.model || "gpt-4o";
    const fullUrl = `${endpoint.replace(/\/+$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemInstruction) {
      messages.push({ role: "system", content: request.systemInstruction });
    }
    messages.push({ role: "user", content: request.prompt });

    const body: Record<string, any> = {
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
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI error [${response.status}]: ${errorText}`);
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
        provider: "azure_openai",
        model: deployment,
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
