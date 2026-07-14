import { readFile } from "node:fs/promises";

import { paths } from "../config.js";
import type { ExprTestCase, TestCase } from "../types.js";
import { isExprTestCase } from "../types.js";

type ExpectedKind = "bool" | "int" | "string";

function parseExpected(expected: string): {
  kind: ExpectedKind;
  literal: string;
} {
  if (expected === "true" || expected === "false") {
    return { kind: "bool", literal: expected };
  }
  const longMatch = /^(-?\d+)LL$/.exec(expected);
  if (longMatch) {
    return { kind: "int", literal: longMatch[1] };
  }
  if (/^-?\d+$/.test(expected)) {
    return { kind: "int", literal: expected };
  }

  let value = expected;
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }

  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return { kind: "string", literal: `"${escaped}"` };
}

function renderExprTest(test: ExprTestCase): string {
  const label = `${test.expr.replace(/"/g, '\\"')}`;
  const parsed = parseExpected(test.expected);

  switch (parsed.kind) {
    case "bool":
      return `  check_bool("${label}", static_cast<bool>(${test.expr}), ${parsed.literal});`;
    case "int":
      return `  check_int("${label}", static_cast<long long>(${test.expr}), ${parsed.literal});`;
    case "string":
      return `  check_string("${label}", ${test.expr}, ${parsed.literal});`;
    default: {
      const _exhaustive: never = parsed.kind;
      return _exhaustive;
    }
  }
}

export async function renderHarness(
  userCode: string,
  tests: TestCase[],
): Promise<string> {
  const template = await readFile(paths.harnessTemplate, "utf8");
  const exprTests = tests.filter(isExprTestCase);
  const testLines = exprTests.map((test) => renderExprTest(test));

  return template
    .replace("{{USER_CODE}}", userCode.trim())
    .replace("{{TESTS}}", testLines.join("\n"));
}
