// Analyze the held-out eval into docs/holdout-results.md, reusing the v1
// analyzer with holdout-specific prefix/label/output. See the "Train/test split"
// section in docs/benchmark-methodology.md for what this corpus proves.
process.env.ANALYZE_PREFIX ??= "holdout";
process.env.ANALYZE_CORPUS_LABEL ??= "holdout / 16";
process.env.ANALYZE_TITLE ??= "Awesome/O Held-Out Generalization Results";
process.env.ANALYZE_OUTPUT ??= "docs/holdout-results.md";
process.env.ANALYZE_SUMMARY_LABEL ??= "holdout summary";

await import("./analyze-v1.ts");
