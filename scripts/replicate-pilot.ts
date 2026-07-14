import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRepoEnv } from "../packages/awesome-o-codebench/src/loadEnv.js";
import {
  defaultRunConfig,
  paths,
} from "../packages/awesome-o-codebench/src/config.js";
import {
  buildBenchmarkReport,
  type BenchmarkReport,
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
const runCount = process.env.REP_COUNT
  ? parseInt(process.env.REP_COUNT, 10)
  : 3;

function fail(message: string): never {
  console.error(`replicate-pilot FAIL: ${message}`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  fail("ANTHROPIC_API_KEY is not set.");
}

async function runReplication(rep: number): Promise<BenchmarkReport> {
  const suffix = `-rep${rep}`;
  const byVariant = new Map<PromptVariant, CaseResult[]>();

  console.log(`\n######## replication ${rep}/${runCount} ########`);

  for (const variant of variants) {
    const output = join(
      paths.resultsDir,
      `pilot-suite-${variant}${suffix}.jsonl`,
    );

    const { results } = await runSuite(
      defaultRunConfig({
        provider: "anthropic",
        variant,
        model,
        tasksPath,
        outputPath: output,
      }),
    );

    byVariant.set(variant, results);
    if (variant === "awesome-o") {
      const compilePass = results.filter((r) => r.compile.ok).length;
      const meanRbr =
        results.reduce((s, r) => s + r.scores.rbrCase, 0) / results.length;
      const formatFails = results.filter(
        (r) => r.scores.formatViolation > 0,
      ).length;
      console.log(
        `  awesome-o: compile=${compilePass}/${results.length} meanRBR=${meanRbr.toFixed(3)} formatViolations=${formatFails}`,
      );
    }
  }

  return buildBenchmarkReport(byVariant);
}

function summarizeReplications(reports: BenchmarkReport[]): void {
  console.log("\n=== replication stability (awesome-o) ===");
  console.log(
    `${"run".padEnd(6)} ${"RBR".padStart(6)} ${"CPT_out".padStart(8)} ${"compile".padStart(8)} ${"execGates".padStart(10)} ${"allGates".padStart(10)}`,
  );

  const awesomeStats = reports.map((report, index) => {
    const awesome = report.variants.find((v) => v.variant === "awesome-o");
    return {
      rep: index + 1,
      meanRbr: awesome?.summary.meanRbr ?? 0,
      meanCptOutput: awesome?.summary.meanCptOutput ?? 0,
      compilePassRate: awesome?.summary.compilePassRate ?? 0,
      executionGatesPass: report.executionGatesPass,
      allGatesPass: report.allGatesPass,
    };
  });

  for (const stat of awesomeStats) {
    console.log(
      `${String(stat.rep).padEnd(6)} ${stat.meanRbr.toFixed(3).padStart(6)} ${stat.meanCptOutput.toFixed(2).padStart(8)} ${`${Math.round(stat.compilePassRate * 100)}%`.padStart(8)} ${(stat.executionGatesPass ? "PASS" : "FAIL").padStart(10)} ${(stat.allGatesPass ? "PASS" : "FAIL").padStart(10)}`,
    );
  }

  const rbrs = awesomeStats.map((s) => s.meanRbr);
  const compiles = awesomeStats.map((s) => s.compilePassRate);
  const execPasses = awesomeStats.filter((s) => s.executionGatesPass).length;
  const allPasses = awesomeStats.filter((s) => s.allGatesPass).length;

  const meanRbr = rbrs.reduce((a, b) => a + b, 0) / rbrs.length;
  const minRbr = Math.min(...rbrs);
  const maxRbr = Math.max(...rbrs);

  console.log("");
  console.log(
    `RBR range: ${minRbr.toFixed(3)} – ${maxRbr.toFixed(3)} (mean ${meanRbr.toFixed(3)})`,
  );
  console.log(
    `Compile pass rate range: ${(Math.min(...compiles) * 100).toFixed(0)}% – ${(Math.max(...compiles) * 100).toFixed(0)}%`,
  );
  console.log(`Execution gates: ${execPasses}/${reports.length} runs passed`);
  console.log(`All gates: ${allPasses}/${reports.length} runs passed`);
  console.log(`Results: ${paths.resultsDir}/pilot-suite-*-rep*.jsonl`);
}

async function main(): Promise<void> {
  console.log(
    `Replication pilot: ${runCount} runs × ${variants.length} variants on anthropic/${model}`,
  );
  console.log(`Tasks: ${tasksPath}`);

  const reports: BenchmarkReport[] = [];
  for (let rep = 1; rep <= runCount; rep++) {
    reports.push(await runReplication(rep));
  }

  summarizeReplications(reports);

  const stable = reports.every((r) => r.executionGatesPass);
  if (!stable) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
