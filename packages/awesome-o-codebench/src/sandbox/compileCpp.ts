import { execa } from "execa";

import { paths } from "../config.js";

let imageReady: Promise<string> | undefined;

async function buildImage(): Promise<string> {
  await execa("docker", ["build", "-t", paths.dockerImage, paths.sandboxDir], {
    stdio: "inherit",
  });
  return paths.dockerImage;
}

export async function ensureSandboxImage(): Promise<string> {
  if (!imageReady) {
    imageReady = (async () => {
      try {
        await execa("docker", ["image", "inspect", paths.dockerImage]);
        return paths.dockerImage;
      } catch {
        return buildImage();
      }
    })();
  }
  return imageReady;
}

export interface CompileOptions {
  workDir: string;
  sourceFile: string;
  outputFile: string;
  cppStandard: "c++17";
}

export async function compileCpp(
  options: CompileOptions,
): Promise<{ ok: boolean; stderr: string; stdout: string }> {
  await ensureSandboxImage();

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
      "clang++",
      `-std=${options.cppStandard}`,
      "-O2",
      "-pipe",
      "-Wall",
      "-Wextra",
      "-Werror",
      options.sourceFile,
      "-o",
      options.outputFile,
    ],
    { reject: false },
  );

  return {
    ok: result.exitCode === 0,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}
