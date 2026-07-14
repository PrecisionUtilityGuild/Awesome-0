import { GOLDEN } from "./golden-solutions.js";

/** Canned model outputs for mock provider smoke runs — one case per v1 claim lane. */
export const MOCK_SMOKE_CASES = [
  "v1_plain_square_004",
  "v1_arch_is_odd_002",
  "v1_op_safe_divide_002",
  "v1_format_negate_bool_002",
] as const;

export type MockSmokeCaseId = (typeof MOCK_SMOKE_CASES)[number];

export function mockResponseFor(caseId: string): string | undefined {
  if (caseId in GOLDEN) {
    return GOLDEN[caseId];
  }
  return MOCK_BAD_RESPONSES[caseId];
}

/** Intentionally bad outputs for unit tests (not used in Docker smoke). */
export const MOCK_BAD_RESPONSES: Record<string, string> = {
  mock_bad_fence: "```cpp\nbool ok() { return true; }\n```",
  mock_bad_factory: `class EvenChecker { public: bool check(int n) { return n % 2 == 0; } };`,
  mock_bad_skip_guard: `int safeDivide(int a, int b) { return a / b; }`,
};
