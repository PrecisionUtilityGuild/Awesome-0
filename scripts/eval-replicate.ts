import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRepoEnv } from "../packages/awesome-o-codebench/src/loadEnv.js";
import {
  defaultRunConfig,
  paths,
} from "../packages/awesome-o-codebench/src/config.js";
import {
  buildBenchmarkReport,
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

const variants = [
  "baseline",
  "concise-control",
  "careful-control",
  "awesome-o",
] as const;

const defaultTasks = join(paths.packageRoot, "tasks", "cpp", "realistic.jsonl");

const models = (process.env.EVAL_MODELS ?? "haiku,sonnet")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const evalPrefix = process.env.EVAL_PREFIX ?? "realistic";
const tasksPath = process.env.EVAL_TASKS ?? defaultTasks;
const runCount = process.env.REP_COUNT
  ? parseInt(process.env.REP_COUNT, 10)
  : 2;
const includeHiddenTests =
  process.env.EVAL_HIDDEN_TESTS !== "0" &&
  process.env.EVAL_HIDDEN_TESTS !== "false";

function fail(message: string): never {
  console.error(`eval:replicate FAIL: ${message}`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  fail("ANTHROPIC_API_KEY is not set.");
}

async function runReplication(
  model: string,
  rep: number,
): Promise<ModelBenchmarkReport> {
  const suffix = `-rep${rep}`;
  const byVariant = new Map<PromptVariant, CaseResult[]>();

  console.log(`\n######## ${model} replication ${rep}/${runCount} ########`);

  for (const variant of variants) {
    const output = join(
      paths.resultsDir,
      `${evalPrefix}-${model}-${variant}${suffix}.jsonl`,
    );

    const { results } = await runSuite(
      defaultRunConfig({
        provider: "anthropic",
        variant,
        model,
        tasksPath,
        outputPath: output,
        includeHiddenTests,
      }),
    );

    byVariant.set(variant, results);

    if (variant === "awesome-o") {
      const compilePass = results.filter((r) => r.compile.ok).length;
      const meanRbr =
        results.reduce((sum, r) => sum + r.scores.rbrCase, 0) / results.length;
      console.log(
        `  awesome-o: compile=${compilePass}/${results.length} meanRBR=${meanRbr.toFixed(3)}`,
      );
    }
  }

  return { model, report: buildBenchmarkReport(byVariant) };
}

async function main(): Promise<void> {
  console.log(
    `Realistic eval replication: ${runCount} runs × ${models.length} models × ${variants.length} variants`,
  );
  console.log(`Tasks: ${tasksPath}`);

  const byModel = new Map<string, ModelBenchmarkReport[]>();

  for (const model of models) {
    const reports: ModelBenchmarkReport[] = [];
    for (let rep = 1; rep <= runCount; rep++) {
      reports.push(await runReplication(model, rep));
    }
    byModel.set(model, reports);
  }

  for (const [model, reports] of byModel) {
    console.log(`\n=== ${model} stability (awesome-o, ${runCount} runs) ===`);
    console.log(
      `${"run".padEnd(6)} ${"RBR".padStart(6)} ${"compile".padStart(8)} ${"execGates".padStart(10)}`,
    );
    for (const [index, entry] of reports.entries()) {
      const awesome = entry.report.variants.find(
        (v) => v.variant === "awesome-o",
      );
      console.log(
        `${String(index + 1).padEnd(6)} ${(awesome?.summary.meanRbr ?? 0).toFixed(3).padStart(6)} ${`${Math.round((awesome?.summary.compilePassRate ?? 0) * 100)}%`.padStart(8)} ${(entry.report.executionGatesPass ? "PASS" : "FAIL").padStart(10)}`,
      );
    }
  }

  const latestByModel = [...byModel.entries()].map(([model, reports]) => ({
    model,
    report: reports[reports.length - 1]!.report,
  }));

  console.log(
    `\n${formatMultiModelReport(latestByModel, "latest replication (awesome-o)")}`,
  );

  const stable = [...byModel.values()].every((reports) =>
    reports.every((entry) => entry.report.executionGatesPass),
  );
  if (!stable) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
