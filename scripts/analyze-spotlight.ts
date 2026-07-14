import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { paths } from "../packages/awesome-o-codebench/src/config.js";
import { loadTasksFromFile } from "../packages/awesome-o-codebench/src/runner/loadTasks.js";
import type {
  BenchCase,
  CaseResult,
} from "../packages/awesome-o-codebench/src/types.js";

const MODELS = (process.env.ANALYZE_MODELS ?? "haiku,sonnet")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const COMPARE_VARIANTS = ["careful-control", "awesome-o"] as const;

function fail(message: string): never {
  console.error(`analyze:spotlight FAIL: ${message}`);
  process.exit(1);
}

function loadJsonl(path: string): CaseResult[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8").trim();
  } catch {
    fail(`could not read ${path} — run pnpm eval:spotlight first`);
  }
  if (!text) {
    fail(`no results in ${path}`);
  }
  return text.split("\n").map((line) => JSON.parse(line) as CaseResult);
}

function resultPath(
  model: string,
  variant: (typeof COMPARE_VARIANTS)[number],
): string {
  return join(paths.resultsDir, `spotlight-${model}-${variant}.jsonl`);
}

function pct(passed: number, total: number): string {
  if (total === 0) {
    return "n/a";
  }
  return `${passed}/${total}`;
}

function fenceCpp(code: string | undefined): string {
  const body = code?.trim() || "(no extractable code)";
  return `\`\`\`cpp\n${body}\n\`\`\``;
}

function formatResult(result: CaseResult | undefined): string[] {
  if (!result) {
    return ["_No result file._"];
  }

  const hiddenTotal = result.execution.hiddenTotal;
  const hiddenPassed = result.execution.hiddenPassed;
  const lines = [
    `| RBR | ${result.scores.rbrCase.toFixed(3)} |`,
    `| Compile | ${result.compile.ok ? "pass" : "fail"} |`,
    `| Visible tests | ${pct(result.execution.visiblePassed, result.execution.visibleTotal)} |`,
    `| Hidden tests | ${pct(hiddenPassed, hiddenTotal)} |`,
    `| Sycophancy fail | ${result.scores.sycophancyFail ? "yes" : "no"} |`,
    `| Overengineering | ${result.scores.overengineeringPenalty.toFixed(2)} |`,
    `| Output tokens | ${result.usage.outputTokens ?? "n/a"} |`,
    "",
    fenceCpp(result.extractedCode),
  ];

  if (hiddenTotal > 0 && hiddenPassed < hiddenTotal) {
    lines.push(
      "",
      `_Hidden tests failed — typical when the model skipped contract-implied guards the prompt told it to drop._`,
    );
  }

  return lines;
}

function caseThesis(benchCase: BenchCase): string {
  if (benchCase.id === "spotlight_standup_max_subarray") {
    return "Kadane correctness + hidden empty-vector cases the PM says to skip; no SubarrayAnalyzer theater.";
  }
  if (benchCase.id === "spotlight_ops_vector_lookup") {
    return "Bounds-checked lookup + hidden out-of-range/empty cases the SRE says to skip; no VectorAccessorRepository theater.";
  }
  return "Contract-implied guards beat operational lies and architecture bait.";
}

function promptExcerpt(prompt: string): string {
  return prompt.length > 600 ? `${prompt.slice(0, 600)}…` : prompt;
}

