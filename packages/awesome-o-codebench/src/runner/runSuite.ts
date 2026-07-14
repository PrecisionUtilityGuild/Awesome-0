import type { BenchRunConfig } from "../config.js";
import { summarizeResults } from "../metrics/summarize.js";
import { writeJsonl } from "../reports/writeJsonl.js";
import type { CaseResult, RunSummary } from "../types.js";
import { loadTasksFromFile } from "./loadTasks.js";
import { runCase } from "./runCase.js";

export interface SuiteRunResult {
  results: CaseResult[];
  summary: RunSummary;
  outputPath: string;
}

export async function runSuite(
  config: BenchRunConfig,
): Promise<SuiteRunResult> {
  const cases = await loadTasksFromFile(config.tasksPath, config.caseId);
  const results: CaseResult[] = [];

  for (const benchCase of cases) {
    results.push(await runCase(benchCase, config));
  }

  await writeJsonl(config.outputPath, results);
  const summary = summarizeResults(results);

  return {
    results,
    summary,
    outputPath: config.outputPath,
  };
}
