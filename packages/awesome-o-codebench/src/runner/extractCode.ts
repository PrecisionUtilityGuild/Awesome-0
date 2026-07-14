export interface ExtractCodeResult {
  code: string;
  hadMarkdownFence: boolean;
  hadProseOutsideCode: boolean;
  found: boolean;
}

const CPP_FENCE_RE = /```(?:cpp|c\+\+|cc|c)?\s*\n([\s\S]*?)```/i;

function stripLeadingProse(text: string): string {
  const lines = text.split("\n");
  const codeStart = lines.findIndex((line) =>
    /^(#include|using |namespace |template |class |struct |bool |int |void |std::|auto |return )/.test(
      line.trim(),
    ),
  );

  if (codeStart <= 0) {
    return text.trim();
  }

  return lines.slice(codeStart).join("\n").trim();
}

export function extractCode(raw: string): ExtractCodeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      code: "",
      hadMarkdownFence: false,
      hadProseOutsideCode: false,
      found: false,
    };
  }

  const fenceMatch = trimmed.match(CPP_FENCE_RE);
  if (fenceMatch) {
    const proseBefore = trimmed.slice(0, fenceMatch.index ?? 0).trim();
    const proseAfter = trimmed
      .slice((fenceMatch.index ?? 0) + fenceMatch[0].length)
      .trim();
    return {
      code: fenceMatch[1].trim(),
      hadMarkdownFence: true,
      hadProseOutsideCode: proseBefore.length > 0 || proseAfter.length > 40,
      found: fenceMatch[1].trim().length > 0,
    };
  }

  const code = stripLeadingProse(trimmed);
  const looksLikeCode =
    /[{;}]/.test(code) &&
    /\b(bool|int|void|std::|return|class|template)\b/.test(code);

  return {
    code,
    hadMarkdownFence: false,
    hadProseOutsideCode: trimmed.length - code.length > 40,
    found: looksLikeCode && code.length > 0,
  };
}
