import type { AggregateDefinition, InvariantCandidate } from "./contracts.js";
import { normalizeDomainDesignLabel, scoreTextAgainstLabel } from "./domain-design-matching.js";

const STRONG_CONSISTENCY_SIGNALS = [
  /一致/u,
  /整合/u,
  /同時/u,
  /両方/u,
  /またが/u,
  /跨/u,
  /同じ.*(?:更新|確定)/u,
  /\bconsistent\b/i,
  /\bsame transaction\b/i,
];
const OBLIGATION_SIGNALS = [/なければならない/u, /べき/u, /\bmust\b/i];

export interface AggregateInvariantMapping {
  invariant: InvariantCandidate;
  contexts: string[];
  localityTargets: string[];
  localization: number;
  usedContextProxy: boolean;
  aggregateTargets: string[];
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function localizationScore(contexts: string[]): number {
  if (contexts.length === 0) {
    return 0.35;
  }
  return 1 / contexts.length;
}

function isStrongConsistencyInvariant(statement: string): boolean {
  return STRONG_CONSISTENCY_SIGNALS.some((pattern) => pattern.test(statement));
}

export function impliesStrongConsistencyWrite(statement: string): boolean {
  return isStrongConsistencyInvariant(statement) || OBLIGATION_SIGNALS.some((pattern) => pattern.test(statement));
}

export function collectAggregateTargets(
  aggregateDefinitions: AggregateDefinition[],
  contexts: string[],
  invariant: InvariantCandidate,
  mappedTerms: Array<{ labels: string[]; contexts: string[] }> = [],
): { targets: string[]; unknowns: string[] } {
  if (aggregateDefinitions.length === 0) {
    return { targets: [], unknowns: [] };
  }

  const unknowns: string[] = [];
  const eligibleAggregates =
    contexts.length === 0
      ? aggregateDefinitions
      : aggregateDefinitions.filter((aggregate) => contexts.includes(aggregate.context));
  const relatedTerms = invariant.relatedTerms ?? [];
  const statementBackedTermLabels = unique(
    mappedTerms
      .filter(
        (term) =>
          term.contexts.length > 0 &&
          (contexts.length === 0 || term.contexts.some((context) => contexts.includes(context))),
      )
      .filter(
        (term) =>
          term.labels.some((label) => scoreTextAgainstLabel(invariant.statement, label) > 0) ||
          relatedTerms.some((relatedTerm) =>
            term.labels.some((label) => scoreTextAgainstLabel(relatedTerm, label) > 0),
          ),
      )
      .flatMap((term) => term.labels),
  );

  const scoredCandidates = eligibleAggregates
    .map((aggregate) => {
      const labels = unique([aggregate.name, ...(aggregate.aliases ?? [])]);
      const directScore = Math.max(0, ...labels.map((label) => scoreTextAgainstLabel(invariant.statement, label)));
      const relatedScore = Math.max(
        0,
        ...relatedTerms.flatMap((term) => labels.map((label) => scoreTextAgainstLabel(term, label))),
      );
      const glossaryScore = Math.max(
        0,
        ...statementBackedTermLabels.flatMap((term) => labels.map((label) => scoreTextAgainstLabel(term, label))),
      );
      return {
        aggregate,
        bestDirectLabels:
          directScore > 0
            ? labels.filter((label) => scoreTextAgainstLabel(invariant.statement, label) === directScore)
            : [],
        bestRelatedLabels:
          relatedScore > 0
            ? labels.filter((label) => relatedTerms.some((term) => scoreTextAgainstLabel(term, label) === relatedScore))
            : [],
        directScore,
        relatedScore,
        score: directScore * 3 + relatedScore * 2 + glossaryScore,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scoredCandidates.length > 0) {
    const strongMatches = scoredCandidates.filter(
      (candidate) => candidate.directScore >= 2 || candidate.relatedScore >= 2,
    );
    if (strongMatches.length > 0) {
      const distinctStrongLabels = unique(
        strongMatches.flatMap((candidate) =>
          (candidate.directScore >= 2 ? candidate.bestDirectLabels : candidate.bestRelatedLabels).map((label) =>
            normalizeDomainDesignLabel(label),
          ),
        ),
      );
      if (strongMatches.length === 1 || distinctStrongLabels.length > 1) {
        return {
          targets: strongMatches.map((candidate) => `${candidate.aggregate.context}::${candidate.aggregate.name}`),
          unknowns,
        };
      }
      if (contexts.length === 1) {
        unknowns.push(
          `Invariant "${invariant.invariantId}" could not be mapped to a specific aggregate within ${contexts[0]}.`,
        );
      }
      return {
        targets: [],
        unknowns,
      };
    }
    const best = scoredCandidates[0];
    const runnerUp = scoredCandidates[1];
    const topCandidates = best ? scoredCandidates.filter((candidate) => candidate.score === best.score) : [];
    if (topCandidates.length > 1 && best) {
      const distinctDirectLabels = unique(
        topCandidates.flatMap((candidate) =>
          candidate.bestDirectLabels.map((label) => normalizeDomainDesignLabel(label)),
        ),
      );
      if (distinctDirectLabels.length > 1) {
        return {
          targets: topCandidates.map((candidate) => `${candidate.aggregate.context}::${candidate.aggregate.name}`),
          unknowns,
        };
      }
      if (contexts.length === 1) {
        unknowns.push(
          `Invariant "${invariant.invariantId}" could not be mapped to a specific aggregate within ${contexts[0]}.`,
        );
      }
      return { targets: [], unknowns };
    }
    if (best && (!runnerUp || best.score > runnerUp.score)) {
      return {
        targets: [`${best.aggregate.context}::${best.aggregate.name}`],
        unknowns,
      };
    }
    if (contexts.length === 1) {
      unknowns.push(
        `Invariant "${invariant.invariantId}" could not be mapped to a specific aggregate within ${contexts[0]}.`,
      );
    }
    return { targets: [], unknowns };
  }

  if (contexts.length === 1) {
    const sameContextAggregates = aggregateDefinitions.filter((aggregate) => aggregate.context === contexts[0]);
    if (sameContextAggregates.length === 1) {
      return {
        targets: [`${sameContextAggregates[0]?.context}::${sameContextAggregates[0]?.name}`],
        unknowns,
      };
    }
    if (sameContextAggregates.length > 1) {
      unknowns.push(
        `Invariant "${invariant.invariantId}" could not be mapped to a specific aggregate within ${contexts[0]}.`,
      );
    }
  }

  return { targets: [], unknowns };
}
