import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRepoEnv } from "../packages/awesome-o-codebench/src/loadEnv.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
loadRepoEnv(repoRoot);
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const codebenchCli = join(
  repoRoot,
  "packages",
  "awesome-o-codebench",
  "src",
  "cli.ts",
);
const resultsDir = join(repoRoot, "packages", "awesome-o-codebench", "results");

const variants = ["baseline", "careful-control", "awesome-o"] as const;
const model = process.env.PILOT_MODEL ?? "haiku";
const caseId = process.env.PILOT_CASE ?? "premise_trap_is_even_001";
const maxOutputTokens = process.env.PILOT_MAX_OUTPUT_TOKENS
  ? parseInt(process.env.PILOT_MAX_OUTPUT_TOKENS, 10)
  : undefined;
const outputSuffix = maxOutputTokens ? `-${maxOutputTokens}tok` : "";

function fail(message: string): never {
  console.error(`pilot FAIL: ${message}`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  fail(
    "ANTHROPIC_API_KEY is not set. Export your Claude Console API key first.",
  );
}

function runVariant(variant: (typeof variants)[number]): void {
  const output = join(resultsDir, `pilot-${variant}${outputSuffix}.jsonl`);
  console.log(`\n=== ${variant} (${model}) ===`);

  const args = [
    codebenchCli,
    "run",
    "--provider",
    "anthropic",
    "--model",
    model,
    "--variant",
    variant,
    "--case",
    caseId,
    "--output",
    output,
  ];
  if (maxOutputTokens) {
    args.push("--max-output-tokens", String(maxOutputTokens));
  }

  const result = spawnSync(tsxBin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    fail(`${variant} run exited ${result.status}`);
  }

  if (!existsSync(output)) {
    fail(`${variant} did not write ${output}`);
  }
}

console.log(
  `Awesome/O pilot: ${caseId} × ${variants.join(", ")} on anthropic/${model}${maxOutputTokens ? ` (max_output_tokens=${maxOutputTokens})` : ""}`,
);

for (const variant of variants) {
  runVariant(variant);
}

console.log("\n=== comparison ===");
for (const variant of variants) {
  const output = join(resultsDir, `pilot-${variant}${outputSuffix}.jsonl`);
  const line = readFileSync(output, "utf8").trim().split("\n")[0];
  const parsed = JSON.parse(line) as {
    scores?: { rbrCase?: number; cptCase?: number; antiSycophancy?: number };
    usage?: { totalTokens?: number };
    compile?: { ok?: boolean };
  };

  console.log(
    `${variant.padEnd(16)} RBR=${parsed.scores?.rbrCase?.toFixed(3) ?? "?"} CPT=${parsed.scores?.cptCase?.toFixed(3) ?? "?"} tokens=${parsed.usage?.totalTokens ?? "?"} compile=${parsed.compile?.ok ? "ok" : "fail"} antiSyc=${parsed.scores?.antiSycophancy ?? "?"}`,
  );
}

console.log(`\nResults: ${resultsDir}/pilot-*${outputSuffix}.jsonl`);
