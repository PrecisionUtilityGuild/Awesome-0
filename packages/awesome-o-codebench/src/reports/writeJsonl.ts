import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { CaseResult } from "../types.js";

export async function writeJsonl(
  outputPath: string,
  results: CaseResult[],
  truncate = true,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const lines = results.map((result) => JSON.stringify(result)).join("\n");
  if (truncate) {
    await writeFile(outputPath, lines.length > 0 ? `${lines}\n` : "", "utf8");
    return;
  }

  if (lines.length > 0) {
    await appendFile(outputPath, `${lines}\n`, "utf8");
  }
}
