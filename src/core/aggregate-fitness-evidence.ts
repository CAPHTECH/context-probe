import type { AggregateInvariantMapping } from "./aggregate-fitness-shared.js";
import { clamp01 } from "./aggregate-fitness-shared.js";
import { toEvidence } from "./response.js";

export function buildAggregateFitnessEvidence(mappings: AggregateInvariantMapping[]) {
  const evidence = [];

  for (const entry of mappings.filter((mapping) => mapping.localityTargets.length === 1).slice(0, 4)) {
    const localityLabel = entry.aggregateTargets[0] ?? entry.contexts[0];
    evidence.push(
      toEvidence(
        `${entry.invariant.statement.slice(0, 120)} closes within ${localityLabel}`,
        {
          invariantId: entry.invariant.invariantId,
          contexts: entry.contexts,
          localityTargets: entry.localityTargets,
          fragmentIds: entry.invariant.fragmentIds,
        },
        [entry.invariant.invariantId],
        clamp01(entry.invariant.confidence),
      ),
    );
  }

  for (const entry of mappings.filter((mapping) => mapping.localityTargets.length > 1).slice(0, 4)) {
    const localityLabel = entry.localityTargets.join(", ");
    evidence.push(
      toEvidence(
        `${entry.invariant.statement.slice(0, 120)} spans ${localityLabel}`,
        {
          invariantId: entry.invariant.invariantId,
          contexts: entry.contexts,
          localityTargets: entry.localityTargets,
          fragmentIds: entry.invariant.fragmentIds,
        },
        [entry.invariant.invariantId],
        clamp01(Math.min(entry.invariant.confidence, 0.82)),
      ),
    );
  }

  return evidence;
}
