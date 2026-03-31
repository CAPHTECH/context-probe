import type { Fragment, GlossaryTerm, TermTraceLink } from "./contracts.js";
import { isNoisyAggregateLabel } from "./scaffold-domain-aggregates-shared.js";
import { normalizeName, toPascalCase } from "./scaffold-naming.js";
import type { SourceGroup } from "./scaffold-types.js";

export interface DocsContextNamingInput {
  fragments: Fragment[];
  terms: GlossaryTerm[];
  termLinks: TermTraceLink[];
}

function cleanHeadingLabel(value: string): string {
  return value
    .replace(/^#+\s*/u, "")
    .replace(/`/gu, "")
    .replace(/\b(context|module|layer)\b/giu, "")
    .replace(/[^A-Za-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function isUsefulHeadingLabel(value: string): boolean {
  const normalized = cleanHeadingLabel(value);
  if (normalized.length < 4) {
    return false;
  }
  const tokenCount = normalized.split(/\s+/u).filter(Boolean).length;
  if (tokenCount === 0 || tokenCount > 4) {
    return false;
  }
  const lowered = normalizeName(normalized);
  return !new Set(["docs", "glossary", "rules", "invariants", "architecture", "overview"]).has(lowered);
}

function buildHeadingByFragmentId(fragments: Fragment[]): Map<string, string> {
  const byFile = new Map<string, Fragment[]>();
  for (const fragment of fragments) {
    const list = byFile.get(fragment.path) ?? [];
    list.push(fragment);
    byFile.set(fragment.path, list);
  }

  const headingByFragmentId = new Map<string, string>();
  for (const fragmentsInFile of byFile.values()) {
    const ordered = [...fragmentsInFile].sort((left, right) => left.lineStart - right.lineStart);
    let currentHeading: string | undefined;
    for (const fragment of ordered) {
      if (fragment.kind === "heading" && isUsefulHeadingLabel(fragment.text)) {
        currentHeading = cleanHeadingLabel(fragment.text);
      }
      if (currentHeading) {
        headingByFragmentId.set(fragment.fragmentId, currentHeading);
      }
    }
  }

  return headingByFragmentId;
}

function hasLocalizedCodeOccurrence(link: TermTraceLink, group: SourceGroup): boolean {
  return (link.occurrences ?? []).some(
    (occurrence) => occurrence.kind === "code" && group.files.includes(occurrence.path),
  );
}

export function inferDocsDrivenContextName(
  group: SourceGroup,
  fallbackName: string,
  docsInput: DocsContextNamingInput | undefined,
): string | undefined {
  if (!docsInput) {
    return undefined;
  }

  const headingByFragmentId = buildHeadingByFragmentId(docsInput.fragments);
  const termById = new Map(docsInput.terms.map((term) => [term.termId, term]));
  const scores = new Map<string, number>();

  for (const link of docsInput.termLinks) {
    if (!hasLocalizedCodeOccurrence(link, group)) {
      continue;
    }
    const term = termById.get(link.termId);
    if (!term) {
      continue;
    }
    if (isNoisyAggregateLabel(term.canonicalTerm)) {
      continue;
    }
    const contribution = Math.max(2, link.coverage.codeHits || 0);
    for (const fragmentId of term.fragmentIds) {
      const heading = headingByFragmentId.get(fragmentId);
      if (!heading) {
        continue;
      }
      const candidate = toPascalCase(heading);
      if (candidate.length === 0 || normalizeName(candidate) === normalizeName(fallbackName)) {
        continue;
      }
      scores.set(candidate, (scores.get(candidate) ?? 0) + contribution);
    }
  }

  const ranked = Array.from(scores.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
  const [best, next] = ranked;
  if (!best) {
    return undefined;
  }
  if (best[1] < 2) {
    return undefined;
  }
  if (next && next[1] === best[1]) {
    return undefined;
  }
  return best[0];
}
