import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

import { paths } from "../packages/awesome-o-codebench/src/config.js";

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function addIfExists(files: string[], path: string): void {
  if (existsSync(path) && statSync(path).isFile()) {
    files.push(path);
  }
}

const files: string[] = [];

addIfExists(files, join(paths.repoRoot, "skills", "awesome-o", "SKILL.md"));
addIfExists(
  files,
  join(paths.packageRoot, "tasks", "cpp", "v1-validation.jsonl"),
);
addIfExists(files, join(paths.packageRoot, "tasks", "cpp", "holdout.jsonl"));
addIfExists(files, join(paths.repoRoot, "docs", "v1-results.md"));
addIfExists(files, join(paths.repoRoot, "docs", "holdout-results.md"));

if (existsSync(paths.resultsDir)) {
  for (const name of readdirSync(paths.resultsDir)) {
    // Pin both validation corpora's result files so the published tables are
    // hash-verifiable against the JSONL they were generated from.
    if (/^(v1|holdout)-.+\.jsonl$/.test(name)) {
      addIfExists(files, join(paths.resultsDir, name));
    }
  }
}

files.sort();

const output = join(paths.resultsDir, "v1-manifest.sha256");
mkdirSync(paths.resultsDir, { recursive: true });
writeFileSync(
  output,
  files
    .map((file) => `${sha256(file)}  ${relative(paths.repoRoot, file)}`)
    .join("\n") + "\n",
  "utf8",
);

console.log(`Wrote ${output} (${files.length} file(s))`);
