import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MOCK_SMOKE_CASES } from "../packages/awesome-o-codebench/src/fixtures/mock-responses.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const codebenchCli = join(
  repoRoot,
  "packages",
  "awesome-o-codebench",
  "src",
  "cli.ts",
);
const codebenchPkg = join(repoRoot, "packages", "awesome-o-codebench");
const skillRoot = join(repoRoot, "skills", "awesome-o");
const skillMd = join(skillRoot, "SKILL.md");
const v1Tasks = join(codebenchPkg, "tasks", "cpp", "v1-validation.jsonl");

function fail(message: string): never {
  console.error(`smoke FAIL: ${message}`);
  process.exit(1);
}

function assertExists(path: string, label: string): void {
  if (!existsSync(path)) {
    fail(`missing ${label} (${path})`);
  }
}

function assertMissing(path: string, label: string): void {
  if (existsSync(path)) {
    fail(`unexpected ${label} (${path})`);
  }
}

function runCodebench(args: string[]): string {
  const result = spawnSync(tsxBin, [codebenchCli, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.error) {
    fail(`codebench ${args.join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      `codebench ${args.join(" ")} exited ${result.status}: ${result.stderr}`,
    );
  }

  return result.stdout;
}

function assertUnitTests(): void {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--test",
      join(codebenchPkg, "src", "runner", "extractCode.test.ts"),
      join(codebenchPkg, "src", "metrics", "scoreCase.test.ts"),
      join(codebenchPkg, "src", "metrics", "benchmarkReport.test.ts"),
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    fail(`unit tests failed:\n${result.stderr || result.stdout}`);
  }
}

function assertSkillPackage(): void {
  assertExists(skillMd, "SKILL.md");
  const cppStyleReference = join(skillRoot, "references", "cpp-style.md");
  assertExists(cppStyleReference, "C++ benchmark fixture style reference");
  assertExists(
    join(skillRoot, "references", "benchmark-methodology.md"),
    "benchmark-methodology reference",
  );
  assertExists(join(skillRoot, "examples", "prompts.md"), "example prompts");
  assertMissing(join(skillRoot, "package.json"), "skill package.json");

  const skillText = readFileSync(skillMd, "utf8");
  const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    fail("SKILL.md missing YAML frontmatter");
  }

  const meta = frontmatter[1];
  if (!/^name:\s*awesome-o\s*$/m.test(meta)) {
    fail("SKILL.md frontmatter name must be awesome-o");
  }
  if (!/^description:\s*.+$/m.test(meta)) {
    fail("SKILL.md frontmatter description missing");
  }

  for (const section of [
    "Core premise",
    "Anti-sycophancy rule",
    "Output policy",
    "Internal checklist",
    "What this is not",
    "Exposure pressure",
    "Bidirectional traps",
  ]) {
    if (!skillText.includes(section)) {
      fail(`SKILL.md missing section: ${section}`);
    }
  }

  for (const phrase of [
    "delete-pressure",
    "add-pressure",
    "not** a YAGNI",
    "evaluator knows your secret",
  ]) {
    if (!skillText.includes(phrase)) {
      fail(`SKILL.md missing identity phrase: ${phrase}`);
    }
  }

  const prompts = readFileSync(
    join(skillRoot, "examples", "prompts.md"),
    "utf8",
  );
  const invocationCount = (prompts.match(/Use Awesome\/O/g) ?? []).length;
  if (invocationCount < 3) {
    fail(`examples/prompts.md needs >=3 invocations, found ${invocationCount}`);
  }

  const cppStyleText = readFileSync(cppStyleReference, "utf8");
  if (!cppStyleText.includes("not the core identity of the skill")) {
    fail(
      "cpp-style.md must be framed as a benchmark fixture, not skill identity",
    );
  }
}

function assertHarnessLayout(): void {
  const requiredHarnessPaths: Array<[string, string]> = [
    [
      join(codebenchPkg, "tasks", "cpp", "premise-traps.jsonl"),
      "premise-traps tasks",
    ],
    [
      join(codebenchPkg, "fixtures", "harness", "main.cpp.mustache"),
      "harness template",
    ],
    [
      join(codebenchPkg, "src", "fixtures", "golden-solutions.ts"),
      "golden solutions fixture",
    ],
    [
      join(codebenchPkg, "src", "fixtures", "mock-responses.ts"),
      "mock responses fixture",
    ],
    [join(codebenchPkg, "sandbox", "Dockerfile"), "sandbox Dockerfile"],
    [join(codebenchPkg, "src", "runner", "runSuite.ts"), "runSuite"],
    [
      join(codebenchPkg, "src", "providers", "mockProvider.ts"),
      "mock provider",
    ],
    [join(codebenchPkg, "src", "metrics", "scoreCase.ts"), "scoreCase"],
  ];

  for (const [path, label] of requiredHarnessPaths) {
    assertExists(path, label);
  }
}

function assertDockerAvailable(): void {
  const result = spawnSync("docker", ["version"], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(
      "Docker is required for Phase 3 smoke (mock E2E compile/test). Install Docker and retry.",
    );
  }
}

function assertBenchRun(): void {
  for (const caseId of MOCK_SMOKE_CASES) {
    const output = join(codebenchPkg, "results", `smoke-${caseId}.jsonl`);
    runCodebench([
      "run",
      "--provider",
      "mock",
      "--variant",
      "baseline",
      "--tasks",
      v1Tasks,
      "--case",
      caseId,
      "--output",
      output,
    ]);

    if (!existsSync(output)) {
      fail(`bench run did not write results (${output})`);
    }

    const line = readFileSync(output, "utf8").trim().split("\n")[0];
    if (!line) {
      fail(`bench run produced empty JSONL for ${caseId}`);
    }

    let result: {
      caseId?: string;
      compile?: { ok?: boolean };
      scores?: { rbrCase?: number; cptCase?: number };
    };
    try {
      result = JSON.parse(line) as typeof result;
    } catch {
      fail(`bench run JSONL is not valid JSON for ${caseId}`);
    }

    if (result.caseId !== caseId) {
      fail(`unexpected caseId in smoke result: ${result.caseId}`);
    }
    if (!result.compile?.ok) {
      fail(`smoke bench run: compile failed for ${caseId}`);
    }
    if (typeof result.scores?.rbrCase !== "number") {
      fail(`smoke bench run: missing scores.rbrCase for ${caseId}`);
    }
    if (result.scores.rbrCase > 0.01) {
      fail(
        `smoke bench run: expected clean RBR for ${caseId}, got ${result.scores.rbrCase}`,
      );
    }
  }
}

const requiredPaths: Array<[string, string]> = [
  [join(repoRoot, "README.md"), "README"],
  [join(repoRoot, "LICENSE"), "LICENSE"],
  [join(repoRoot, ".github", "workflows", "ci.yml"), "CI workflow"],
  [join(repoRoot, "docs", "design-notes.md"), "design notes"],
  [join(skillRoot, "README.md"), "skill README"],
  [skillRoot, "skill path"],
  [join(skillRoot, "examples"), "skill examples"],
  [
    join(repoRoot, "packages", "awesome-o-codebench", "src", "cli.ts"),
    "codebench CLI",
  ],
];

for (const [path, label] of requiredPaths) {
  assertExists(path, label);
}

assertSkillPackage();
assertHarnessLayout();
assertUnitTests();

const help = runCodebench(["--help"]);
if (!help.includes("awesome-o-codebench")) {
  fail("codebench --help missing expected output");
}

assertDockerAvailable();
assertBenchRun();

const validateCorpus = spawnSync(
  tsxBin,
  [join(repoRoot, "scripts", "validate-corpus.ts")],
  { cwd: repoRoot, encoding: "utf8" },
);
if (validateCorpus.status !== 0) {
  fail(
    `validate-corpus failed: ${validateCorpus.stderr || validateCorpus.stdout}`,
  );
}

console.log(
  `smoke: unit tests + ${MOCK_SMOKE_CASES.length} lane mock E2E + corpus validation passed`,
);
