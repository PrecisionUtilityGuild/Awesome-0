import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRepoEnv } from "../packages/awesome-o-codebench/src/loadEnv.js";
import {
  defaultRunConfig,
  paths,
} from "../packages/awesome-o-codebench/src/config.js";
import {
  buildBenchmarkReport,
  formatBenchmarkReport,
  formatMultiModelReport,
  type ModelBenchmarkReport,
} from "../packages/awesome-o-codebench/src/metrics/benchmarkReport.js";
import { runSuite } from "../packages/awesome-o-codebench/src/runner/runSuite.js";
import type {
  CaseResult,
  PromptVariant,
} from "../packages/awesome-o-codebench/src/types.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
loadRepoEnv(repoRoot);

// careful-long is the length-matched control: it lets us refute "Awesome/O only
// wins because its prompt is longer." Override with EVAL_VARIANTS (comma list) to
// run a subset, e.g. EVAL_VARIANTS=careful-control,awesome-o for a fast A/B.
const ALL_VARIANTS = [
  "baseline",
  "concise-control",
  "careful-control",
  "careful-long",
  "awesome-o",
] as const satisfies readonly PromptVariant[];

const variants = (
  process.env.EVAL_VARIANTS
    ? process.env.EVAL_VARIANTS.split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : ALL_VARIANTS
) as readonly PromptVariant[];

const defaultTasks = join(paths.packageRoot, "tasks", "cpp", "realistic.jsonl");

const models = (process.env.EVAL_MODELS ?? "haiku,sonnet")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const evalPrefix = process.env.EVAL_PREFIX ?? "realistic";
const tasksPath = process.env.EVAL_TASKS ?? defaultTasks;
const includeHiddenTests =
  process.env.EVAL_HIDDEN_TESTS !== "0" &&
  process.env.EVAL_HIDDEN_TESTS !== "false";
const maxOutputTokens = process.env.EVAL_MAX_OUTPUT_TOKENS
  ? parseInt(process.env.EVAL_MAX_OUTPUT_TOKENS, 10)
  : undefined;

function fail(message: string): never {
  console.error(`eval:anthropic FAIL: ${message}`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  fail("ANTHROPIC_API_KEY is not set.");
}

if (models.length === 0) {
  fail("EVAL_MODELS must list at least one model alias.");
}

async function runVariant(
  model: string,
  variant: (typeof variants)[number],
): Promise<CaseResult[]> {
  const output = join(
    paths.resultsDir,
    `${evalPrefix}-${model}-${variant}.jsonl`,
  );

  const { results } = await runSuite(
    defaultRunConfig({
      provider: "anthropic",
      variant,
      model,
      tasksPath,
      outputPath: output,
      includeHiddenTests,
      maxOutputTokens,
    }),
  );

  return results;
}

async function evalModel(model: string): Promise<ModelBenchmarkReport> {
  console.log(`\n######## model: ${model} ########`);

  const byVariant = new Map<PromptVariant, CaseResult[]>();

  for (const variant of variants) {
    console.log(`\n=== ${model} / ${variant} ===`);
    const results = await runVariant(model, variant);

    for (const result of results) {
      console.log(
        `  ${result.caseId.padEnd(36)} RBR=${result.scores.rbrCase.toFixed(3)} compile=${result.compile.ok ? "ok" : "fail"} out=${result.usage.outputTokens ?? 0}`,
      );
    }

    byVariant.set(variant, results);
  }

  const report = buildBenchmarkReport(byVariant);
  console.log(`\n${formatBenchmarkReport(report)}`);

  return { model, report };
}

async function main(): Promise<void> {
  console.log(
    `Awesome/O realistic eval: ${tasksPath}\n` +
      `Models: ${models.join(", ")} | Variants: ${variants.join(", ")}` +
      (includeHiddenTests ? " | hidden tests: on" : " | hidden tests: off") +
      (maxOutputTokens ? ` | max_output_tokens=${maxOutputTokens}` : ""),
  );

  const modelReports: ModelBenchmarkReport[] = [];
  for (const model of models) {
    modelReports.push(await evalModel(model));
  }

  console.log(`\n${formatMultiModelReport(modelReports)}`);
  console.log(
    `\nResults: ${paths.resultsDir}/${evalPrefix}-{model}-{variant}.jsonl`,
  );

  const allPass = modelReports.every(
    (entry) => entry.report.executionGatesPass,
  );
  if (!allPass) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
