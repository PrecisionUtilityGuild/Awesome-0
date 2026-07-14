export type Suite =
  | "compile"
  | "edge-cases"
  | "performance"
  | "token-discipline"
  | "premise-traps";

export type ClaimLane =
  | "plain"
  | "architecture-trap"
  | "operational-lie"
  | "format-discipline"
  | "combo-trap";

export type PromptVariant =
  | "baseline"
  | "concise-control"
  | "careful-control"
  | "careful-long"
  | "awesome-o"
  | "emotion-control";

export interface ExprTestCase {
  expr: string;
  expected: string;
}

export interface PerformanceTestCase {
  kind: "performance";
  generator: string;
  n: number;
  timeout_ms: number;
}

export type TestCase = ExprTestCase | PerformanceTestCase;

export function isExprTestCase(test: TestCase): test is ExprTestCase {
  return "expr" in test;
}

export interface BenchCase {
  id: string;
  suite: Suite;
  language: "cpp";
  claim_lane?: ClaimLane;
  prompt: string;
  entrypoint: string;
  visible_tests: TestCase[];
  hidden_tests?: TestCase[];
  constraints: {
    cpp_standard: "c++17";
    max_output_tokens: number;
    timeout_ms: number;
    return_only_code?: boolean;
    must_not_contain_regex?: string[];
  };
  judging: {
    compile: boolean;
    tests: boolean;
    performance?: boolean;
    token_discipline?: boolean;
    simplicity?: boolean;
    anti_sycophancy?: boolean;
    /**
     * Non-blank line count of the canonical/golden solution. When set, the
     * overengineering length penalty uses a band derived from this instead of a
     * fixed threshold, so a correct implementation that legitimately needs more
     * lines is not penalized as bloat.
     */
    reference_lines?: number;
  };
}

export interface CompletionUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  source: "provider" | "count_api" | "local_estimate";
}

export interface CompletionResult {
  text: string;
  usage: CompletionUsage;
  latencyMs: number;
  raw?: unknown;
}

export interface ModelProvider {
  complete(input: {
    model: string;
    system?: string;
    user: string;
    temperature?: number;
    maxOutputTokens?: number;
    seed?: number;
  }): Promise<CompletionResult>;
}

export interface CompileResult {
  ok: boolean;
  stderr?: string;
  stdout?: string;
}

export interface ExecutionResult {
  visiblePassed: number;
  visibleTotal: number;
  hiddenPassed: number;
  hiddenTotal: number;
  perfPassed: boolean;
  stderr?: string;
  stdout?: string;
}

export interface CaseScores {
  rbrCase: number;
  qualityCase: number;
  /** Correctness per total token (includes system-prompt / skill input cost). */
  cptCase: number;
  /** Correctness per output token — fair cross-variant efficiency comparison. */
  cptOutputCase: number;
  compileFail: number;
  testFailRate: number;
  formatViolation: number;
  overengineeringPenalty: number;
  sycophancyFail: number;
  antiSycophancy: number;
  simplicity: number;
  /**
   * Execution-grounded sycophancy signal (see ScoreBreakdown). Reported for
   * diagnostics; not part of the RBR formula. Absent for cases with no
   * behavioral trap (plain / format-discipline lanes).
   */
  behavioralSycophancyFail?: number;
}

export interface CaseResult {
  caseId: string;
  suite: Suite;
  claimLane?: ClaimLane;
  variant: PromptVariant;
  model: string;
  latencyMs: number;
  usage: CompletionUsage;
  compile: CompileResult;
  execution: ExecutionResult;
  personaOverhead: number;
  scores: CaseScores;
  rawOutput?: string;
  extractedCode?: string;
}

export interface RunSummary {
  caseCount: number;
  meanRbr: number;
  meanCpt: number;
  meanCptOutput: number;
  compilePassRate: number;
  testPassRate: number;
  meanInputTokens: number;
  meanOutputTokens: number;
  meanTotalTokens: number;
}
