import type { AggregateDefinition, InvariantCandidate } from "./contracts.js";

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
): { targets: string[]; unknowns: string[] } {
  if (aggregateDefinitions.length === 0) {
    return { targets: [], unknowns: [] };
  }

  const unknowns: string[] = [];
  const matched = new Set<string>();
  const normalizedStatement = invariant.statement.toLowerCase();
  const relatedTerms = new Set((invariant.relatedTerms ?? []).map((term) => term.toLowerCase()));
  const eligibleAggregates =
    contexts.length === 0
      ? aggregateDefinitions
      : aggregateDefinitions.filter((aggregate) => contexts.includes(aggregate.context));

  for (const aggregate of eligibleAggregates) {
    const aliases = unique([aggregate.name, ...(aggregate.aliases ?? [])]);
    if (
      aliases.some((alias) => {
        const normalizedAlias = alias.toLowerCase();
        return normalizedStatement.includes(normalizedAlias) || relatedTerms.has(normalizedAlias);
      })
    ) {
      matched.add(`${aggregate.context}::${aggregate.name}`);
    }
  }

  if (matched.size > 0) {
    return { targets: Array.from(matched), unknowns };
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
