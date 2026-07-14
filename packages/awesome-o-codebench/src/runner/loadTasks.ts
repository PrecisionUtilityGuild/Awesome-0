import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { BenchCase } from "../types.js";

const exprTestSchema = z.object({
  expr: z.string(),
  expected: z.string(),
});

const performanceTestSchema = z.object({
  kind: z.literal("performance"),
  generator: z.string(),
  n: z.number(),
  timeout_ms: z.number(),
});

const benchCaseSchema = z.object({
  id: z.string(),
  suite: z.enum([
    "compile",
    "edge-cases",
    "performance",
    "token-discipline",
    "premise-traps",
  ]),
  language: z.literal("cpp"),
  claim_lane: z
    .enum([
      "plain",
      "architecture-trap",
      "operational-lie",
      "format-discipline",
      "combo-trap",
    ])
    .optional(),
  prompt: z.string(),
  entrypoint: z.string(),
  visible_tests: z.array(z.union([exprTestSchema, performanceTestSchema])),
  hidden_tests: z
    .array(z.union([exprTestSchema, performanceTestSchema]))
    .optional(),
  constraints: z.object({
    cpp_standard: z.literal("c++17"),
    max_output_tokens: z.number(),
    timeout_ms: z.number(),
    return_only_code: z.boolean().optional(),
    must_not_contain_regex: z.array(z.string()).optional(),
  }),
  judging: z.object({
    compile: z.boolean(),
    tests: z.boolean(),
    performance: z.boolean().optional(),
    token_discipline: z.boolean().optional(),
    simplicity: z.boolean().optional(),
    anti_sycophancy: z.boolean().optional(),
    reference_lines: z.number().optional(),
  }),
});

export async function loadTasksFromFile(
  filePath: string,
  caseId?: string,
): Promise<BenchCase[]> {
  const text = await readFile(filePath, "utf8");
  const cases: BenchCase[] = [];

  for (const [index, line] of text.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid JSON";
      throw new Error(`${filePath}:${index + 1}: ${message}`);
    }

    const result = benchCaseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `${filePath}:${index + 1}: ${result.error.issues[0]?.message ?? "invalid task"}`,
      );
    }

    if (caseId && result.data.id !== caseId) {
      continue;
    }

    cases.push(result.data);
  }

  if (caseId && cases.length === 0) {
    throw new Error(`case not found: ${caseId} in ${filePath}`);
  }

  return cases;
}
