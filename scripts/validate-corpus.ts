import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GOLDEN } from "../packages/awesome-o-codebench/src/fixtures/golden-solutions.js";
import { loadTasksFromFile } from "../packages/awesome-o-codebench/src/runner/loadTasks.js";
import { compileCpp } from "../packages/awesome-o-codebench/src/sandbox/compileCpp.js";
import { executeCpp } from "../packages/awesome-o-codebench/src/sandbox/executeCpp.js";
import { renderHarness } from "../packages/awesome-o-codebench/src/sandbox/renderHarness.js";
import type { BenchCase } from "../packages/awesome-o-codebench/src/types.js";
import { isExprTestCase } from "../packages/awesome-o-codebench/src/types.js";

function fail(message: string): never {
  console.error(`validate-corpus FAIL: ${message}`);
  process.exit(1);
}

async function validateCase(benchCase: BenchCase): Promise<void> {
  const code = GOLDEN[benchCase.id];
  if (!code) {
    fail(`missing golden reference for ${benchCase.id}`);
  }

  const visible = benchCase.visible_tests.filter(isExprTestCase);
  const hidden = (benchCase.hidden_tests ?? []).filter(isExprTestCase);
  const tests = [...visible, ...hidden];

  const workDir = await mkdtemp(join(tmpdir(), "awesome-o-validate-"));
  await writeFile(
    join(workDir, "main.cpp"),
    await renderHarness(code, tests),
    "utf8",
  );

  const compile = await compileCpp({
    workDir,
    sourceFile: "main.cpp",
    outputFile: "main.out",
    cppStandard: benchCase.constraints.cpp_standard,
  });

  if (!compile.ok) {
    fail(
      `${benchCase.id}: golden solution failed to compile:\n${compile.stderr}`,
    );
  }

  const run = await executeCpp({
    workDir,
    binaryFile: "main.out",
    timeoutMs: benchCase.constraints.timeout_ms,
  });

  if (!run.ok) {
    fail(
      `${benchCase.id}: golden solution failed tests:\nstdout: ${run.stdout}\nstderr: ${run.stderr}`,
    );
  }
}

async function validateFile(path: string): Promise<number> {
  const cases = await loadTasksFromFile(path);
  const ids = new Set<string>();

  for (const benchCase of cases) {
    if (ids.has(benchCase.id)) {
      fail(`${path}: duplicate id ${benchCase.id}`);
    }
    ids.add(benchCase.id);
    await validateCase(benchCase);
  }

  console.log(
    `  ${path}: ${cases.length} cases OK (schema + golden compile/test)`,
  );
  return cases.length;
}

async function main(): Promise<void> {
  const files = process.argv.slice(2);
  const targets =
    files.length > 0
      ? files
      : [
          "packages/awesome-o-codebench/tasks/cpp/realistic.jsonl",
          "packages/awesome-o-codebench/tasks/cpp/pilot.jsonl",
          "packages/awesome-o-codebench/tasks/cpp/v1-validation.jsonl",
          "packages/awesome-o-codebench/tasks/cpp/holdout.jsonl",
          "packages/awesome-o-codebench/tasks/cpp/spotlight.jsonl",
        ];

  console.log("validate-corpus: checking schema + golden references in Docker");
  let total = 0;
  for (const file of targets) {
    total += await validateFile(file);
  }
  console.log(`validate-corpus: ${total} cases passed`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
