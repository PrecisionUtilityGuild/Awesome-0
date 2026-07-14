import { join } from "node:path";

import { paths } from "../packages/awesome-o-codebench/src/config.js";

// Held-out evaluation. The holdout corpus uses contract shapes and authority
// framings that the SKILL.md text never enumerates, written black-box against a
// frozen skill (see docs/benchmark-methodology.md, "Train/test split"). It exists
// to answer the confound "does Awesome/O generalize, or just pattern-match the
// traps its own author listed?" Runs the same variants as v1, including the
// length-matched careful-long control.
process.env.EVAL_PREFIX ??= "holdout";
process.env.EVAL_MODELS ??= "haiku,sonnet";
process.env.EVAL_TASKS ??= join(
  paths.packageRoot,
  "tasks",
  "cpp",
  "holdout.jsonl",
);
process.env.EVAL_HIDDEN_TESTS ??= "1";

await import("./eval-anthropic.ts");
