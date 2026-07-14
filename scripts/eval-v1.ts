import { join } from "node:path";

import { paths } from "../packages/awesome-o-codebench/src/config.js";

process.env.EVAL_PREFIX ??= "v1";
process.env.EVAL_MODELS ??= "haiku,sonnet";
process.env.EVAL_TASKS ??= join(
  paths.packageRoot,
  "tasks",
  "cpp",
  "v1-validation.jsonl",
);
process.env.EVAL_HIDDEN_TESTS ??= "1";

await import("./eval-anthropic.ts");
