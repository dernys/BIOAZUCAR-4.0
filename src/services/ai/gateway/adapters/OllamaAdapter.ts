import {
  AiGatewayRequest,
  AiModelConfig,
  AiGatewayResponse,
  IAiProviderAdapter,
} from "../types.js";

export class OllamaAdapter implements IAiProviderAdapter {
  readonly provider = "ollama" as const;

  isConfigured(config: AiModelConfig): boolean {
    return Boolean(config.endpointUrl || process.env.OLLAMA_HOST || "http://127.0.0.1:11434");
  }

  async generateCompletion(
    request: AiGatewayRequest,
    config: AiModelConfig
  ): Promise<Omit<AiGatewayResponse, "traceId" | "isFallback" | "fallbackReason">> {
    const startTime = Date.now();
    const host =
      config.endpointUrl || process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
    const endpoint = `${host.replace(/\/+$/, "")}/api/generate`;
    const model = config.model || "llama3.2";

    const promptText = request.systemInstruction
      ? `System: ${request.systemInstruction}\n\nUser: ${request.prompt}`
      : request.prompt;

    const body: Record<string, any> = {
      model,
      prompt: promptText,
      stream: false,
      options: {
        temperature: config.temperature ?? 0.2,
        num_predict: config.maxOutputTokens ?? 2048,
      },
    };

    if (request.responseFormat === "json") {
      body.format = "json";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 30000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama Local API error [${response.status}]: ${errorText}`);
      }

      const data = await response.json();
      const latencyMs = Math.max(1, Date.now() - startTime);
      const text = data.response || "";

      const promptTokens =
        data.prompt_eval_count ??
        Math.ceil((request.prompt.length + (request.systemInstruction?.length || 0)) / 4);
      const completionTokens =
        data.eval_count ?? Math.ceil(text.length / 4);
      const totalTokens = promptTokens + completionTokens;

      // On-premise has $0 API cost
      const estimatedCostUsd = 0.0;

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
        provider: "ollama",
        model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
