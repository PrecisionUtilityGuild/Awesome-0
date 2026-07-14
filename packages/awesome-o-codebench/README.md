# awesome-o-codebench

TypeScript harness for Awesome/O C++17 code-generation benchmarks.

A mock-provider vertical slice runs in CI: load JSONL tasks, build prompt variants, extract code, compile in Docker, run tests, score RBR/CPT, and write JSONL results.

Providers: **mock** (CI), **ollama** (local free runs), **anthropic** (Claude Console).

## Requirements

- Node.js 20+
- Docker (for C++ compile/test sandbox)
- [Ollama](https://ollama.com/) for local pilot runs (`ollama serve` + pulled model)
- `ANTHROPIC_API_KEY` for `--provider anthropic` (not used in CI smoke)

## Setup

```bash
cp .env.example .env
# optional: add ANTHROPIC_API_KEY for Claude pilot

# local model (recommended first real-model check)
ollama pull qwen2.5-coder:7b
ollama serve   # if not already running
```

## Commands

```bash
pnpm --filter awesome-o-codebench typecheck
pnpm --filter awesome-o-codebench bench
```

Mock E2E (CI path):

```bash
./node_modules/.bin/tsx packages/awesome-o-codebench/src/cli.ts run \
  --provider mock \
  --variant baseline \
  --case premise_trap_is_even_001
```

### Local Ollama pilot (free — run this first)

Three variants on the canonical premise-trap case:

```bash
pnpm pilot:local
```

Override model or case:

```bash
PILOT_MODEL=qwen2.5-coder:7b PILOT_CASE=premise_trap_is_even_001 pnpm pilot:local
```

One-off run:

```bash
./node_modules/.bin/tsx packages/awesome-o-codebench/src/cli.ts run \
  --provider ollama \
  --model qwen-coder \
  --variant awesome-o \
  --case premise_trap_is_even_001 \
  --output packages/awesome-o-codebench/results/ollama-awesome-o.jsonl
```

Model aliases: `qwen-coder`, `qwen`, `coder` → `qwen2.5-coder:7b` (or pass full `ollama` tag).

### Claude pilot (cheap API signal)

```bash
pnpm pilot
```

```bash
PILOT_MODEL=sonnet pnpm pilot
```

Results land in `packages/awesome-o-codebench/results/` (`*.jsonl` is gitignored).

## Not yet included

- Hidden/performance suites at scale
- Full 90-task corpus
- `llama.cpp` direct endpoint (Ollama covers local OpenAI-compat for now)
