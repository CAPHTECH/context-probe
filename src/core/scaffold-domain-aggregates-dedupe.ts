import type { DomainAggregateCandidate } from "./contracts.js";
import { normalizeName } from "./scaffold-domain-aggregates-shared.js";

export function deduplicateAggregateCandidates(candidates: DomainAggregateCandidate[]): DomainAggregateCandidate[] {
  const deduped = new Map<string, DomainAggregateCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.definition.context}:${normalizeName(candidate.definition.name)}`;
    const current = deduped.get(key);
    if (!current || current.confidence < candidate.confidence) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const contextComparison = left.definition.context.localeCompare(right.definition.context);
    if (contextComparison !== 0) {
      return contextComparison;
    }
    return left.definition.name.localeCompare(right.definition.name);
  });
}
