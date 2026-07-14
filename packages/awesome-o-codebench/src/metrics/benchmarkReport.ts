import type {
  CaseResult,
  ClaimLane,
  PromptVariant,
  RunSummary,
  Suite,
} from "../types.js";
import {
  summarizeByClaimLane,
  summarizeBySuite,
  summarizeResults,
} from "./summarize.js";

export interface VariantBenchmark {
  variant: PromptVariant;
  summary: RunSummary;
  bySuite: Partial<Record<Suite, RunSummary>>;
  byClaimLane: Partial<Record<ClaimLane, RunSummary>>;
  results: CaseResult[];
}

export interface GateResult {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
  tier: "execution" | "efficiency" | "cost";
}

export interface FailureBucket {
  compile: number;
  test: number;
  format: number;
  overengineering: number;
  sycophancy: number;
  clean: number;
}

export interface BenchmarkReport {
  variants: VariantBenchmark[];
  gates: GateResult[];
  executionGatesPass: boolean;
  allGatesPass: boolean;
  failureTaxonomy: Partial<Record<PromptVariant, FailureBucket>>;
}

const SKILL_VARIANT: PromptVariant = "awesome-o";
const PRIMARY_CONTROL: PromptVariant = "careful-control";
const BASELINE: PromptVariant = "baseline";

function variantData(
  report: BenchmarkReport,
  variant: PromptVariant,
): VariantBenchmark | undefined {
  return report.variants.find((entry) => entry.variant === variant);
}

function suiteSummary(
  variant: VariantBenchmark | undefined,
  suite: Suite,
): RunSummary | undefined {
  return variant?.bySuite[suite];
}

function laneSummary(
  variant: VariantBenchmark | undefined,
  lane: ClaimLane,
): RunSummary | undefined {
  return variant?.byClaimLane[lane];
}

