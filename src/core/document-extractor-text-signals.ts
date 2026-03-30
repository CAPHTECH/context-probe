import type { Fragment } from "./contracts.js";

export const RULE_SIGNALS = [
  /なければならない/u,
  /べき/u,
  /\bmust\b/i,
  /\bmust not\b/i,
  /\bshould not\b/i,
  /禁止/u,
  /行わない/u,
  /残さない/u,
];
export const INVARIANT_SIGNALS = [
  /常に/u,
  /一致/u,
  /不変/u,
  /\balways\b/i,
  /一意/u,
  /整合/u,
  /返(?:る|される)/u,
  /欠落しない/u,
  /再現可能/u,
  /安定(?:する|している)/u,
  /辿れる/u,
  /反映(?:される|されている)/u,
  /付与(?:される|されている)/u,
  /表示(?:される|されている)/u,
];
export const RULE_PREDICATE_PATTERNS = [
  /なければならない[。.]?$/u,
  /べき[。.]?$/u,
  /\bmust\b/i,
  /\bmust not\b/i,
  /\bshould not\b/i,
  /選択できる[。.]?$/u,
  /行わない[。.]?$/u,
  /残さない[。.]?$/u,
  /持つ[。.]?$/u,
  /従う[。.]?$/u,
  /守る[。.]?$/u,
];
export const INVARIANT_PREDICATE_PATTERNS = [
  /である[。.]?$/u,
  /不変である[。.]?$/u,
  /一致(?:して(?:いる|いなければならない)|する)[。.]?$/u,
  /返(?:る|される)[。.]?$/u,
  /一意である[。.]?$/u,
  /整合(?:して(?:いる|いなければならない)|する)[。.]?$/u,
  /欠落しない[。.]?$/u,
  /再現可能である/u,
  /安定(?:する|している)[。.]?$/u,
  /辿れる[。.]?$/u,
  /反映(?:される|されている)[。.]?$/u,
  /付与(?:される|されている)[。.]?$/u,
  /表示(?:される|されている)[。.]?$/u,
  /保た(?:れる|れている)[。.]?$/u,
  /維持(?:される|している|する)?[。.]?$/u,
  /成立(?:する|している)?[。.]?$/u,
  /閉じ(?:ている|る)[。.]?$/u,
  /\balways\b.+\b(is|are|returns?|holds?)\b/i,
];
export const RULE_INVARIANT_AMBIGUITY = "The boundary between a rule and an invariant is ambiguous.";
export const INVARIANT_REVIEW_SIGNALS = [
  /返(?:る|される)/u,
  /表示(?:される|されている)/u,
  /反映(?:される|されている)/u,
  /付与(?:される|されている)/u,
  /欠落しない/u,
];

const STRUCTURAL_GLOSSARY_FLAG_PATTERN = /^--[a-z0-9][a-z0-9-]*$/;
const STRUCTURAL_GLOSSARY_FILE_SUFFIX_PATTERN = /\.(?:ts|tsx|js|mjs|md|yaml|yml|json)$/i;
const STRUCTURAL_GLOSSARY_ID_PATTERN = /^(?:ART|FRG|TERM|RULE|INV|EV|RUN|RV)-[A-Za-z0-9._-]+$/;
const STRUCTURAL_GLOSSARY_RESPONSE_PATH_PATTERN = /^(?:result|response)\.[A-Za-z0-9_*.-]+$/;
const STRUCTURAL_GLOSSARY_SNAKE_CASE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

export function isStructuredNoiseFragment(fragment: Fragment): boolean {
  const trimmed = fragment.text.trim();
  if (trimmed.startsWith("```") || trimmed.includes("\n```")) {
    return true;
  }
  return trimmed
    .split("\n")
    .filter(Boolean)
    .every((line) => line.trim().startsWith("|"));
}

function isStructuralGlossaryNoise(term: string): boolean {
  return (
    STRUCTURAL_GLOSSARY_FLAG_PATTERN.test(term) ||
    term.includes("/") ||
    STRUCTURAL_GLOSSARY_FILE_SUFFIX_PATTERN.test(term) ||
    STRUCTURAL_GLOSSARY_ID_PATTERN.test(term) ||
    STRUCTURAL_GLOSSARY_RESPONSE_PATH_PATTERN.test(term) ||
    STRUCTURAL_GLOSSARY_SNAKE_CASE_PATTERN.test(term)
  );
}

export function hasAnySignal(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function hasPredicateShape(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function normalizeInlineTerm(term: string): string | undefined {
  const normalized = term.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("\n")) {
    return undefined;
  }
  if (normalized.length > 80) {
    return undefined;
  }
  if (normalized.split(/\s+/).length > 4) {
    return undefined;
  }
  if (isStructuralGlossaryNoise(normalized)) {
    return undefined;
  }
  return normalized;
}
