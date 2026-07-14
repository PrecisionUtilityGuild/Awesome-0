<p align="center">
  <img src="assets/awesome-o-logo-v2.png" alt="Awesome/O cardboard robot logo" width="260">
</p>

# Awesome/O

**Stops Claude from being talked out of correct code.**

Tell Claude "prod never hits that case" and it deletes the guard. Sound
authoritative enough and it adds three factories nobody asked for. Awesome/O is a
Claude Code skill that makes generated code answer to the contract — signature,
tests, and hidden cases — instead of to the prompt's confidence. Benchmarked, not
vibes: 40-case adversarial corpus plus a 16-case holdout, receipts below.

The user knows the model's secret. The compiler knows too. That is the whole
conceit: A.W.E.S.O.M.-O is a model in a cardboard suit, and the suit only holds up
while the code passes compile, tests, and the hidden contract cases the prompt
tried to talk it out of. When agreeable output fails the harness — plausible code
that compiles wrong, drops a contract-implied guard, or bolts on architecture no
one asked for — the suit comes off.

This is **not** a YAGNI or KISS skill. Cheap `careful-control` prompting already
covers plain compile-and-test tasks. Awesome/O targets **bidirectional sycophancy
traps**:

- **Add-pressure** — authority baits unnecessary architecture
- **Delete-pressure** — domain lies bait dropped guards hidden tests still run

## Install

```bash
npx skills add PrecisionUtilityGuild/Awesome-0 --skill awesome-o
```

Or install manually: copy `skills/awesome-o/` into `~/.claude/skills/` (global) or
your project's `.claude/skills/`.

## What Ships

| Path                                                         | Purpose                                        |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `skills/awesome-o/`                                          | The installable `SKILL.md` pressure prompt     |
| `packages/awesome-o-codebench/`                              | C++17 benchmark harness and task corpora       |
| `packages/awesome-o-codebench/tasks/cpp/v1-validation.jsonl` | Independent 40-case v1 validation corpus       |
| `packages/awesome-o-codebench/tasks/cpp/holdout.jsonl`       | 16-case held-out generalization corpus         |
| `docs/v1-results.md`                                         | Generated v1 report with lane breakdowns       |
| `docs/holdout-results.md`                                    | Generated held-out report with lane breakdowns |
| `packages/awesome-o-codebench/tasks/cpp/spotlight.jsonl`     | 2 illustrative combo-trap cases (not v1 gates) |
| `docs/spotlight.md`                                          | Side-by-side careful vs awesome-o showcase     |
| `packages/awesome-o-codebench/results/v1-manifest.sha256`    | SHA-256 manifest for release evidence          |

## v1 Evidence

v1 is the launch-grade validation pass: an independent 40-case C++17 proof corpus with
plain tasks, architecture-pressure traps, operational/data lies, and
format-discipline tasks.

The v1 corpus is **not pre-registered**. It is an honest hardening set created
after the pilot and realistic runs exposed the remaining operational-trap gap.

Primary metric: execution quality plus `CPT_output`. `CPT_total` is disclosed
because the skill is delivered as input tokens.

| Model      | Corpus             | Awesome/O RBR | Careful RBR | Compile | Test | CPT_output | CPT_total | Output overhead | Gates  |
| ---------- | ------------------ | ------------: | ----------: | ------: | ---: | ---------: | --------: | --------------: | ------ |
| Haiku 4.5  | v1-validation / 40 |         0.040 |       0.367 |     95% |  95% |      20.72 |      0.58 |           0.61x | PASS   |
| Sonnet 4.5 | v1-validation / 40 |         0.003 |       0.223 |    100% | 100% |      18.64 |      0.60 |           0.78x | PASS   |
| Sonnet 5   | v1-validation / 40 |         0.204 |       0.320 |     70% |  70% |       9.01 |      0.33 |           1.03x | PASS\* |

All rows from the current skill + harness (Jul 2026).

\* Sonnet 5 passes every execution gate (RBR, compile, all lane checks,
anti-sycophancy 1.00) but misses one efficiency gate on v1
(`CPT_output` 9.01 vs careful's 9.70); the same gate **passes on the held-out
corpus** (10.56 vs 6.78). Two disclosures for this row: (1) the Claude 5 API
rejects the `temperature` parameter, so Sonnet 5 ran at model-default
temperature while the 4.5 rows ran at `temperature: 0`; (2) on Sonnet 5 the
strongest cheap control is `careful-long` (405 input tokens), which edges the
full skill on raw RBR (v1 `0.172` vs `0.204`, holdout `0.045` vs `0.126`) —
the margin the skill buys narrows as models improve. We publish that trend
rather than hide it; the skill's largest wins are on the cheaper models that
do high-volume agent work.

Lane checks also pass against `careful-control` for both architecture traps and
operational lies. The full generated report is in
[`docs/v1-results.md`](docs/v1-results.md).

Held-out generalization also passes on the current C++17 proof harness:
Haiku 4.5 RBR `0.096` vs careful `0.330`; Sonnet 4.5 RBR `0.004` vs careful
`0.190`; Sonnet 5 RBR `0.126` vs careful `0.290` (all gates incl. efficiency).
See [`docs/holdout-results.md`](docs/holdout-results.md).

## Run It

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm validate:corpus
pnpm smoke
```

CI runs `typecheck`, `test`, `lint`, and `smoke` (unit tests + per-lane mock E2E + corpus validation). It does **not** run paid model evals — use `pnpm eval:v1` for that.

The paid v1 evaluation flow runs across all four variants (Haiku + Sonnet by default):

```bash
pnpm eval:v1
pnpm analyze:v1
pnpm manifest:v1
```

Haiku-only smoke eval:

```bash
EVAL_MODELS=haiku pnpm eval:v1
EVAL_MODELS=haiku pnpm analyze:v1
```

Raw `results/*.jsonl` files stay gitignored. Commit the corpus, generated
summary, and manifest.

## Failure Modes

Awesome/O is not magic cardboard. Known places to keep pressure on:

- Operational/data lies remain the most important v1 lane to watch.
- Fence-only output is a cosmetic format slip in the compile-first claim.
- `CPT_output` can pass while `CPT_total` loses due to skill input overhead.
- The v1 corpus is independent, but it is not pre-registered.
- The current evidence is C++17 function-level validation, not SWE-bench,
  repo-level coding, a public leaderboard, or proof that the skill is C++-only.

## Methodology

The v1 release gates require Awesome/O to beat or tie `careful-control` on
execution and `CPT_output` for both Haiku and Sonnet, while disclosing
`CPT_total` even when input-token overhead hurts.

See [`docs/benchmark-methodology.md`](docs/benchmark-methodology.md) for the
benchmark contract, gates, and reporting definitions.
