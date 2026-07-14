import type { ModelProvider } from "../types.js";
import { createOpenAICompatibleProvider } from "./openaiCompatible.js";

export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
export const DEFAULT_OLLAMA_MODEL = "qwen2.5-coder:7b";

const MODEL_ALIASES: Record<string, string> = {
  qwen: DEFAULT_OLLAMA_MODEL,
  "qwen-coder": DEFAULT_OLLAMA_MODEL,
  coder: DEFAULT_OLLAMA_MODEL,
};

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

export function resolveOllamaModel(model: string): string {
  return MODEL_ALIASES[model.toLowerCase()] ?? model;
}

export function ollamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
}

export function ollamaRootUrl(baseUrl = ollamaBaseUrl()): string {
  return normalizeBaseUrl(baseUrl).replace(/\/v1$/, "");
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function createOllamaProvider(): ModelProvider {
  return createOpenAICompatibleProvider({
    baseUrl: ollamaBaseUrl(),
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    requireApiKey: false,
  });
}

export async function checkOllamaSetup(model: string): Promise<void> {
  const resolvedModel = resolveOllamaModel(model);
  const root = ollamaRootUrl();

  let response: Response;
  try {
    response = await fetch(`${root}/api/tags`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "connection failed";
    throw new Error(
      `Ollama is not reachable at ${root} (${message}). Start it with: ollama serve`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Ollama tags check failed (${response.status}). Is ollama serve running?`,
    );
  }

  const payload = (await response.json()) as OllamaTagsResponse;
  const names = (payload.models ?? [])
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));

  const hasModel = names.some(
    (name) =>
      name === resolvedModel ||
      name.startsWith(`${resolvedModel}:`) ||
      name.split(":")[0] === resolvedModel.split(":")[0],
  );

  if (!hasModel) {
    throw new Error(
      `Ollama model not found: ${resolvedModel}. Pull it with: ollama pull ${resolvedModel}`,
    );
  }
}
