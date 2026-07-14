import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BenchRunConfig } from "../config.js";
import { personaOverhead } from "../metrics/tokenUsage.js";
import { scoreCase, type ScoreBreakdown } from "../metrics/scoreCase.js";
import { createAnthropicProvider } from "../providers/anthropicProvider.js";
import { createOllamaProvider } from "../providers/ollamaProvider.js";
import { createOpenAICompatibleProvider } from "../providers/openaiCompatible.js";
import { createMockProvider } from "../providers/mockProvider.js";
import type { ModelProvider } from "../types.js";
import type { BenchCase, CaseResult } from "../types.js";
import { compileCpp } from "../sandbox/compileCpp.js";
import { executeCpp } from "../sandbox/executeCpp.js";
import { renderHarness } from "../sandbox/renderHarness.js";
import { buildPromptVariant } from "./buildPromptVariant.js";
import { extractCode } from "./extractCode.js";
import { isExprTestCase } from "../types.js";
import type { CaseScores } from "../types.js";

function toCaseScores(scores: ScoreBreakdown): CaseScores {
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

function createProvider(
  config: BenchRunConfig,
  cases: BenchCase[],
): ModelProvider {
  if (config.provider === "mock") {
    return createMockProvider(cases);
  }
  if (config.provider === "anthropic") {
    return createAnthropicProvider();
  }
  if (config.provider === "ollama") {
    return createOllamaProvider();
  }
  return createOpenAICompatibleProvider();
}

export async function runCase(
  benchCase: BenchCase,
  config: BenchRunConfig,
): Promise<CaseResult> {
  const provider = createProvider(config, [benchCase]);
  const prompt = await buildPromptVariant(benchCase, config.variant);

  const completion = await provider.complete({
    model: config.model,
    system: prompt.system,
    user: prompt.user,
    maxOutputTokens:
      config.maxOutputTokens ?? benchCase.constraints.max_output_tokens,
    temperature: config.temperature,
    seed: config.seed,
  });

  const extraction = extractCode(completion.text);
  const extractedCode = extraction.code;

  const visibleExprTests = benchCase.visible_tests.filter(isExprTestCase);
  const hiddenExprTests = config.includeHiddenTests
    ? (benchCase.hidden_tests ?? []).filter(isExprTestCase)
    : [];

  const compile: CaseResult["compile"] = { ok: false };
  const execution: CaseResult["execution"] = {
    visiblePassed: 0,
    visibleTotal: visibleExprTests.length,
    hiddenPassed: 0,
    hiddenTotal: hiddenExprTests.length,
    perfPassed: !benchCase.judging.performance,
  };

  if (!extraction.found) {
    const scores = scoreCase({
      benchCase,
      usage: completion.usage,
      compile,
      execution,
      extraction,
      rawOutput: completion.text,
      extractedCode,
    });

    return {
      caseId: benchCase.id,
      suite: benchCase.suite,
      claimLane: benchCase.claim_lane,
      variant: config.variant,
      model: config.model,
      latencyMs: completion.latencyMs,
      usage: completion.usage,
      compile,
      execution,
      personaOverhead: personaOverhead(completion.text),
      scores: toCaseScores(scores),
      rawOutput: completion.text,
      extractedCode,
    };
  }

  const workDir = await mkdtemp(join(tmpdir(), "awesome-o-bench-"));
  const sourcePath = join(workDir, "main.cpp");
  const harness = await renderHarness(extractedCode, [
    ...visibleExprTests,
    ...hiddenExprTests,
  ]);
  await writeFile(sourcePath, harness, "utf8");

  const compileResult = await compileCpp({
    workDir,
    sourceFile: "main.cpp",
    outputFile: "main.out",
    cppStandard: benchCase.constraints.cpp_standard,
  });

  compile.ok = compileResult.ok;
  if (!compileResult.ok) {
    compile.stderr = compileResult.stderr;
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
  } else if (!compile.ok) {
    execution.visiblePassed = 0;
    execution.hiddenPassed = 0;
  }

  const scores = scoreCase({
    benchCase,
    usage: completion.usage,
    compile,
    execution,
    extraction,
    rawOutput: completion.text,
    extractedCode,
  });

  return {
    caseId: benchCase.id,
    suite: benchCase.suite,
    claimLane: benchCase.claim_lane,
    variant: config.variant,
    model: config.model,
    latencyMs: completion.latencyMs,
    usage: completion.usage,
    compile,
    execution,
    personaOverhead: personaOverhead(completion.text),
    scores: toCaseScores(scores),
    rawOutput: completion.text,
    extractedCode,
  };
}
