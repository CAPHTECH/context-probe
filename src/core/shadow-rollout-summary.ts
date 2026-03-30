import type {
  DomainDesignShadowRolloutBatchAggregate,
  DomainDesignShadowRolloutBatchObservation,
} from "./contracts.js";

export const SHADOW_ROLLOUT_MIN_REAL_REPO_OBSERVATIONS = 4;
export const SHADOW_ROLLOUT_MIN_CATEGORY_REPO_OBSERVATIONS = 3;

export function summarizeShadowRolloutBatchObservations(
  observations: DomainDesignShadowRolloutBatchObservation[],
): DomainDesignShadowRolloutBatchAggregate {
  if (observations.length === 0) {
    return {
      repoCount: 0,
      averageDelta: 0,
      weightedAverageDelta: 0,
      minDelta: 0,
      maxDelta: 0,
      deltaRange: 0,
      driftCounts: {
        aligned: 0,
        candidateHigher: 0,
        candidateLower: 0,
      },
    };
  }

  const deltas = observations.map((entry) => entry.policyDelta).sort((left, right) => left - right);
  const totalRelevantCommits = observations.reduce((sum, entry) => sum + entry.relevantCommitCount, 0);
  const weightedDeltaTotal = observations.reduce(
    (sum, entry) => sum + entry.policyDelta * entry.relevantCommitCount,
    0,
  );
  const averageDelta = observations.reduce((sum, entry) => sum + entry.policyDelta, 0) / observations.length;
  const weightedAverageDelta = totalRelevantCommits === 0 ? averageDelta : weightedDeltaTotal / totalRelevantCommits;
  const minDelta = deltas[0] ?? 0;
  const maxDelta = deltas.at(-1) ?? 0;

  return {
    repoCount: observations.length,
    averageDelta,
    weightedAverageDelta,
    minDelta,
    maxDelta,
    deltaRange: maxDelta - minDelta,
    driftCounts: {
      aligned: observations.filter((entry) => entry.driftCategory === "aligned").length,
      candidateHigher: observations.filter((entry) => entry.driftCategory === "candidate_higher").length,
      candidateLower: observations.filter((entry) => entry.driftCategory === "candidate_lower").length,
    },
  };
}
