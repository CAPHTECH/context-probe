import { matchGlobs } from "./io.js";

export const STOPWORD_AGGREGATE_TERMS = [/context$/i, /contract$/i, /service$/i, /handler$/i, /controller$/i];
const NOISY_SINGLE_TOKEN_TERMS = new Set([
  "codex",
  "declaration",
  "declarations",
  "index",
  "indexes",
  "boundary",
  "boundaries",
  "modified",
  "missing",
  "requires",
  "escalation",
]);
const NOISY_MULTI_TOKEN_TERMS = new Set(["diff", "patch", "branch", "worktree", "commit"]);

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAggregateLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function tokenizeAggregateLabel(value: string): string[] {
  return normalizeAggregateLabel(value)
    .split(" ")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function isNoisyAggregateLabel(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (/[\s]*cp\b|\bgit\b|\bmv\b|\brm\b/i.test(trimmed)) {
    return true;
  }
  if (/[/\\=:<>|`$]/u.test(trimmed) || /\.env\b/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Z0-9_]+$/u.test(trimmed)) {
    return true;
  }
  if (!/[a-z]/u.test(trimmed) && /[A-Z]/u.test(trimmed) && trimmed.length <= 12) {
    return true;
  }

  const tokens = tokenizeAggregateLabel(trimmed);
  if (tokens.length === 0) {
    return true;
  }
  if (tokens.length === 1) {
    return NOISY_SINGLE_TOKEN_TERMS.has(tokens[0] ?? "");
  }

  return tokens.some((token) => NOISY_MULTI_TOKEN_TERMS.has(token));
}

export function toPascalCase(value: string): string {
  const normalized = value
    .replace(/\.[^.]+$/u, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!normalized) {
    return "Generated";
  }
  return normalized
    .split(/\s+/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

export function sanitizeAggregateAliases(name: string, aliases: string[]): string[] {
  const normalizedName = normalizeAggregateLabel(name);
  return unique(
    aliases
      .map((alias) => alias.trim())
      .filter(
        (alias) =>
          alias.length > 0 && normalizeAggregateLabel(alias) !== normalizedName && !isNoisyAggregateLabel(alias),
      ),
  );
}

export function hasContractOccurrence(
  termLink: { occurrences?: Array<{ kind: string; path: string }> } | undefined,
  context: { contractGlobs?: string[] },
): boolean {
  return (termLink?.occurrences ?? []).some(
    (occurrence) => occurrence.kind === "code" && matchGlobs(occurrence.path, context.contractGlobs ?? []),
  );
}

export function hasInternalOccurrence(
  termLink: { occurrences?: Array<{ kind: string; path: string }> } | undefined,
  context: { internalGlobs?: string[]; pathGlobs?: string[] },
): boolean {
  return (termLink?.occurrences ?? []).some(
    (occurrence) =>
      occurrence.kind === "code" &&
      (matchGlobs(occurrence.path, context.internalGlobs ?? []) ||
        matchGlobs(occurrence.path, context.pathGlobs ?? [])),
  );
}
