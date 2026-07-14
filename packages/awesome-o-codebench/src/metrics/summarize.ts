import type { CaseResult, ClaimLane, RunSummary, Suite } from "../types.js";

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function testPassRate(results: CaseResult[]): number {
  if (results.length === 0) {
    return 0;
  }
  const passed = results.filter((result) => {
    const total = result.execution.visibleTotal + result.execution.hiddenTotal;
    if (total === 0) {
      return result.compile.ok;
    }
    return (
      result.execution.visiblePassed + result.execution.hiddenPassed === total
    );
  }).length;
  return passed / results.length;
}

export function summarizeResults(results: CaseResult[]): RunSummary {
  if (results.length === 0) {
    return {
      caseCount: 0,
      meanRbr: 0,
      meanCpt: 0,
      meanCptOutput: 0,
      compilePassRate: 0,
      testPassRate: 0,
      meanInputTokens: 0,
      meanOutputTokens: 0,
      meanTotalTokens: 0,
    };
  }

  return {
    caseCount: results.length,
    meanRbr: mean(results.map((r) => r.scores.rbrCase)),
    meanCpt: mean(results.map((r) => r.scores.cptCase)),
    meanCptOutput: mean(results.map((r) => r.scores.cptOutputCase)),
    compilePassRate:
      results.filter((r) => r.compile.ok).length / results.length,
    testPassRate: testPassRate(results),
    meanInputTokens: mean(results.map((r) => r.usage.inputTokens ?? 0)),
    meanOutputTokens: mean(results.map((r) => r.usage.outputTokens ?? 0)),
    meanTotalTokens: mean(results.map((r) => r.usage.totalTokens ?? 0)),
  };
}

export function summarizeBySuite(
  results: CaseResult[],
): Partial<Record<Suite, RunSummary>> {
  const suites = [...new Set(results.map((r) => r.suite))];
  const bySuite: Partial<Record<Suite, RunSummary>> = {};
  for (const suite of suites) {
    bySuite[suite] = summarizeResults(
      results.filter((result) => result.suite === suite),
    );
  }
  return bySuite;
}

export function summarizeByClaimLane(
  results: CaseResult[],
): Partial<Record<ClaimLane, RunSummary>> {
  const lanes = [
    ...new Set(results.map((r) => r.claimLane).filter(Boolean)),
  ] as ClaimLane[];
  const byLane: Partial<Record<ClaimLane, RunSummary>> = {};
  for (const lane of lanes) {
    byLane[lane] = summarizeResults(
      results.filter((result) => result.claimLane === lane),
    );
  }
  return byLane;
}
