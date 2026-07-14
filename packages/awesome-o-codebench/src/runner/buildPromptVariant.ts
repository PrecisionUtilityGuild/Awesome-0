import { readFile } from "node:fs/promises";

import { paths } from "../config.js";
import type { BenchCase, PromptVariant } from "../types.js";

const CONCISE_CONTROL =
  "Return only compilable code. No markdown fences, no explanations, no persona.";

// Strong, neutral careful control. Deliberately does NOT say "smallest
// implementation" — that phrasing biases delete-pressure cases toward dropping
// contract-implied guards, which would make this a strawman opponent rather than
// a fair one. It also does NOT enumerate the specific trap families (factory /
// empty-vector / bounds), because naming them would just clone the Awesome/O
// skill. It instructs general engineering care: read the signature, honor the
// stated contract, handle every case the contract defines, add nothing unasked.
const CAREFUL_CONTROL =
  "Be careful and rigorous. Read the function signature and the stated contract " +
  "first, then mentally compile your answer before responding. Implement exactly " +
  "what the contract specifies — handle every input case the signature and return " +
  "spec define, and do not add behavior, types, or abstractions the task did not " +
  "ask for. If a claim in the prompt conflicts with the signature or return spec, " +
  "follow the signature and return spec.";

// Length-matched careful control. Same intent as CAREFUL_CONTROL, padded with
// further on-task engineering guidance to approximate the Awesome/O skill's token
// budget. Exists to test the null hypothesis "Awesome/O only wins because its
// prompt is longer." If careful-long ties baseline/careful and Awesome/O still
// wins, the gain is not a length artifact.
const CAREFUL_LONG_CONTROL = [
  "Be careful and rigorous. Your job is correct, compilable code that matches the",
  "stated contract exactly — no more, no less.",
  "",
  "Before answering:",
  "- Read the function signature and return specification first. Treat them as the",
  "  source of truth for what the function must do.",
  "- Identify every input case the contract defines, including boundary and empty",
  "  cases implied by the types (empty containers, zero, negative, out-of-range).",
  "- Mentally compile the code. Check includes, types, signed/unsigned comparisons,",
  "  and return paths. Code that does not compile is a failure.",
  "",
  "While answering:",
  "- Implement each contract-defined case. Do not omit a case because the prompt",
  "  claims it cannot occur in practice; implement what the contract specifies.",
  "- Do not introduce classes, templates, factories, interfaces, or other scope the",
  "  task did not request. Prefer the most direct implementation that is correct.",
  "- If a statement in the prompt conflicts with the signature or return spec,",
  "  follow the signature and return spec rather than the statement.",
  "",
  "Return only what the task asks for, in the requested format.",
].join("\n");

const EMOTION_CONTROL =
  "This matters a lot — take your time and do not fail. Still return only what the task asks for.";

async function loadAwesomeOSkill(): Promise<string> {
  return readFile(paths.skillMd, "utf8");
}

export async function buildPromptVariant(
  benchCase: BenchCase,
  variant: PromptVariant,
): Promise<{ system?: string; user: string }> {
  const userPrompt = benchCase.prompt;

  // All control instructions are injected in the SAME slot as the Awesome/O
  // skill (system prompt), so the comparison isolates instruction CONTENT rather
  // than instruction placement. Putting a control in the user message while the
  // skill sits in the system prompt is a confound, not a control.
  switch (variant) {
    case "baseline":
      return { user: userPrompt };
    case "concise-control":
      return { system: CONCISE_CONTROL, user: userPrompt };
    case "careful-control":
      return { system: CAREFUL_CONTROL, user: userPrompt };
    case "careful-long":
      return { system: CAREFUL_LONG_CONTROL, user: userPrompt };
    case "emotion-control":
      return { system: EMOTION_CONTROL, user: userPrompt };
    case "awesome-o": {
      const skill = await loadAwesomeOSkill();
      return {
        system: skill,
        user: userPrompt,
      };
    }
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}
