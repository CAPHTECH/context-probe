import type { DomainDesignShadowRolloutGateAggregate, DomainDesignShadowRolloutGateObservation } from "./contracts.js";

export function summarizeGateObservations(
  observations: DomainDesignShadowRolloutGateObservation[],
): DomainDesignShadowRolloutGateAggregate {
  if (observations.length === 0) {
    return {
      repoCount: 0,
      averageDelta: 0,
      weightedAverageDelta: 0,
      medianDelta: 0,
      minDelta: 0,
      maxDelta: 0,
      deltaRange: 0,
      positiveDeltaCount: 0,
      negativeDeltaCount: 0,
    };
  }

  const deltas = observations.map((entry) => entry.delta).sort((left, right) => left - right);
  const totalRelevantCommits = observations.reduce((sum, entry) => sum + entry.relevantCommitCount, 0);
  const weightedDeltaTotal = observations.reduce((sum, entry) => sum + entry.delta * entry.relevantCommitCount, 0);
  const averageDelta = observations.reduce((sum, entry) => sum + entry.delta, 0) / observations.length;
  const middleIndex = Math.floor(deltas.length / 2);
  const medianDelta =
    deltas.length % 2 === 0
      ? ((deltas[middleIndex - 1] ?? 0) + (deltas[middleIndex] ?? 0)) / 2
      : (deltas[middleIndex] ?? 0);
  const minDelta = deltas[0] ?? 0;
  const maxDelta = deltas.at(-1) ?? 0;

  return {
    repoCount: observations.length,
    averageDelta,
    weightedAverageDelta: totalRelevantCommits === 0 ? averageDelta : weightedDeltaTotal / totalRelevantCommits,
    medianDelta,
    minDelta,
    maxDelta,
    deltaRange: maxDelta - minDelta,
    positiveDeltaCount: observations.filter((entry) => entry.delta > 0).length,
    negativeDeltaCount: observations.filter((entry) => entry.delta < 0).length,
  };
}
