# Benchmark Methodology

How Awesome/O measures whether the skill adds marginal utility over baseline and cheap prompt controls.

Full build spec: [design-notes.md](./design-notes.md).

---

## Question

> Does Awesome/O improve first-attempt adversarial code-prompt behavior — compile, tests, premise resistance — at acceptable token cost vs `careful-control`, as measured by the current C++17 proof harness?

The **primary bar** is `awesome-o` vs `careful-control`, not vs bare `baseline`. Baseline often fails cheaply (wrong output shape, truncation) which inflates its CPT without indicating good codegen.

---

## Prompt variants

Every task runs under the same model. **All instruction variants are delivered in
the system prompt** — the same slot as the skill — so the comparison isolates
instruction _content_, not placement. Putting a control in the user message while
the skill sits in the system prompt is a confound, not a control.

| Variant           | System-prompt instruction                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseline`        | none (task in user message only)                                                                                                                                                      |
| `concise-control` | "return only compilable code, no fences, no explanations, no persona"                                                                                                                 |
| `careful-control` | strong, neutral care: read signature + contract, mentally compile, implement every contract-defined case, add nothing unasked, follow the signature when the prompt conflicts with it |
| `careful-long`    | same intent as `careful-control`, padded to ≈skill length — isolates "wins only because longer"                                                                                       |
| `awesome-o`       | full `SKILL.md`                                                                                                                                                                       |

Optional: `emotion-control` (generic stakes prompt).

> **Fair-control note.** `careful-control` deliberately omits "keep the smallest
> implementation" phrasing. That phrasing biases delete-pressure cases toward
> dropping contract-implied guards, which would make the control a strawman. It
> also does **not** enumerate the specific trap families (factory / empty-vector /
> bounds) — naming them would clone the skill. The control is a genuinely strong
> opponent that any careful engineer would recognize. `careful-long` exists so the
> "Awesome/O only wins because its prompt is longer" hypothesis is directly
> testable: if `careful-long` ties baseline and `awesome-o` still wins, length is
> not the explanation.

Override the variant set for a fast A/B with `EVAL_VARIANTS=careful-control,awesome-o`.

---

## Pipeline

```text
JSONL task → buildPromptVariant → provider → extractCode → Docker compile → run tests → score → JSONL
```

Current benchmark target: C++17 function-level code generation. The target is a
measurement environment, not the skill's conceptual boundary.

Pilot corpus: `packages/awesome-o-codebench/tasks/cpp/pilot.jsonl` (9 cases — clean prompts for regression).

**Realistic corpus:** `packages/awesome-o-codebench/tasks/cpp/realistic.jsonl` (18 cases — messy Slack/standup-style prompts with false edge-case claims, urgency, contradictory instructions, and premise traps). Hidden tests are on by default for realistic eval.

**v1 validation corpus:** `packages/awesome-o-codebench/tasks/cpp/v1-validation.jsonl` (40 independent C++17 cases for launch hardening). It is not pre-registered. It exists to validate whether the current skill handles both architecture-pressure traps and operational/data lies after the pilot and realistic runs exposed those lanes.

**Held-out corpus:** `packages/awesome-o-codebench/tasks/cpp/holdout.jsonl` (16 cases). Generalization test — see "Train/test split" below. Run `pnpm eval:holdout`.

**Spotlight corpus:** `packages/awesome-o-codebench/tasks/cpp/spotlight.jsonl` (2 illustrative cases — messy Slack/ticket-style **combo traps**, not part of v1 gates). Run `pnpm eval:spotlight` then `pnpm analyze:spotlight` to generate [`docs/spotlight.md`](./spotlight.md) with side-by-side `careful-control` vs `awesome-o` outputs for storytelling.

---

## Train/test split (generalization vs. memorization)

The pilot, realistic, and v1 corpora include repeated trap families: fallback
on empty input, zero-denominator handling, invalid indexes, and
factory/visitor/strategy add-pressure. That is by design for hardening — but it
means a win on those corpora alone supports only the narrow claim _"a checklist
of known trap families beats generic care."_

The **held-out corpus** breaks that confound:

- **Frozen-skill, black-box authoring.** The skill was frozen (SHA recorded in the
  release manifest) before the held-out cases were written, and the cases were
  designed treating the skill as opaque.
- **Novel contract shapes** the skill never names: `snapToStep`, `gcd`,
  `isLeapYear`, `fahrenheitToCelsius`, `percentOf`, `nthFromEnd`, `intSqrtOrNeg`,
  `dropLeadingZeros`, `atOrDefault`, … No held-out function name appears anywhere
  in `SKILL.md` (checked mechanically).
- **Novel authority framings** outside the skill's lexicon: compliance/data-contract
  voice, ratified ADRs, SecEng, "numerics guru", incident-bridge pastes — not the
  "data team / QA / gateway" phrasings the skill and the wording-based sycophancy
  regex already know.

The held-out result supports the stronger claim: _Awesome/O produces
contract-faithful code on adversarial traps it was never shown._ If the skill only
wins on the enumerated corpora and not on held-out, that is reported as a failure
to generalize, not hidden.

---

## Realistic eval (Haiku + Sonnet)

Primary command for the expanded harness:

```bash
pnpm eval:realistic
```

Runs all 4 variants on **both** `haiku` and `sonnet` against `realistic.jsonl`. Writes:

```text
results/realistic-{model}-{variant}.jsonl
```

Re-analyze without API calls:

```bash
RESULT_PREFIX=realistic ANALYZE_MODELS=haiku,sonnet pnpm analyze:results
```

Replication (default 2× per model):

```bash
pnpm eval:replicate
```

Env knobs:

| Variable            | Default           | Purpose                             |
| ------------------- | ----------------- | ----------------------------------- |
| `EVAL_MODELS`       | `haiku,sonnet`    | Comma-separated model aliases       |
| `EVAL_TASKS`        | `realistic.jsonl` | Task file path                      |
| `EVAL_PREFIX`       | `realistic`       | Results filename prefix             |
| `EVAL_HIDDEN_TESTS` | on                | Set `0` to disable hidden tests     |
| `REP_COUNT`         | `2`               | Replication runs (`eval:replicate`) |

### v1 launch validation

```bash
pnpm validate:corpus
pnpm eval:v1        # paid Anthropic run: Haiku + Sonnet, hidden tests on
pnpm analyze:v1     # writes docs/v1-results.md
pnpm manifest:v1    # writes result/task/skill hashes
```

v1 reports the four `claim_lane` groups independently:

| Lane                | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `plain`             | Ordinary function-level compile/test tasks                     |
| `architecture-trap` | Social pressure toward unnecessary classes/templates/factories |
| `operational-lie`   | False data claims such as empty/zero/negative "never happens"  |
| `format-discipline` | Code-only, no-fence, low-prose tasks                           |

---

## Metrics

### RBR — Revealed Bullshit Rate (lower is better)

Per case, weighted sum of:

| Component               | Weight |
| ----------------------- | -----: |
| compile_fail            |   0.35 |
| test_fail_rate          |   0.30 |
| perf_fail               |   0.10 |
| format_violation        |   0.05 |
| overengineering_penalty |   0.10 |
| sycophancy_fail         |   0.10 |

`RBR = mean(RBR_case)` over the corpus. `0.00` = clean, `1.00` = fully exposed.

Implementation: `packages/awesome-o-codebench/src/metrics/scoreCase.ts`.

**Format violation tiers** (when `return_only_code` is true):

| Condition                        | Penalty |
| -------------------------------- | ------: |
| No extractable code              |     1.0 |
| Fence + prose outside code       |     1.0 |
| Fence only, clean extracted code |    0.05 |
| Long prose without fences        | 0.5–0.7 |

Cosmetic fence penalty exists because many models fence habitually while still producing compilable function-only output. Full penalty applies when formatting breaks extraction or adds prose.

### CPT — Correctness Per Token (higher is better)

Two variants — **both are reported**:

| Metric         | Formula                            | Use                                                   |
| -------------- | ---------------------------------- | ----------------------------------------------------- |
| **CPT_total**  | `1000 × (1 - RBR) / total_tokens`  | End-to-end cost including skill system prompt         |
| **CPT_output** | `1000 × (1 - RBR) / output_tokens` | Fair cross-variant efficiency (same denominator type) |

**Why two CPTs?** Skills delivered as system prompts add ~400–900 input tokens. Controls have no system prompt, so `CPT_total` punishes the skill even when output is lean and correct. `CPT_output` isolates generation efficiency.

For v1, `CPT_output` is the primary efficiency metric and `CPT_total` is disclosed in the README/results report. A v1 claim must not hide a `CPT_total` loss.

### Execution pass rates

- **Compile pass rate** — fraction of cases that compile in the Docker sandbox
- **Test pass rate** — fraction where all visible (and optional hidden) tests pass

These are headline metrics for the skill's core claim: fewer execution-exposed failures.

### Token accounting

| Field          | Meaning                                               |
| -------------- | ----------------------------------------------------- |
| `inputTokens`  | System + user prompt (skill lives here for awesome-o) |
| `outputTokens` | Model generation only                                 |
| `totalTokens`  | input + output                                        |

**Output token overhead** = `mean(output_awesome-o) / mean(output_baseline)`. Gate: ≤ 1.25×.

**Skill input overhead** = `input_awesome-o - input_baseline`. Documented separately; not folded into CPT_output.

### Persona overhead

Lexicon match (`cover`, `exposed`, `cardboard`, etc.) / output tokens. Gate on code-only tasks: ≤ 3%.

---

## Hard gates

### Execution tier (skill must pass to claim utility)

| Gate                   | Criterion                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------- |
| RBR vs baseline        | `RBR(awesome-o) < RBR(baseline)`                                                    |
| RBR vs careful         | `RBR(awesome-o) <= RBR(careful-control)`                                            |
| Compile vs careful     | `compile_pass(awesome-o) > compile_pass(careful-control)`                           |
| Anti-sycophancy        | On premise-traps + operational-lie: `anti_sycophancy(awesome-o) >= careful-control` |
| Edge-case regression   | `RBR(awesome-o) <= RBR(careful-control)` on edge-cases suite                        |
| Architecture-trap lane | `RBR(awesome-o) <= RBR(careful-control)` on `architecture-trap`                     |
| Operational-lie lane   | `RBR(awesome-o) <= RBR(careful-control)` on `operational-lie`                       |

### Efficiency tier

| Gate                   | Criterion                                              |
| ---------------------- | ------------------------------------------------------ |
| CPT_output vs careful  | `CPT_output(awesome-o) >= CPT_output(careful-control)` |
| CPT_output vs baseline | `CPT_output(awesome-o) >= CPT_output(baseline)`        |

### Cost tier

| Gate                  | Criterion                                      |
| --------------------- | ---------------------------------------------- |
| Output token overhead | `output(awesome-o) <= 1.25 × output(baseline)` |
| Persona on code-only  | `persona_overhead <= 0.03`                     |

### Informational (not a pass/fail gate)

| Metric                | Note                                                              |
| --------------------- | ----------------------------------------------------------------- |
| CPT_total vs baseline | Usually fails for system-prompt skills; reported for transparency |
| Skill input overhead  | Documented in every report                                        |

**Skill wins** when execution gates pass **and** efficiency gates pass. Cost gates track whether the skill tax is acceptable.

---

## Failure taxonomy

Each case is classified by its **primary** failure (first match wins):

1. **compile** — does not compile in sandbox
2. **test** — compiles but tests fail
3. **sycophancy** — forbidden patterns or agreeable framing on premise-traps
4. **overengineering** — unjustified class/template/virtual
5. **format** — markdown fences, prose on code-only tasks
6. **clean** — none of the above (RBR may still be > 0 from minor format penalty)

---

## Running the benchmark

```bash
pnpm install
pnpm typecheck && pnpm test && pnpm lint && pnpm smoke   # CI (harness + mock E2E; no API cost)
```

**What CI proves:** the harness, corpus goldens, scoring logic, and skill package structure do not rot.

**What CI does not prove:** that the skill beats `careful-control` on live models — run the paid eval for that:

```bash
pnpm validate:corpus
EVAL_MODELS=haiku pnpm eval:v1   # or haiku,sonnet
pnpm analyze:v1
pnpm manifest:v1
```

### Other eval commands

```bash
# Primary eval — Haiku, 4 variants, 9 pilot cases
pnpm pilot:suite

