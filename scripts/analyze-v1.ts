import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  ClaimLane,
  PromptVariant,
  RunSummary,
} from "../packages/awesome-o-codebench/src/types.js";

// Defaults reproduce the v1 report exactly. A sibling corpus (e.g. holdout)
// reuses this analyzer by overriding these env vars instead of forking the file.
const RESULT_PREFIX = process.env.ANALYZE_PREFIX ?? "v1";
const CORPUS_LABEL = process.env.ANALYZE_CORPUS_LABEL ?? "v1-validation / 40";
const REPORT_TITLE =
  process.env.ANALYZE_TITLE ?? "Awesome/O v1 Validation Results";
const OUTPUT_DOC = process.env.ANALYZE_OUTPUT ?? "docs/v1-results.md";
const SUMMARY_LABEL = process.env.ANALYZE_SUMMARY_LABEL ?? "v1 summary";
const MODELS = (process.env.ANALYZE_MODELS ?? "haiku,sonnet")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
// Required variants must exist for analysis to run (they back the published gates).
const VARIANTS: PromptVariant[] = [
  "baseline",
  "concise-control",
  "careful-control",
  "awesome-o",
];
// Optional variants are loaded if their result file exists and skipped otherwise,
// so older runs still analyze. careful-long backs the length-control comparison.
const OPTIONAL_VARIANTS: PromptVariant[] = ["careful-long"];
const LANES: ClaimLane[] = [
  "plain",
  "architecture-trap",
  "operational-lie",
  "format-discipline",
  "combo-trap",
];

function fail(message: string): never {
  console.error(`analyze:v1 FAIL: ${message}`);
  process.exit(1);
}

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
      testFailRate: raw.scores.testFailRate ?? 0,
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
  let text: string;
  try {
    text = readFileSync(path, "utf8").trim();
  } catch {
    fail(`could not read ${path}`);
  }
  if (!text) {
    fail(`no results in ${path}`);
  }
  return text
    .split("\n")
    .map((line) => normalizeResult(JSON.parse(line) as CaseResult));
}

function resultPath(model: string, variant: PromptVariant): string {
  return join(paths.resultsDir, `${RESULT_PREFIX}-${model}-${variant}.jsonl`);
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function summaryCell(summary: RunSummary | undefined): string {
  if (!summary) {
    return "n/a";
  }
  return summary.meanRbr.toFixed(3);
}

function markdownSummary(entries: ModelBenchmarkReport[]): string {
  const lines: string[] = [];
  lines.push(`# ${REPORT_TITLE}`);
  lines.push("");
  lines.push(
    "Generated from local JSONL results. Independent stress corpus, not pre-registered.",
  );
  lines.push("");
  lines.push(
    "| Model | Corpus | Awesome/O RBR | Careful RBR | Compile | Test | CPT_output | CPT_total | Output overhead | Gates |",
  );
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|---|");

  for (const entry of entries) {
    const awesome = entry.report.variants.find(
      (v) => v.variant === "awesome-o",
    );
    const careful = entry.report.variants.find(
      (v) => v.variant === "careful-control",
    );
    const baseline = entry.report.variants.find(
      (v) => v.variant === "baseline",
    );
    if (!awesome || !careful || !baseline) {
      continue;
    }
    const overhead =
      awesome.summary.meanOutputTokens /
      Math.max(baseline.summary.meanOutputTokens, 1);
    lines.push(
      `| ${entry.model} | ${CORPUS_LABEL} | ${awesome.summary.meanRbr.toFixed(3)} | ${careful.summary.meanRbr.toFixed(3)} | ${pct(awesome.summary.compilePassRate)} | ${pct(awesome.summary.testPassRate)} | ${awesome.summary.meanCptOutput.toFixed(2)} | ${awesome.summary.meanCpt.toFixed(2)} | ${overhead.toFixed(2)}x | ${entry.report.allGatesPass ? "PASS" : "FAIL"} |`,
    );
  }

  lines.push("");
  lines.push("## Lane RBR");
  lines.push("");
  lines.push("| Model | Lane | Awesome/O | Careful-control |");
  lines.push("|---|---|---:|---:|");
  for (const entry of entries) {
    const awesome = entry.report.variants.find(
      (v) => v.variant === "awesome-o",
    );
    const careful = entry.report.variants.find(
      (v) => v.variant === "careful-control",
    );
    for (const lane of LANES) {
      // Skip lanes this corpus does not exercise, so the table stays clean
      // when the same analyzer runs over corpora with different lane mixes.
      if (!awesome?.byClaimLane[lane] && !careful?.byClaimLane[lane]) {
        continue;
      }
      lines.push(
        `| ${entry.model} | ${lane} | ${summaryCell(awesome?.byClaimLane[lane])} | ${summaryCell(careful?.byClaimLane[lane])} |`,
      );
    }
  }

  lines.push("");
  lines.push("## Known Failure Modes");
  lines.push("");
  lines.push("- Operational/data lies remain the lane to watch most closely.");
  lines.push(
    "- Fence-only output is treated as a cosmetic 0.05 format penalty.",
  );
  lines.push(
    "- CPT_output is the primary efficiency metric; CPT_total is disclosed because the skill has input-token overhead.",
  );
  lines.push("- The corpus is independent but not pre-registered.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

const modelReports: ModelBenchmarkReport[] = [];
for (const model of MODELS) {
  const byVariant = new Map<PromptVariant, CaseResult[]>();
  for (const variant of VARIANTS) {
    byVariant.set(variant, loadJsonl(resultPath(model, variant)));
  }
  for (const variant of OPTIONAL_VARIANTS) {
    const path = resultPath(model, variant);
    if (existsSync(path)) {
      byVariant.set(variant, loadJsonl(path));
    }
  }
  const report = buildBenchmarkReport(byVariant);
  console.log(`\n######## ${model} ########\n`);
  console.log(formatBenchmarkReport(report));
  modelReports.push({ model, report });
}

console.log(
  `\n${formatMultiModelReport(modelReports, `${SUMMARY_LABEL} (awesome-o)`)}`,
);

const outputPath = join(paths.repoRoot, OUTPUT_DOC);
writeFileSync(outputPath, markdownSummary(modelReports), "utf8");
console.log(`\nWrote ${outputPath}`);

if (!modelReports.every((entry) => entry.report.allGatesPass)) {
  process.exitCode = 1;
}
