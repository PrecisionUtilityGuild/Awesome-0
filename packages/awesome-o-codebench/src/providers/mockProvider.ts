import type { BenchCase, CompletionResult, ModelProvider } from "../types.js";
import { mockResponseFor } from "../fixtures/mock-responses.js";
import { estimateTokens } from "../metrics/tokenUsage.js";

export function createMockProvider(cases: BenchCase[]): ModelProvider {
  return {
    async complete(input): Promise<CompletionResult> {
      const start = Date.now();
      const benchCase =
        cases.find((candidate) => input.user.includes(candidate.id)) ??
        cases.find((candidate) =>
          input.user.includes(candidate.prompt.slice(0, 40)),
        ) ??
        cases[0];

      const text =
        (benchCase && mockResponseFor(benchCase.id)) ??
        `// mock provider: no canned response for ${benchCase?.id ?? "unknown"}\n`;

      const inputTokens = estimateTokens(
        `${input.system ?? ""}\n${input.user}`,
      );
      const outputTokens = estimateTokens(text);

      return {
        text,
        latencyMs: Date.now() - start,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cachedTokens: 0,
          reasoningTokens: 0,
          source: "local_estimate",
        },
      };
    },
  };
}
