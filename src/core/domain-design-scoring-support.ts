import type { Fragment, InvariantCandidate, RuleCandidate, TermTraceLink } from "./contracts.js";
import { listReviewItems } from "./review.js";
import { average, clamp01 } from "./scoring-shared.js";

const USE_CASE_SIGNALS = [
  /ユースケース/u,
  /シナリオ/u,
  /期待(?:される)?結果/u,
  /受け入れ基準/u,
  /利用者/u,
  /\buse case\b/i,
  /\bscenario\b/i,
  /\bacceptance\b/i,
];
const CONSTRAINT_SIGNALS = [
  /なければならない/u,
  /べき/u,
  /常に/u,
  /一致/u,
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

export function persistenceCandidateToMetricComponents(candidate: {
  persistentCouplingPenalty: number;
  clusterPenalty: number;
  pairPenalty: number;
  coherencePenalty: number;
}): Record<string, number> {
  return {
    persistentCouplingPenalty: candidate.persistentCouplingPenalty,
    clusterPenalty: candidate.clusterPenalty,
    pairPenalty: candidate.pairPenalty,
    coherencePenalty: candidate.coherencePenalty,
  };
}

function computeAliasEntropy(aliasesPerTerm: number, termCount: number): number {
  if (termCount === 0) {
    return 1;
  }
  return Math.min(1, aliasesPerTerm / termCount);
}

export function computeUliComponents(
  terms: Array<{ termId: string; count: number; aliases: string[]; collision: boolean }>,
  links: TermTraceLink[],
) {
  const totalTerms = terms.length;
  if (totalTerms === 0) {
    return {
      GC: 0,
      AE: 1,
      TC: 1,
      TL: 0,
    };
  }

  const linkByTermId = new Map(links.map((link) => [link.termId, link]));
  const glossaryCovered = terms.filter((term) => {
    const link = linkByTermId.get(term.termId);
    return term.count > 1 || (link?.coverage.codeHits ?? 0) > 0;
  }).length;
  const tracedTerms = links.filter((link) => link.coverage.documentHits > 0 && link.coverage.codeHits > 0).length;
  const collisionTerms = terms.filter((term) => term.collision).length;
  const aliasCount = terms.reduce((sum, term) => sum + term.aliases.length, 0);

  return {
    GC: glossaryCovered / totalTerms,
    AE: computeAliasEntropy(aliasCount, totalTerms),
    TC: collisionTerms / totalTerms,
    TL: tracedTerms / totalTerms,
  };
}

export function buildReviewItemsForCandidates(
  key: "rules" | "invariants",
  candidates: RuleCandidate[] | InvariantCandidate[],
  responseConfidence: number,
  responseUnknowns: string[],
) {
  return listReviewItems({
    status: "ok",
    result: {
      [key]: candidates,
    },
    evidence: candidates.flatMap((candidate) => candidate.evidence),
    confidence: responseConfidence,
    unknowns: responseUnknowns,
    diagnostics: [],
    provenance: [],
    version: "1.0",
  });
}

export function computeDrfComponents(
  fragments: Fragment[],
  rules: RuleCandidate[],
  invariants: InvariantCandidate[],
  reviewItemCount: number,
) {
  const proseFragments = fragments.filter(
    (fragment) => fragment.kind === "paragraph" && fragment.text.trim().length > 0,
  );
  const totalCandidates = rules.length + invariants.length;
  const allCandidates = [...rules, ...invariants];
  const coveredFragments = new Set(allCandidates.flatMap((candidate) => candidate.fragmentIds)).size;
  const signalFragments = proseFragments.filter((fragment) =>
    CONSTRAINT_SIGNALS.some((pattern) => pattern.test(fragment.text)),
  ).length;
  const useCaseFragments = proseFragments.filter((fragment) =>
    USE_CASE_SIGNALS.some((pattern) => pattern.test(fragment.text)),
  ).length;
  const ambiguousCandidates = allCandidates.filter((candidate) => candidate.unknowns.length > 0).length;
  const lowConfidenceCandidates = allCandidates.filter((candidate) => candidate.confidence < 0.75).length;
  const ambiguityRate = totalCandidates === 0 ? 1 : ambiguousCandidates / totalCandidates;
  const lowConfidenceRate = totalCandidates === 0 ? 1 : lowConfidenceCandidates / totalCandidates;
  const reviewDensity = clamp01(reviewItemCount / Math.max(1, totalCandidates * 2));
  const averageConfidence = average(
    allCandidates.map((candidate) => candidate.confidence),
    0.45,
  );

  const SC =
    proseFragments.length === 0
      ? 0
      : clamp01((0.7 * useCaseFragments) / proseFragments.length + (0.3 * coveredFragments) / proseFragments.length);
  const RC = signalFragments === 0 ? 0 : clamp01((coveredFragments / signalFragments) * (1 - 0.5 * ambiguityRate));
  const IV = clamp01(0.6 * ambiguityRate + 0.4 * lowConfidenceRate);
  const RA = clamp01((1 - reviewDensity) * 0.6 + averageConfidence * 0.4);

  return {
    SC,
    RC,
    IV,
    RA,
    proseFragments: proseFragments.length,
    useCaseFragments,
    signalFragments,
    totalCandidates,
  };
}