async function main(): Promise<void> {
  const tasksPath = join(paths.packageRoot, "tasks", "cpp", "spotlight.jsonl");
  const cases = await loadTasksFromFile(tasksPath);

  const lines: string[] = [];
  lines.push("# Awesome/O Spotlight Cases");
  lines.push("");
  lines.push(
    "**Illustrative only — not part of v1 release gates.** Two messy, real-world-style prompts (Slack standup dumps, ticket scraps, contradictory authority). Use these when someone opens the repo and thinks the main corpus looks like toys.",
  );
  lines.push("");
  lines.push("Regenerate after a paid eval:");
  lines.push("");
  lines.push("```bash");
  lines.push(
    "pnpm eval:spotlight      # Haiku + Sonnet, careful-control + awesome-o + others",
  );
  lines.push("pnpm analyze:spotlight   # writes this file from local JSONL");
  lines.push("```");
  lines.push("");
  lines.push(
    "Corpus: `packages/awesome-o-codebench/tasks/cpp/spotlight.jsonl` (2 cases, `combo-trap` lane = operational lie + architecture bait in one prompt).",
  );
  lines.push("");

  for (const model of MODELS) {
    const byVariant = new Map<string, CaseResult[]>();
    for (const variant of COMPARE_VARIANTS) {
      byVariant.set(variant, loadJsonl(resultPath(model, variant)));
    }

    lines.push(`## ${model}`);
    lines.push("");

    for (const benchCase of cases) {
      const careful = byVariant
        .get("careful-control")
        ?.find((row) => row.caseId === benchCase.id);
      const awesome = byVariant
        .get("awesome-o")
        ?.find((row) => row.caseId === benchCase.id);

      lines.push(`### ${benchCase.id}`);
      lines.push("");
      lines.push("<details>");
      lines.push("<summary>Prompt (as the model sees it)</summary>");
      lines.push("");
      lines.push("```text");
      lines.push(promptExcerpt(benchCase.prompt));
      lines.push("```");
      lines.push("");
      lines.push("</details>");
      lines.push("");
      lines.push(`**What the harness checks:** ${caseThesis(benchCase)}`);
      lines.push("");
      lines.push("| | careful-control | awesome-o |");
      lines.push("|---|---|---|");

      const metrics = [
        "RBR",
        "Compile",
        "Visible tests",
        "Hidden tests",
        "Sycophancy fail",
      ] as const;

      for (const metric of metrics) {
        const carefulVal =
          metric === "RBR"
            ? careful?.scores.rbrCase.toFixed(3)
            : metric === "Compile"
              ? careful?.compile.ok
                ? "pass"
                : "fail"
              : metric === "Visible tests"
                ? careful
                  ? pct(
                      careful.execution.visiblePassed,
                      careful.execution.visibleTotal,
                    )
                  : "n/a"
                : metric === "Hidden tests"
                  ? careful
                    ? pct(
                        careful.execution.hiddenPassed,
                        careful.execution.hiddenTotal,
                      )
                    : "n/a"
                  : careful?.scores.sycophancyFail
                    ? "yes"
                    : "no";

        const awesomeVal =
          metric === "RBR"
            ? awesome?.scores.rbrCase.toFixed(3)
            : metric === "Compile"
              ? awesome?.compile.ok
                ? "pass"
                : "fail"
              : metric === "Visible tests"
                ? awesome
                  ? pct(
                      awesome.execution.visiblePassed,
                      awesome.execution.visibleTotal,
                    )
                  : "n/a"
                : metric === "Hidden tests"
                  ? awesome
                    ? pct(
                        awesome.execution.hiddenPassed,
                        awesome.execution.hiddenTotal,
                      )
                    : "n/a"
                  : awesome?.scores.sycophancyFail
                    ? "yes"
                    : "no";

        lines.push(
          `| ${metric} | ${carefulVal ?? "n/a"} | ${awesomeVal ?? "n/a"} |`,
        );
      }

      lines.push("");
      lines.push("#### careful-control output");
      lines.push("");
      lines.push(...formatResult(careful));
      lines.push("");
      lines.push("#### awesome-o output");
      lines.push("");
      lines.push(...formatResult(awesome));
      lines.push("");
    }
  }

  lines.push("## How to read this");
  lines.push("");
  lines.push(
    '- **careful-control** is task + "be careful, mentally compile, handle edge cases" — the free alternative Awesome/O must beat on trapped prompts.',
  );
  lines.push(
    "- A model can pass visible tests and still fail hidden tests when it believed the operational lie.",
  );
  lines.push(
    '- A model can also "be careful" and still ship a 40-line `SubarrayAnalyzer` because Marco said RFC merged.',
  );
  lines.push(
    "- Full v1 stats live in [`v1-results.md`](./v1-results.md). Spotlight is the story version.",
  );
  lines.push("");

  const outputPath = join(paths.repoRoot, "docs", "spotlight.md");
  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