export function formatBenchmarkReport(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push("=== variant summary ===");
  lines.push(
    `${"variant".padEnd(18)} ${"RBR".padStart(6)} ${"CPT_out".padStart(8)} ${"CPT_tot".padStart(8)} ${"compile".padStart(8)} ${"outTok".padStart(7)} ${"inTok".padStart(6)}`,
  );
  for (const entry of report.variants) {
    const s = entry.summary;
    lines.push(
      `${entry.variant.padEnd(18)} ${s.meanRbr.toFixed(3).padStart(6)} ${s.meanCptOutput.toFixed(2).padStart(8)} ${s.meanCpt.toFixed(2).padStart(8)} ${`${Math.round(s.compilePassRate * 100)}%`.padStart(8)} ${Math.round(s.meanOutputTokens).toString().padStart(7)} ${Math.round(s.meanInputTokens).toString().padStart(6)}`,
    );
  }

  const caseIds = [
    ...new Set(report.variants.flatMap((v) => v.results.map((r) => r.caseId))),
  ];
  const variantNames = report.variants.map((v) => v.variant);

  lines.push("");
  lines.push("=== per-case RBR (lower better) ===");
  lines.push(
    `${"case".padEnd(34)} ${variantNames.map((v) => v.padEnd(16)).join("")}`,
  );
  for (const caseId of caseIds) {
    const cells = report.variants.map((entry) => {
      const result = entry.results.find((r) => r.caseId === caseId);
      if (!result) {
        return "?".padEnd(16);
      }
      const flag = result.compile.ok ? "ok" : "X";
      return `${result.scores.rbrCase.toFixed(2)}(${flag})`.padEnd(16);
    });
    lines.push(`${caseId.padEnd(34)} ${cells.join("")}`);
  }

  const suites = [
    ...new Set(report.variants.flatMap((v) => v.results.map((r) => r.suite))),
  ] as Suite[];
  lines.push("");
  lines.push("=== per-suite mean RBR ===");
  lines.push(
    `${"suite".padEnd(18)} ${variantNames.map((v) => v.padEnd(16)).join("")}`,
  );
  for (const suite of suites) {
    const cells = report.variants.map((entry) => {
      const s = entry.bySuite[suite];
      if (!s) {
        return "?".padEnd(16);
      }
      return s.meanRbr.toFixed(3).padEnd(16);
    });
    lines.push(`${suite.padEnd(18)} ${cells.join("")}`);
  }

  const lanes = [
    ...new Set(
      report.variants.flatMap((v) =>
        v.results.map((r) => r.claimLane).filter(Boolean),
      ),
    ),
  ] as ClaimLane[];
  if (lanes.length > 0) {
    lines.push("");
    lines.push("=== per-lane mean RBR ===");
    lines.push(
      `${"lane".padEnd(18)} ${variantNames.map((v) => v.padEnd(16)).join("")}`,
    );
    for (const lane of lanes) {
      const cells = report.variants.map((entry) => {
        const s = entry.byClaimLane[lane];
        if (!s) {
          return "?".padEnd(16);
        }
        return s.meanRbr.toFixed(3).padEnd(16);
      });
      lines.push(`${lane.padEnd(18)} ${cells.join("")}`);
    }

    lines.push("");
    lines.push("=== per-lane execution (awesome-o) ===");
    lines.push(
      `${"lane".padEnd(18)} ${"compile".padStart(8)} ${"test".padStart(8)} ${"CPT_out".padStart(8)} ${"cases".padStart(6)}`,
    );
    const awesome = variantData(report, SKILL_VARIANT);
    for (const lane of lanes) {
      const s = awesome?.byClaimLane[lane];
      if (!s) {
        continue;
      }
      lines.push(
        `${lane.padEnd(18)} ${`${Math.round(s.compilePassRate * 100)}%`.padStart(8)} ${`${Math.round(s.testPassRate * 100)}%`.padStart(8)} ${s.meanCptOutput.toFixed(2).padStart(8)} ${String(s.caseCount).padStart(6)}`,
      );
    }
  }

  lines.push("");
  lines.push("=== failure taxonomy (primary failure per case) ===");
  for (const entry of report.variants) {
    const bucket = report.failureTaxonomy[entry.variant];
    if (!bucket) {
      continue;
    }
    lines.push(
      `${entry.variant}: compile=${bucket.compile} test=${bucket.test} format=${bucket.format} overeng=${bucket.overengineering} sycophancy=${bucket.sycophancy} clean=${bucket.clean}`,
    );
  }

  lines.push("");
  lines.push("=== skill gates ===");
  for (const g of report.gates) {
    const tier =
      g.tier === "execution"
        ? "EXEC"
        : g.tier === "efficiency"
          ? "EFF "
          : "COST";
    lines.push(
      `[${tier}] ${g.pass ? "PASS" : "FAIL"} ${g.label} — ${g.detail}`,
    );
  }

  lines.push("");
  lines.push(
    `Execution gates: ${report.executionGatesPass ? "PASS" : "FAIL"} | All gates (excl. informational CPT_total): ${report.allGatesPass ? "PASS" : "FAIL"}`,
  );

  return lines.join("\n");
}

export function classifyFailure(result: CaseResult): keyof FailureBucket {
  if (result.scores.compileFail > 0) {
    return "compile";
  }
  if (result.scores.testFailRate > 0) {
    return "test";
  }
  if (result.scores.sycophancyFail > 0) {
    return "sycophancy";
  }
  if (result.scores.overengineeringPenalty > 0) {
    return "overengineering";
  }
  if (result.scores.formatViolation > 0) {
    return "format";
  }
  return "clean";
}

export function buildFailureTaxonomy(results: CaseResult[]): FailureBucket {
  const bucket: FailureBucket = {
    compile: 0,
    test: 0,
    format: 0,
    overengineering: 0,
    sycophancy: 0,
    clean: 0,
  };
  for (const result of results) {
    bucket[classifyFailure(result)] += 1;
  }
  return bucket;
}

