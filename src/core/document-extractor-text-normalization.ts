export function normalizeStatement(statement: string): string {
  return statement.replace(/\s+/g, " ").trim();
}

export function isListItemLine(line: string): boolean {
  return /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

export function stripListMarker(line: string): string {
  return line
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

export function splitIntoSentences(text: string): string[] {
  const normalized = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/(?<=[。！？])\s*|(?<=[!?])\s+|(?<=\.)\s+/u)
    .map((sentence) => normalizeStatement(sentence))
    .filter(Boolean);
}

export function isQuestionLikeStatement(text: string): boolean {
  return /[か？?][。.]?$/u.test(text);
}
