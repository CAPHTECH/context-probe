import { matchGlobs } from "./io.js";

export const STOPWORD_AGGREGATE_TERMS = [/context$/i, /contract$/i, /service$/i, /handler$/i, /controller$/i];

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase();
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
  return unique(
    aliases
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0 && normalizeName(alias) !== normalizeName(name)),
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
