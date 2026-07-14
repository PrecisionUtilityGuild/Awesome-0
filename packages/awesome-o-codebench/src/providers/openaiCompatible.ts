import { estimateTokens } from "../metrics/tokenUsage.js";
import type { CompletionResult, ModelProvider } from "../types.js";

export interface OpenAICompatibleOptions {
  baseUrl?: string;
  apiKey?: string;
  requireApiKey?: boolean;
}

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleOptions = {},
): ModelProvider {
  const requireApiKey = options.requireApiKey ?? true;
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ??
      process.env.OPENAI_BASE_URL ??
      "https://api.openai.com/v1",
  );

  if (requireApiKey && !apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for --provider openai (set in env or .env)",
    );
  }

  return {
    async complete(input): Promise<CompletionResult> {
      const start = Date.now();
      const messages: OpenAIChatMessage[] = [];

      if (input.system) {
        messages.push({ role: "system", content: input.system });
      }
      messages.push({ role: "user", content: input.user });

      const body: Record<string, unknown> = {
        model: input.model,
        messages,
        max_tokens: Math.max(1, input.maxOutputTokens ?? 256),
        temperature: input.temperature ?? 0,
        stream: false,
      };

      if (input.seed !== undefined) {
        body.seed = input.seed;
      }

      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (apiKey) {
        headers.authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as OpenAIChatResponse;
      if (!response.ok) {
        const detail =
          payload.error?.message ?? JSON.stringify(payload).slice(0, 500);
        throw new Error(`OpenAI-compatible API ${response.status}: ${detail}`);
      }

      const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
      const inputTokens = payload.usage?.prompt_tokens;
      const outputTokens = payload.usage?.completion_tokens;
      const hasProviderUsage =
        inputTokens !== undefined && outputTokens !== undefined;

      return {
        text,
        latencyMs: Date.now() - start,
        usage: hasProviderUsage
          ? {
              inputTokens,
              outputTokens,
              totalTokens:
                payload.usage?.total_tokens ?? inputTokens + outputTokens,
              cachedTokens: 0,
              reasoningTokens: 0,
              source: "provider",
            }
          : {
              inputTokens: estimateTokens(
                `${input.system ?? ""}\n${input.user}`,
              ),
              outputTokens: estimateTokens(text),
              totalTokens:
                estimateTokens(`${input.system ?? ""}\n${input.user}`) +
                estimateTokens(text),
              cachedTokens: 0,
              reasoningTokens: 0,
              source: "local_estimate",
            },
      };
    },
  };
}