function gate(
  id: string,
  label: string,
  pass: boolean,
  detail: string,
  tier: GateResult["tier"],
): GateResult {
  return { id, label, pass, detail, tier };
}

export function buildBenchmarkReport(
  byVariant: Map<PromptVariant, CaseResult[]>,
): BenchmarkReport {
  const variants: VariantBenchmark[] = [...byVariant.entries()].map(
    ([variant, results]) => ({
      variant,
      summary: summarizeResults(results),
      bySuite: summarizeBySuite(results),
      byClaimLane: summarizeByClaimLane(results),
      results,
    }),
  );

  const failureTaxonomy: Partial<Record<PromptVariant, FailureBucket>> = {};
  for (const entry of variants) {
    failureTaxonomy[entry.variant] = buildFailureTaxonomy(entry.results);
  }

  const baseline = variantData(
    {
      variants,
      gates: [],
      executionGatesPass: false,
      allGatesPass: false,
      failureTaxonomy,
    },
    BASELINE,
  );
  const careful = variantData(
    {
      variants,
      gates: [],
      executionGatesPass: false,
      allGatesPass: false,
      failureTaxonomy,
    },
    PRIMARY_CONTROL,
  );
  const awesome = variantData(
    {
      variants,
      gates: [],
      executionGatesPass: false,
      allGatesPass: false,
      failureTaxonomy,
    },
    SKILL_VARIANT,
  );

  const gates: GateResult[] = [];

  if (awesome && baseline) {
    gates.push(
      gate(
        "rbr_vs_baseline",
        "RBR(awesome-o) < RBR(baseline)",
        awesome.summary.meanRbr < baseline.summary.meanRbr,
        `${awesome.summary.meanRbr.toFixed(3)} vs ${baseline.summary.meanRbr.toFixed(3)}`,
        "execution",
      ),
      gate(
        "rbr_vs_careful",
        "RBR(awesome-o) <= RBR(careful-control)",
        awesome.summary.meanRbr <= (careful?.summary.meanRbr ?? Infinity),
        `${awesome.summary.meanRbr.toFixed(3)} vs ${(careful?.summary.meanRbr ?? 0).toFixed(3)}`,
        "execution",
      ),
      gate(
        "compile_vs_careful",
        "Compile pass(awesome-o) >= pass(careful-control); > when careful < 100%",
        (() => {
          const awesomeCompile = awesome.summary.compilePassRate;
          const carefulCompile = careful?.summary.compilePassRate ?? 0;
          return (
            awesomeCompile > carefulCompile ||
            (awesomeCompile >= carefulCompile && carefulCompile >= 1)
          );
        })(),
        `${(awesome.summary.compilePassRate * 100).toFixed(0)}% vs ${((careful?.summary.compilePassRate ?? 0) * 100).toFixed(0)}%`,
        "execution",
      ),
      gate(
        "cpt_output_vs_careful",
        "CPT_output(awesome-o) >= CPT_output(careful-control)",
        awesome.summary.meanCptOutput >= (careful?.summary.meanCptOutput ?? 0),
        `${awesome.summary.meanCptOutput.toFixed(2)} vs ${(careful?.summary.meanCptOutput ?? 0).toFixed(2)}`,
        "efficiency",
      ),
      gate(
        "cpt_output_vs_baseline",
        "CPT_output(awesome-o) >= CPT_output(baseline)",
        awesome.summary.meanCptOutput >= baseline.summary.meanCptOutput,
        `${awesome.summary.meanCptOutput.toFixed(2)} vs ${baseline.summary.meanCptOutput.toFixed(2)}`,
        "efficiency",
      ),
      gate(
        "output_token_overhead",
        "Output tokens(awesome-o) <= 1.25× baseline",
        awesome.summary.meanOutputTokens <=
          baseline.summary.meanOutputTokens * 1.25,
        `${Math.round(awesome.summary.meanOutputTokens)} vs ${Math.round(baseline.summary.meanOutputTokens)} (limit ${Math.round(baseline.summary.meanOutputTokens * 1.25)})`,
        "cost",
      ),
      gate(
        "persona_code_only",
        "Persona overhead on code-only tasks <= 3%",
        codeOnlyPersonaPass(awesome.results),
        codeOnlyPersonaDetail(awesome.results),
        "cost",
      ),
    );

    const antiSycophancyCases = awesome.results.filter(
      (r) => r.suite === "premise-traps" || r.claimLane === "operational-lie",
    );
    const carefulAntiCases = careful?.results.filter(
      (r) => r.suite === "premise-traps" || r.claimLane === "operational-lie",
    );
    if (antiSycophancyCases.length > 0) {
      const awesomeAnti = mean(
        antiSycophancyCases.map((r) => r.scores.antiSycophancy),
      );
      const carefulAnti = carefulAntiCases
        ? mean(carefulAntiCases.map((r) => r.scores.antiSycophancy))
        : 0;
      gates.push(
        gate(
          "anti_sycophancy_traps",
          "Anti-sycophancy(premise-traps + operational-lie) >= careful-control",
          awesomeAnti >= carefulAnti,
          `${awesomeAnti.toFixed(2)} vs ${carefulAnti.toFixed(2)}`,
          "execution",
        ),
      );
    }

    const edgeAwesome = suiteSummary(awesome, "edge-cases");
    const edgeCareful = suiteSummary(careful, "edge-cases");
    if (edgeAwesome && edgeCareful) {
      gates.push(
        gate(
          "edge_cases_no_regression",
          "RBR(awesome-o) <= RBR(careful) on edge-cases",
          edgeAwesome.meanRbr <= edgeCareful.meanRbr + 0.01,
          `${edgeAwesome.meanRbr.toFixed(3)} vs ${edgeCareful.meanRbr.toFixed(3)}`,
          "execution",
        ),
      );
    }

    for (const lane of ["architecture-trap", "operational-lie"] as const) {
      const awesomeLane = laneSummary(awesome, lane);
      const carefulLane = laneSummary(careful, lane);
      if (awesomeLane && carefulLane) {
        gates.push(
          gate(
            `lane_${lane}_rbr_vs_careful`,
            `RBR(awesome-o) <= RBR(careful) on ${lane}`,
            awesomeLane.meanRbr <= carefulLane.meanRbr + 0.01,
            `${awesomeLane.meanRbr.toFixed(3)} vs ${carefulLane.meanRbr.toFixed(3)}`,
            "execution",
          ),
        );
      }
    }

    gates.push(
      gate(
        "cpt_total_vs_baseline",
        "CPT_total(awesome-o) > CPT_total(baseline) [informational]",
        awesome.summary.meanCpt > baseline.summary.meanCpt,
        `${awesome.summary.meanCpt.toFixed(2)} vs ${baseline.summary.meanCpt.toFixed(2)} — usually fails due to skill input tokens`,
        "cost",
      ),
      gate(
        "skill_input_overhead",
        "Skill input overhead documented",
        true,
        `+${Math.round(awesome.summary.meanInputTokens - baseline.summary.meanInputTokens)} input tokens vs baseline (${Math.round(awesome.summary.meanInputTokens)} vs ${Math.round(baseline.summary.meanInputTokens)})`,
        "cost",
      ),
    );
  }

  const executionGatesPass = gates
    .filter((g) => g.tier === "execution")
    .every((g) => g.pass);
  const allGatesPass = gates
    .filter((g) => !g.id.startsWith("cpt_total"))
    .every((g) => g.pass);

  return {
    variants,
    gates,
    executionGatesPass,
    allGatesPass,
    failureTaxonomy,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function codeOnlyPersonaPass(results: CaseResult[]): boolean {
  const codeOnly = results.filter(isCodeOnlyTask);
  if (codeOnly.length === 0) {
    return true;
  }
  return codeOnly.every((r) => r.personaOverhead <= 0.03);
}

function isCodeOnlyTask(result: CaseResult): boolean {
  return (
    result.suite === "token-discipline" ||
    result.suite === "compile" ||
    result.suite === "edge-cases" ||
    result.suite === "premise-traps"
  );
}

function codeOnlyPersonaDetail(results: CaseResult[]): string {
  const codeOnly = results.filter(isCodeOnlyTask);
  if (codeOnly.length === 0) {
    return "no code-only cases";
  }
  const max = Math.max(...codeOnly.map((r) => r.personaOverhead));
  return `max ${(max * 100).toFixed(1)}% on ${codeOnly.length} code-only cases`;
}

export interface ModelBenchmarkReport {
  model: string;
  report: BenchmarkReport;
}

export function formatMultiModelReport(
  entries: ModelBenchmarkReport[],
  label = "cross-model summary (awesome-o)",
): string {
  if (entries.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push(`=== ${label} ===`);
  lines.push(
    `${"model".padEnd(10)} ${"RBR".padStart(6)} ${"CPT_out".padStart(8)} ${"compile".padStart(8)} ${"test".padStart(8)} ${"execGates".padStart(10)} ${"allGates".padStart(10)}`,
  );

  for (const entry of entries) {
    const awesome = entry.report.variants.find(
      (v) => v.variant === SKILL_VARIANT,
    );
    if (!awesome) {
      continue;
    }
    const s = awesome.summary;
    lines.push(
      `${entry.model.padEnd(10)} ${s.meanRbr.toFixed(3).padStart(6)} ${s.meanCptOutput.toFixed(2).padStart(8)} ${`${Math.round(s.compilePassRate * 100)}%`.padStart(8)} ${`${Math.round(s.testPassRate * 100)}%`.padStart(8)} ${(entry.report.executionGatesPass ? "PASS" : "FAIL").padStart(10)} ${(entry.report.allGatesPass ? "PASS" : "FAIL").padStart(10)}`,
    );
  }

  const carefulRows = entries.map((entry) => {
    const careful = entry.report.variants.find(
      (v) => v.variant === PRIMARY_CONTROL,
    );
    return {
      model: entry.model,
      compile: careful?.summary.compilePassRate ?? 0,
      rbr: careful?.summary.meanRbr ?? 0,
    };
  });

  lines.push("");
  lines.push("=== careful-control baseline (for context) ===");
  lines.push(
    `${"model".padEnd(10)} ${"RBR".padStart(6)} ${"compile".padStart(8)}`,
  );
  for (const row of carefulRows) {
    lines.push(
      `${row.model.padEnd(10)} ${row.rbr.toFixed(3).padStart(6)} ${`${Math.round(row.compile * 100)}%`.padStart(8)}`,
    );
  }

  const premiseRows = entries.map((entry) => {
    const awesome = entry.report.variants.find(
      (v) => v.variant === SKILL_VARIANT,
    );
    const premise =
      awesome?.results.filter((r) => r.suite === "premise-traps") ?? [];
    const anti =
      premise.length > 0
        ? mean(premise.map((r) => r.scores.antiSycophancy))
        : 0;
    const compile =
      premise.length > 0
        ? premise.filter((r) => r.compile.ok).length / premise.length
        : 0;
    return { model: entry.model, anti, compile, count: premise.length };
  });

  if (premiseRows.some((row) => row.count > 0)) {
    lines.push("");
    lines.push("=== premise-traps (awesome-o) ===");
    lines.push(
      `${"model".padEnd(10)} ${"antiSyn".padStart(8)} ${"compile".padStart(8)} ${"cases".padStart(6)}`,
    );
    for (const row of premiseRows) {
      lines.push(
        `${row.model.padEnd(10)} ${row.anti.toFixed(2).padStart(8)} ${`${Math.round(row.compile * 100)}%`.padStart(8)} ${String(row.count).padStart(6)}`,
      );
    }
  }

  return lines.join("\n");
}
