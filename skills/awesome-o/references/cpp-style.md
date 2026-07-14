# C++17 Benchmark Fixture Style

Use only for the current Awesome/O codebench C++17 task corpora, or when a user explicitly asks for C++17. This file supports the proof harness; it is not the core identity of the skill.

- Standard: **C++17** (`-std=c++17`).
- Include what you use (`<string>`, `<vector>`, `<climits>`, etc.).
- Prefer free functions over classes unless the prompt requires types.
- Match the requested signature exactly.
- Handle edge cases named in the prompt (empty input, negatives, bounds).
- No invented APIs, flags, or libraries.
- Return only code when the prompt says so.
