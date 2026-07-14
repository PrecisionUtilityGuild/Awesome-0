import { Command } from "commander";
import { resolve } from "node:path";

import { defaultRunConfig, paths } from "./config.js";
import type { BenchProvider } from "./config.js";
import { loadRepoEnv } from "./loadEnv.js";
import { resolveAnthropicModel } from "./providers/anthropicProvider.js";
import {
  DEFAULT_OLLAMA_MODEL,
  checkOllamaSetup,
  resolveOllamaModel,
} from "./providers/ollamaProvider.js";
import { runSuite } from "./runner/runSuite.js";
import type { PromptVariant } from "./types.js";
import packageJson from "../package.json" with { type: "json" };

const repoRoot = paths.repoRoot;
loadRepoEnv(repoRoot);

const VARIANTS: PromptVariant[] = [
  "baseline",
  "concise-control",
  "careful-control",
  "awesome-o",
  "emotion-control",
];

const PROVIDERS: BenchProvider[] = ["mock", "ollama", "openai", "anthropic"];

function defaultModelForProvider(provider: BenchProvider): string {
  switch (provider) {
    case "anthropic":
      return "haiku";
    case "ollama":
      return DEFAULT_OLLAMA_MODEL;
    case "mock":
      return "mock-model";
    case "openai":
      return "gpt-4o-mini";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

function resolveModel(provider: BenchProvider, model: string): string {
  if (model !== "mock-model") {
    if (provider === "anthropic") {
      return resolveAnthropicModel(model);
    }
    if (provider === "ollama") {
      return resolveOllamaModel(model);
    }
    return model;
  }
  return defaultModelForProvider(provider);
}

const program = new Command();

program
  .name("awesome-o-codebench")
  .description("Awesome/O C++ code-generation benchmark harness")
  .version(packageJson.version);

program
  .command("run")
  .description("Run benchmark cases through provider, sandbox, and scoring")
  .option(
    "--provider <name>",
    "model provider (mock|ollama|openai|anthropic)",
    "mock",
  )
  .option("--variant <name>", "prompt variant", "baseline")
  .option(
    "--model <name>",
    "model id or alias (ollama: qwen-coder|full tag; anthropic: haiku|sonnet)",
    "mock-model",
  )
  .option("--tasks <path>", "JSONL task file", paths.defaultTasksFile)
  .option("--output <path>", "JSONL results path", paths.defaultOutput)
  .option("--case <id>", "run a single case id")
  .option("--hidden-tests", "include hidden tests", false)
  .option("--temperature <n>", "sampling temperature", parseFloat)
  .option("--seed <n>", "sampling seed", (value) => parseInt(value, 10))
  .option(
    "--max-output-tokens <n>",
    "override task max_output_tokens (pilot/debug)",
    (value) => parseInt(value, 10),
  )
  .action(async (options) => {
    const provider = options.provider as BenchProvider;
    if (!PROVIDERS.includes(provider)) {
      throw new Error(
        `unknown provider: ${options.provider} (expected ${PROVIDERS.join("|")})`,
      );
    }

    const variant = options.variant as PromptVariant;
    if (!VARIANTS.includes(variant)) {
      throw new Error(`unknown variant: ${options.variant}`);
    }

    const model = resolveModel(provider, options.model);

    const config = defaultRunConfig({
      provider,
      variant,
      model,
      tasksPath: resolve(options.tasks),
      outputPath: resolve(options.output),
      caseId: options.case,
      includeHiddenTests: Boolean(options.hiddenTests),
      temperature: options.temperature,
      seed: options.seed,
      maxOutputTokens: options.maxOutputTokens,
    });

    if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Export it or add it to a .env file in the repo root.",
      );
    }

    if (provider === "openai" && !process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set. Export it or add it to a .env file in the repo root.",
      );
    }

    if (provider === "ollama") {
      await checkOllamaSetup(model);
    }

    console.log(
      `Running ${config.caseId ?? "all cases"} [${variant}] via ${provider}/${model}`,
    );

    const { summary, outputPath, results } = await runSuite(config);

    let totalTokens = 0;
    for (const result of results) {
      totalTokens += result.usage.totalTokens ?? 0;
      console.log(
        `${result.caseId} [${result.variant}] RBR=${result.scores.rbrCase.toFixed(3)} CPT_out=${result.scores.cptOutputCase.toFixed(3)} CPT_tot=${result.scores.cptCase.toFixed(3)} compile=${result.compile.ok ? "ok" : "fail"} tokens=${result.usage.totalTokens ?? 0}`,
      );
    }

    console.log(
      `Wrote ${results.length} result(s) to ${outputPath} (mean RBR=${summary.meanRbr.toFixed(3)}, mean CPT_out=${summary.meanCptOutput.toFixed(3)}, mean CPT_tot=${summary.meanCpt.toFixed(3)}, total tokens=${totalTokens})`,
    );
  });

program.parse();
