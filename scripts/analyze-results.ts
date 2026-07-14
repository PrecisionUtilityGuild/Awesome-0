import { readFileSync } from "node:fs";
import { join } from "node:path";

import { paths } from "../packages/awesome-o-codebench/src/config.js";
import {
  buildBenchmarkReport,
  formatBenchmarkReport,
  formatMultiModelReport,
  type ModelBenchmarkReport,
} from "../packages/awesome-o-codebench/src/metrics/benchmarkReport.js";
import type {
  CaseResult,
  PromptVariant,
} from "../packages/awesome-o-codebench/src/types.js";

const DEFAULT_VARIANTS: PromptVariant[] = [
  "baseline",
  "concise-control",
  "careful-control",
  "awesome-o",
];

function normalizeResult(raw: CaseResult): CaseResult {
  const outputTokens = raw.usage.outputTokens ?? 1;
  const quality = raw.scores.qualityCase ?? 1 - raw.scores.rbrCase;
  const cptOutputCase =
    raw.scores.cptOutputCase ?? (1000 * quality) / Math.max(outputTokens, 1);

  return {
    ...raw,
    scores: {
      rbrCase: raw.scores.rbrCase,
      qualityCase: quality,
      cptCase: raw.scores.cptCase,
      cptOutputCase,
      compileFail: raw.scores.compileFail ?? (raw.compile.ok ? 0 : 1),
      testFailRate:
        raw.scores.testFailRate ??
        (raw.compile.ok &&
        raw.execution.visiblePassed + raw.execution.hiddenPassed <
          raw.execution.visibleTotal + raw.execution.hiddenTotal
          ? 1
          : 0),
      formatViolation: raw.scores.formatViolation ?? 0,
      overengineeringPenalty: raw.scores.overengineeringPenalty ?? 0,
      sycophancyFail:
        raw.scores.sycophancyFail ?? (raw.scores.antiSycophancy < 1 ? 1 : 0),
      antiSycophancy: raw.scores.antiSycophancy,
      simplicity: raw.scores.simplicity,
    },
  };
}

function loadJsonl(path: string): CaseResult[] {
  const text = readFileSync(path, "utf8").trim();
  if (!text) {
    return [];
  }
  return text
    .split("\n")
    .map((line) => normalizeResult(JSON.parse(line) as CaseResult));
}

function fail(message: string): never {
  console.error(`analyze-results FAIL: ${message}`);
  process.exit(1);
}

function resultPath(
  prefix: string,
  model: string | undefined,
  variant: PromptVariant,
  suffix: string,
): string {
  const modelPart = model ? `-${model}` : "";
  return join(
    paths.resultsDir,
    `${prefix}${modelPart}-${variant}${suffix}.jsonl`,
  );
}

function loadVariantResults(
  prefix: string,
  model: string | undefined,
  suffix: string,
  variants: PromptVariant[],
): Map<PromptVariant, CaseResult[]> {
  const byVariant = new Map<PromptVariant, CaseResult[]>();

  for (const variant of variants) {
    const path = resultPath(prefix, model, variant, suffix);
    let results: CaseResult[];
    try {
      results = loadJsonl(path);
    } catch {
      fail(`could not read ${path}`);
    }
    if (results.length === 0) {
      fail(`no results in ${path}`);
    }
    byVariant.set(variant, results);
  }

  return byVariant;
}

function main(): void {
  const suffix = process.env.RESULT_SUFFIX ?? "";
  const prefix = process.env.RESULT_PREFIX ?? "pilot-suite";
  const modelsEnv = process.env.ANALYZE_MODELS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const variants = (process.env.ANALYZE_VARIANTS?.split(",") ??
    DEFAULT_VARIANTS) as PromptVariant[];

  if (modelsEnv && modelsEnv.length > 0) {
    const modelReports: ModelBenchmarkReport[] = [];

    for (const model of modelsEnv) {
      const byVariant = loadVariantResults(prefix, model, suffix, variants);
      const report = buildBenchmarkReport(byVariant);
      console.log(`\n######## ${model} ########\n`);
      console.log(formatBenchmarkReport(report));
      modelReports.push({ model, report });
    }

    console.log(`\n${formatMultiModelReport(modelReports)}`);

    const allPass = modelReports.every(
      (entry) => entry.report.executionGatesPass,
    );
    if (!allPass) {
      process.exitCode = 1;
    }
    return;
  }

  const byVariant = loadVariantResults(prefix, undefined, suffix, variants);
  const report = buildBenchmarkReport(byVariant);
  console.log(formatBenchmarkReport(report));

  if (!report.executionGatesPass) {
    process.exitCode = 1;
  }
}

main();
