import type { Fragment, InvariantCandidate, RuleCandidate } from "./contracts.js";
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

const USE_CASE_HEADING_PATTERNS = [/\bcore use cases?\b/i, /\buse cases?\b/i, /ユースケース/u];
const RULE_HEADING_PATTERNS = [/\bdecision rules?\b/i, /\brules?\b/i, /ルール/u];
const INVARIANT_HEADING_PATTERNS = [/\bstrong invariants?\b/i, /\binvariants?\b/i, /不変条件/u];

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
    progress: [],
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

function headingMatches(heading: string | undefined, patterns: RegExp[]): boolean {
  if (!heading) {
    return false;
  }
  return patterns.some((pattern) => pattern.test(heading));
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
      if (fragment.kind === "heading") {
        currentHeading = fragment.text.replace(/^#+\s*/u, "").trim();
      }
      if (currentHeading) {
        headingByFragmentId.set(fragment.fragmentId, currentHeading);
      }
    }
  }

  return headingByFragmentId;
}

function countAnchoredCandidates(
  candidates: Array<RuleCandidate | InvariantCandidate>,
  headingByFragmentId: Map<string, string>,
  patterns: RegExp[],
): number {
  return candidates.filter((candidate) =>
    candidate.fragmentIds.some((fragmentId) => headingMatches(headingByFragmentId.get(fragmentId), patterns)),
  ).length;
}

export function inspectDrfEvidenceQuality(
  fragments: Fragment[],
  rules: RuleCandidate[],
  invariants: InvariantCandidate[],
): {
  explicitUseCaseCount: number;
  explicitRuleCount: number;
  explicitInvariantCount: number;
} {
  const headingByFragmentId = buildHeadingByFragmentId(fragments);
  const explicitUseCaseCount = fragments.filter(
    (fragment) =>
      fragment.kind === "paragraph" &&
      USE_CASE_SIGNALS.some((pattern) => pattern.test(fragment.text)) &&
      headingMatches(headingByFragmentId.get(fragment.fragmentId), USE_CASE_HEADING_PATTERNS),
  ).length;

  return {
    explicitUseCaseCount,
    explicitRuleCount: countAnchoredCandidates(rules, headingByFragmentId, RULE_HEADING_PATTERNS),
    explicitInvariantCount: countAnchoredCandidates(invariants, headingByFragmentId, INVARIANT_HEADING_PATTERNS),
  };
}
