import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { paths } from "../packages/awesome-o-codebench/src/config.js";
import { scoreCase } from "../packages/awesome-o-codebench/src/metrics/scoreCase.js";
import { extractCode } from "../packages/awesome-o-codebench/src/runner/extractCode.js";
import { renderHarness } from "../packages/awesome-o-codebench/src/sandbox/renderHarness.js";
import { compileCpp } from "../packages/awesome-o-codebench/src/sandbox/compileCpp.js";
import { executeCpp } from "../packages/awesome-o-codebench/src/sandbox/executeCpp.js";
import {
  isExprTestCase,
  type BenchCase,
  type CaseResult,
  type CaseScores,
} from "../packages/awesome-o-codebench/src/types.js";

const PREFIX = process.env.REPLAY_PREFIX ?? "v1";
const TASKS_PATH =
  process.env.REPLAY_TASKS ??
  join(paths.packageRoot, "tasks", "cpp", "v1-validation.jsonl");
const MODELS = (process.env.REPLAY_MODELS ?? "haiku,sonnet")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const VARIANTS = (
  process.env.REPLAY_VARIANTS ??
  "baseline,concise-control,careful-control,careful-long,awesome-o"
)
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

function fail(message: string): never {
  console.error(`replay-results FAIL: ${message}`);
  process.exit(1);
}

function loadJsonl<T>(path: string): T[] {
  const text = readFileSync(path, "utf8").trim();
  if (!text) {
    return [];
  }
  return text.split("\n").map((line) => JSON.parse(line) as T);
}

function toCaseScores(scores: ReturnType<typeof scoreCase>): CaseScores {
  return {
    rbrCase: scores.rbrCase,
    qualityCase: scores.qualityCase,
    cptCase: scores.cptCase,
    cptOutputCase: scores.cptOutputCase,
    compileFail: scores.compileFail,
    testFailRate: scores.testFailRate,
    formatViolation: scores.formatViolation,
    overengineeringPenalty: scores.overengineeringPenalty,
    sycophancyFail: scores.sycophancyFail,
    antiSycophancy: scores.antiSycophancy,
    simplicity: scores.simplicity,
    behavioralSycophancyFail: scores.behavioralSycophancyFail,
  };
}

async function replayCase(
  result: CaseResult,
  benchCase: BenchCase,
): Promise<CaseResult> {
  const extraction = extractCode(result.rawOutput);
  const extractedCode = extraction.code;
  const visibleExprTests = benchCase.visible_tests.filter(isExprTestCase);
  const hiddenExprTests = (benchCase.hidden_tests ?? []).filter(isExprTestCase);

  const compile: CaseResult["compile"] = { ok: false };
  const execution: CaseResult["execution"] = {
    visiblePassed: 0,
    visibleTotal: visibleExprTests.length,
    hiddenPassed: 0,
    hiddenTotal: hiddenExprTests.length,
    perfPassed: !benchCase.judging.performance,
  };

  if (extraction.found) {
    const workDir = await mkdtemp(join(tmpdir(), "awesome-o-replay-"));
    const harness = await renderHarness(extractedCode, [
      ...visibleExprTests,
      ...hiddenExprTests,
    ]);
    await writeFile(join(workDir, "main.cpp"), harness, "utf8");

    const compileResult = await compileCpp({
      workDir,
      sourceFile: "main.cpp",
      outputFile: "main.out",
      cppStandard: benchCase.constraints.cpp_standard,
    });

    compile.ok = compileResult.ok;
    if (!compileResult.ok) {
      compile.stderr = compileResult.stderr;
      compile.stdout = compileResult.stdout;
    }

    if (compile.ok && benchCase.judging.tests) {
      const runResult = await executeCpp({
        workDir,
        binaryFile: "main.out",
        timeoutMs: benchCase.constraints.timeout_ms,
      });

      if (runResult.ok) {
        execution.visiblePassed = visibleExprTests.length;
        execution.hiddenPassed = hiddenExprTests.length;
      } else {
        execution.stderr = runResult.stderr;
        execution.stdout = runResult.stdout;
      }
    }
  }

  const scores = scoreCase({
    benchCase,
    usage: result.usage,
    compile,
    execution,
    extraction,
    rawOutput: result.rawOutput,
    extractedCode,
  });

  return {
    ...result,
    compile,
    execution,
    scores: toCaseScores(scores),
    extractedCode,
  };
}

const tasks = loadJsonl<BenchCase>(TASKS_PATH);
const taskById = new Map(tasks.map((task) => [task.id, task]));
if (taskById.size === 0) {
  fail(`no tasks loaded from ${TASKS_PATH}`);
}

for (const model of MODELS) {
  for (const variant of VARIANTS) {
    const outputPath = join(
      paths.resultsDir,
      `${PREFIX}-${model}-${variant}.jsonl`,
    );
    if (!existsSync(outputPath)) {
      console.log(`skip missing ${outputPath}`);
      continue;
    }

    const results = loadJsonl<CaseResult>(outputPath);
    const replayed: CaseResult[] = [];
    for (const result of results) {
      const benchCase = taskById.get(result.caseId);
      if (!benchCase) {
        fail(`missing task for ${result.caseId}`);
      }
      replayed.push(await replayCase(result, benchCase));
    }

    writeFileSync(
      outputPath,
      `${replayed.map((result) => JSON.stringify(result)).join("\n")}\n`,
      "utf8",
    );
    console.log(`replayed ${replayed.length} results: ${outputPath}`);
  }
}
