import type { CompletionResult, ModelProvider } from "../types.js";

const ANTHROPIC_VERSION = "2023-06-01";

const MODEL_ALIASES: Record<string, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20250929",
};

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: {
    type?: string;
    message?: string;
  };
}

export function resolveAnthropicModel(model: string): string {
  return MODEL_ALIASES[model.toLowerCase()] ?? model;
}

export function createAnthropicProvider(options?: {
  apiKey?: string;
  baseUrl?: string;
}): ModelProvider {
  const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for --provider anthropic (set in env or .env)",
    );
  }

  const baseUrl =
    options?.baseUrl ??
    process.env.ANTHROPIC_API_BASE ??
    "https://api.anthropic.com";

  return {
    async complete(input): Promise<CompletionResult> {
      const start = Date.now();
      const model = resolveAnthropicModel(input.model);
      const maxTokens = Math.max(1, input.maxOutputTokens ?? 256);

      const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: input.user }],
        temperature: input.temperature ?? 0,
      };

      if (input.system) {
        body.system = input.system;
      }

      const send = () =>
        fetch(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        });

      let response = await send();
      let payload = (await response.json()) as AnthropicResponse;

      // Claude 5 models reject `temperature`; retry once without it.
      if (
        response.status === 400 &&
        "temperature" in body &&
        (payload.error?.message ?? "").includes("temperature")
      ) {
        delete body.temperature;
        response = await send();
        payload = (await response.json()) as AnthropicResponse;
      }
      if (!response.ok) {
        const detail =
          payload.error?.message ?? JSON.stringify(payload).slice(0, 500);
        throw new Error(`Anthropic API ${response.status}: ${detail}`);
      }

      const text = (payload.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      const inputTokens = payload.usage?.input_tokens ?? 0;
      const outputTokens = payload.usage?.output_tokens ?? 0;

      return {
        text,
        latencyMs: Date.now() - start,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cachedTokens: payload.usage?.cache_read_input_tokens ?? 0,
          reasoningTokens: 0,
          source: "provider",
        },
      };
    },
  };
}
