import { execa } from "execa";

import { paths } from "../config.js";
import { ensureSandboxImage } from "./compileCpp.js";

export interface ExecuteOptions {
  workDir: string;
  binaryFile: string;
  timeoutMs: number;
}

export async function executeCpp(options: ExecuteOptions): Promise<{
  ok: boolean;
  stderr: string;
  stdout: string;
  exitCode: number | null;
}> {
  await ensureSandboxImage();

  // Docker container startup can dominate wall time on desktop runtimes; task
  // timeout_ms targets user code, while this wrapper timeout must leave room for
  // container startup and teardown.
  const dockerTimeoutMs = Math.max(options.timeoutMs + 5_000, 15_000);

  const result = await execa(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--cpus",
      "1",
      "--memory",
      "512m",
      "-v",
      `${options.workDir}:/work`,
      "-w",
      "/work",
      paths.dockerImage,
      `./${options.binaryFile}`,
    ],
    {
      reject: false,
      timeout: dockerTimeoutMs,
    },
  );

  return {
    ok: result.exitCode === 0,
    stderr: result.timedOut
      ? `Execution timed out after ${dockerTimeoutMs}ms`
      : result.stderr,
    stdout: result.stdout,
    exitCode: result.exitCode ?? null,
  };
}
