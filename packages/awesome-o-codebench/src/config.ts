import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { PromptVariant } from "./types.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const repoRoot = resolve(packageRoot, "..", "..");

export type BenchProvider = "mock" | "openai" | "anthropic" | "ollama";

export interface BenchRunConfig {
  provider: BenchProvider;
  variant: PromptVariant;
  model: string;
  tasksPath: string;
  outputPath: string;
  caseId?: string;
  includeHiddenTests: boolean;
  temperature?: number;
  seed?: number;
  maxOutputTokens?: number;
}

export const paths = {
  packageRoot,
  repoRoot,
  skillMd: join(repoRoot, "skills", "awesome-o", "SKILL.md"),
  tasksDir: join(packageRoot, "tasks", "cpp"),
  harnessTemplate: join(
    packageRoot,
    "fixtures",
    "harness",
    "main.cpp.mustache",
  ),
  sandboxDir: join(packageRoot, "sandbox"),
  resultsDir: join(packageRoot, "results"),
  defaultTasksFile: join(packageRoot, "tasks", "cpp", "premise-traps.jsonl"),
  realisticTasksFile: join(packageRoot, "tasks", "cpp", "realistic.jsonl"),
  defaultOutput: join(packageRoot, "results", "smoke-run.jsonl"),
  dockerImage: "awesome-o-codebench-sandbox:latest",
} as const;

export function defaultRunConfig(
  overrides: Partial<BenchRunConfig> = {},
): BenchRunConfig {
  return {
    provider: "mock",
    variant: "baseline",
    model: "mock-model",
    tasksPath: paths.defaultTasksFile,
    outputPath: paths.defaultOutput,
    includeHiddenTests: false,
    ...overrides,
  };
}
