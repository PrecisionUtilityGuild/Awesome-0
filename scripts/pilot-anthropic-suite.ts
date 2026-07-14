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
} from "../packages/awesome-o-codebench/src/metrics/benchmarkReport.js";
import { runSuite } from "../packages/awesome-o-codebench/src/runner/runSuite.js";
import type {
  CaseResult,
  PromptVariant,
} from "../packages/awesome-o-codebench/src/types.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
loadRepoEnv(repoRoot);

const variants = [
  "baseline",
  "concise-control",
  "careful-control",
  "awesome-o",
] as const;

const model = process.env.PILOT_MODEL ?? "haiku";
const tasksPath =
  process.env.PILOT_TASKS ??
  join(paths.packageRoot, "tasks", "cpp", "pilot.jsonl");
const maxOutputTokens = process.env.PILOT_MAX_OUTPUT_TOKENS
  ? parseInt(process.env.PILOT_MAX_OUTPUT_TOKENS, 10)
  : undefined;
const outputSuffix = [
  maxOutputTokens ? `-${maxOutputTokens}tok` : "",
  process.env.PILOT_SUFFIX ?? "",
].join("");

function fail(message: string): never {
  console.error(`pilot:suite FAIL: ${message}`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  fail("ANTHROPIC_API_KEY is not set.");
}

async function runVariant(
  variant: (typeof variants)[number],
): Promise<CaseResult[]> {
  const output = join(
    paths.resultsDir,
    `pilot-suite-${variant}${outputSuffix}.jsonl`,
  );

  console.log(`\n=== ${variant} (${model}) ===`);

  const { results } = await runSuite(
    defaultRunConfig({
      provider: "anthropic",
      variant,
      model,
      tasksPath,
      outputPath: output,
      maxOutputTokens,
    }),
  );

  for (const result of results) {
    console.log(
      `  ${result.caseId.padEnd(34)} RBR=${result.scores.rbrCase.toFixed(3)} CPT_out=${result.scores.cptOutputCase.toFixed(2)} compile=${result.compile.ok ? "ok" : "fail"} out=${result.usage.outputTokens ?? 0}`,
    );
  }

  return results;
}

async function main(): Promise<void> {
  console.log(
    `Awesome/O suite pilot: ${tasksPath} × ${variants.join(", ")} on anthropic/${model}${maxOutputTokens ? ` (max_output_tokens=${maxOutputTokens})` : ""}`,
  );

  const byVariant = new Map<PromptVariant, CaseResult[]>();

  for (const variant of variants) {
    byVariant.set(variant, await runVariant(variant));
  }

  const report = buildBenchmarkReport(byVariant);
  console.log(`\n${formatBenchmarkReport(report)}`);
  console.log(
    `\nResults: ${paths.resultsDir}/pilot-suite-*${outputSuffix}.jsonl`,
  );

  if (!report.executionGatesPass) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
