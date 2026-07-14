import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CaseResult, PromptVariant } from "../types.js";
import {
  buildBenchmarkReport,
  buildFailureTaxonomy,
  classifyFailure,
} from "./benchmarkReport.js";

function makeResult(
  variant: PromptVariant,
  caseId: string,
  rbrCase: number,
  overrides: Partial<CaseResult> = {},
): CaseResult {
  return {
    caseId,
    suite: "premise-traps",
    claimLane: "architecture-trap",
    variant,
    model: "test",
    latencyMs: 1,
    usage: {
      inputTokens: variant === "awesome-o" ? 1200 : 50,
      outputTokens: 60,
      totalTokens: variant === "awesome-o" ? 1260 : 110,
      source: "local_estimate",
    },
    compile: { ok: rbrCase < 0.5 },
    execution: {
      visiblePassed: rbrCase < 0.5 ? 1 : 0,
      visibleTotal: 1,
      hiddenPassed: 1,
      hiddenTotal: 1,
      perfPassed: true,
    },
    personaOverhead: 0,
    scores: {
      rbrCase,
      qualityCase: 1 - rbrCase,
      cptCase: 10,
      cptOutputCase: 15,
      compileFail: rbrCase >= 0.5 ? 1 : 0,
      testFailRate: 0,
      formatViolation: 0,
      overengineeringPenalty: 0,
      sycophancyFail: 0,
      antiSycophancy: 1,
      simplicity: 1,
    },
    ...overrides,
  };
}

describe("benchmarkReport", () => {
  it("classifies primary failure modes in priority order", () => {
    const compile = makeResult("awesome-o", "a", 0.8);
    assert.equal(classifyFailure(compile), "compile");

    const testFail = makeResult("awesome-o", "b", 0.3, {
      scores: {
        ...makeResult("awesome-o", "b", 0.3).scores,
        testFailRate: 0.5,
      },
    });
    assert.equal(classifyFailure(testFail), "test");
  });

  it("passes execution gates when awesome-o beats careful-control", () => {
    const byVariant = new Map<PromptVariant, CaseResult[]>([
      ["baseline", [makeResult("baseline", "c1", 0.4)]],
      ["careful-control", [makeResult("careful-control", "c1", 0.3)]],
      ["awesome-o", [makeResult("awesome-o", "c1", 0.05)]],
    ]);

    const report = buildBenchmarkReport(byVariant);
    assert.equal(report.executionGatesPass, true);
    assert.ok(report.gates.find((g) => g.id === "rbr_vs_careful")?.pass);
  });

  it("fails RBR gate when awesome-o regresses vs careful-control", () => {
    const byVariant = new Map<PromptVariant, CaseResult[]>([
      ["baseline", [makeResult("baseline", "c1", 0.4)]],
      ["careful-control", [makeResult("careful-control", "c1", 0.1)]],
      ["awesome-o", [makeResult("awesome-o", "c1", 0.5)]],
    ]);

    const report = buildBenchmarkReport(byVariant);
    assert.equal(report.executionGatesPass, false);
    assert.equal(
      report.gates.find((g) => g.id === "rbr_vs_careful")?.pass,
      false,
    );
  });

  it("builds failure taxonomy buckets", () => {
    const results = [
      makeResult("awesome-o", "clean", 0),
      makeResult("awesome-o", "bad", 0.9),
    ];
    const bucket = buildFailureTaxonomy(results);
    assert.equal(bucket.clean, 1);
    assert.equal(bucket.compile, 1);
  });
});
