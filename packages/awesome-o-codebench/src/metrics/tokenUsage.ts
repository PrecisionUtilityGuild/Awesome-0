const PERSONA_LEXICON = [
  "awesome/o",
  "awesome-o",
  "cover status",
  "cover",
  "exposed",
  "exposure",
  "operational",
  "compromised",
  "secret",
  "cardboard",
  "robot",
  "beep",
  "boop",
];

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimatePersonaTokens(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;

  for (const term of PERSONA_LEXICON) {
    const matches = lower.match(new RegExp(term.replace("/", "\\/"), "g"));
    if (matches) {
      count += matches.length * estimateTokens(term);
    }
  }

  return count;
}

export function personaOverhead(output: string): number {
  const outputTokens = estimateTokens(output);
  if (outputTokens === 0) {
    return 0;
  }
  return estimatePersonaTokens(output) / outputTokens;
}
