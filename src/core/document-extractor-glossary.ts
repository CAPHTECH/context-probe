import type { Fragment, GlossaryTerm } from "./contracts.js";
import {
  createEvidenceFromFragment,
  createTermId,
  findFragmentsByIds,
  type HeuristicTermCandidate,
  isStructuredNoiseFragment,
  normalizeInlineTerm,
} from "./document-extractor-shared.js";

function collectTerms(fragments: Fragment[]): Map<string, HeuristicTermCandidate> {
  const terms = new Map<string, HeuristicTermCandidate>();
  const pushTerm = (term: string, fragment: Fragment) => {
    if (term.length < 3) {
      return;
    }
    const current = terms.get(term) ?? {
      canonicalTerm: term,
      count: 0,
      evidence: [],
      fragmentIds: [],
    };
    current.count += 1;
    current.fragmentIds.push(fragment.fragmentId);
    current.evidence.push(createEvidenceFromFragment(fragment, `Term candidate: ${term}`, 0.7));
    terms.set(term, current);
  };

  for (const fragment of fragments) {
    if (isStructuredNoiseFragment(fragment)) {
      continue;
    }
    for (const match of fragment.text.matchAll(/`([^`]+)`/g)) {
      const normalized = match[1] ? normalizeInlineTerm(match[1]) : undefined;
      if (normalized) {
        pushTerm(normalized, fragment);
      }
    }
    for (const match of fragment.text.matchAll(/\b[A-Z][A-Za-z0-9_]{2,}\b/g)) {
      const normalized = normalizeInlineTerm(match[0]);
      if (normalized) {
        pushTerm(normalized, fragment);
      }
    }
  }

  return terms;
}

export function normalizeGlossaryFromHeuristic(fragments: Fragment[]): GlossaryTerm[] {
  return Array.from(collectTerms(fragments).values())
    .sort((left, right) => right.count - left.count)
    .map((candidate) => ({
      termId: createTermId(`${candidate.canonicalTerm}:${candidate.fragmentIds.join(",")}`),
      canonicalTerm: candidate.canonicalTerm,
      aliases: [],
      count: candidate.count,
      collision: false,
      confidence: 0.7,
      evidence: candidate.evidence,
      unknowns: [],
      fragmentIds: candidate.fragmentIds,
    }));
}

export function normalizeGlossaryFromCli(rawItems: Record<string, unknown>[], fragments: Fragment[]): GlossaryTerm[] {
  return rawItems
    .filter((item) => typeof item.canonicalTerm === "string")
    .map((item) => {
      const canonicalTerm = item.canonicalTerm as string;
      const fragmentIds = Array.isArray(item.fragmentIds)
        ? item.fragmentIds.filter((value): value is string => typeof value === "string")
        : [];
      const supportingFragments = findFragmentsByIds(fragments, fragmentIds);
      return {
        termId: createTermId(`${canonicalTerm}:${fragmentIds.join(",")}`),
        canonicalTerm,
        aliases: Array.isArray(item.aliases)
          ? item.aliases.filter((value): value is string => typeof value === "string")
          : [],
        count: fragmentIds.length || 1,
        collision: Boolean(item.collision),
        confidence: typeof item.confidence === "number" ? item.confidence : 0.7,
        evidence: supportingFragments.map((fragment) =>
          createEvidenceFromFragment(
            fragment,
            `Term candidate: ${canonicalTerm}`,
            typeof item.confidence === "number" ? item.confidence : 0.7,
          ),
        ),
        unknowns: Array.isArray(item.unknowns)
          ? item.unknowns.filter((value): value is string => typeof value === "string")
          : [],
        fragmentIds,
      };
    });
}
