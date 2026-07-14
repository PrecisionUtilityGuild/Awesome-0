import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRepoEnv } from "../packages/awesome-o-codebench/src/loadEnv.js";
import {
  DEFAULT_OLLAMA_MODEL,
  checkOllamaSetup,
  resolveOllamaModel,
} from "../packages/awesome-o-codebench/src/providers/ollamaProvider.js";

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
const model = resolveOllamaModel(
  process.env.PILOT_MODEL ?? DEFAULT_OLLAMA_MODEL,
);
const caseId = process.env.PILOT_CASE ?? "premise_trap_is_even_001";

function fail(message: string): never {
  console.error(`pilot:ollama FAIL: ${message}`);
  process.exit(1);
}

function runVariant(variant: (typeof variants)[number]): void {
  const output = join(resultsDir, `pilot-ollama-${variant}.jsonl`);
  console.log(`\n=== ${variant} (${model}) ===`);

  const result = spawnSync(
    tsxBin,
    [
      codebenchCli,
      "run",
      "--provider",
      "ollama",
      "--model",
      model,
      "--variant",
      variant,
      "--case",
      caseId,
      "--output",
      output,
    ],
    { cwd: repoRoot, encoding: "utf8", stdio: "inherit" },
  );

  if (result.status !== 0) {
    fail(`${variant} run exited ${result.status}`);
  }

  if (!existsSync(output)) {
    fail(`${variant} did not write ${output}`);
  }
}

async function main(): Promise<void> {
  await checkOllamaSetup(model);

  console.log(
    `Awesome/O local pilot: ${caseId} × ${variants.join(", ")} on ollama/${model}`,
  );

  for (const variant of variants) {
    runVariant(variant);
  }

  console.log("\n=== comparison ===");
  for (const variant of variants) {
    const output = join(resultsDir, `pilot-ollama-${variant}.jsonl`);
    const line = readFileSync(output, "utf8").trim().split("\n")[0];
    const parsed = JSON.parse(line) as {
      scores?: { rbrCase?: number; cptCase?: number };
      usage?: { totalTokens?: number };
      compile?: { ok?: boolean };
    };

    console.log(
      `${variant.padEnd(16)} RBR=${parsed.scores?.rbrCase?.toFixed(3) ?? "?"} CPT=${parsed.scores?.cptCase?.toFixed(3) ?? "?"} tokens=${parsed.usage?.totalTokens ?? "?"} compile=${parsed.compile?.ok ? "ok" : "fail"}`,
    );
  }

  console.log(`\nResults: ${resultsDir}/pilot-ollama-*.jsonl`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