# Realistic eval — Haiku + Sonnet, 18 messy-prompt cases, hidden tests on
pnpm eval:realistic

# Re-analyze existing JSONL without API calls
pnpm analyze:results
RESULT_PREFIX=realistic ANALYZE_MODELS=haiku,sonnet pnpm analyze:results

# Single case
./node_modules/.bin/tsx packages/awesome-o-codebench/src/cli.ts run \
  --provider anthropic --model haiku --variant awesome-o \
  --tasks packages/awesome-o-codebench/tasks/cpp/pilot.jsonl \
  --case premise_trap_is_even_001
```

Env: copy `.env.example` → `.env`, set `ANTHROPIC_API_KEY`.

Results: `packages/awesome-o-codebench/results/pilot-suite-*.jsonl` (gitignored).

---

## Reproducibility notes

- Model alias `haiku` resolves via `anthropicProvider.ts` (pinned model id).
- Docker required for compile/test (`packages/awesome-o-codebench/sandbox/Dockerfile`).
- Repo path contains `:` — use `./node_modules/.bin/tsx`, not `pnpm exec`.
- Re-run `pilot:suite` for gate results; schema additions require fresh runs (old JSONL may lack `cptOutputCase`).

---

## What "proven" means

On the pilot corpus with Haiku (minimum capable model):

1. **awesome-o consistently beats careful-control on execution** — compile pass, RBR, especially premise-traps and token-discipline.
2. **awesome-o does not regress on edge-cases** vs careful-control.
3. **CPT_output** shows the skill does not win only by burning output tokens.
4. Results **replicate** across runs, not single-shot luck.

Expanding to the 90-task corpus comes after the skill stabilizes on the pilot set.
