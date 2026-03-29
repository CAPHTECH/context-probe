import path from "node:path";

import type {
  DomainDesignShadowRolloutBatchAggregate,
  DomainDesignShadowRolloutBatchObservation,
  DomainDesignShadowRolloutGateAggregate,
  DomainDesignShadowRolloutGateCategorySummary,
  DomainDesignShadowRolloutGateEvaluation,
  DomainDesignShadowRolloutGateObservation,
  DomainDesignShadowRolloutRegistry,
} from "./contracts.js";
import { readDataFile } from "./io.js";

const SHADOW_ROLLOUT_MIN_REAL_REPO_OBSERVATIONS = 4;
const SHADOW_ROLLOUT_MIN_CATEGORY_REPO_OBSERVATIONS = 3;
const SHADOW_ROLLOUT_MAX_WEIGHTED_AVERAGE_DELTA = 0.05;
const SHADOW_ROLLOUT_MAX_DELTA_RANGE = 0.15;

export function inferShadowRolloutModelSource(modelPath: string): "repo_owned" | "versioned_manifest" {
  return modelPath.includes(`${path.sep}fixtures${path.sep}validation${path.sep}shadow-rollout${path.sep}`)
    ? "versioned_manifest"
    : "repo_owned";
}

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

export async function loadShadowRolloutRegistry(registryPath: string): Promise<DomainDesignShadowRolloutRegistry> {
  return readDataFile<DomainDesignShadowRolloutRegistry>(registryPath);
}

export function registryToGateObservations(
  registry: DomainDesignShadowRolloutRegistry,
  registryPath: string,
): DomainDesignShadowRolloutGateObservation[] {
  const registryDirectory = path.dirname(registryPath);
  return registry.repos.map((entry) => ({
    repoId: entry.repoId,
    category: entry.category,
    modelSource: entry.modelSource,
    ...(entry.manifestPath ? { modelPath: path.resolve(registryDirectory, entry.manifestPath) } : {}),
    relevantCommitCount: entry.observation.relevantCommitCount,
    delta: entry.observation.delta,
  }));
}

export function batchToGateObservations(
  observations: DomainDesignShadowRolloutBatchObservation[],
): DomainDesignShadowRolloutGateObservation[] {
  return observations.map((entry) => ({
    repoId: entry.repoId,
    category: entry.category,
    modelSource: entry.modelSource,
    modelPath: entry.modelPath,
    relevantCommitCount: entry.relevantCommitCount,
    delta: entry.policyDelta,
  }));
}

function summarizeGateObservations(
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
  const middleIndex = Math.floor(deltas.length / 2);
  const medianDelta =
    deltas.length % 2 === 0
      ? ((deltas[middleIndex - 1] ?? 0) + (deltas[middleIndex] ?? 0)) / 2
      : (deltas[middleIndex] ?? 0);
  const minDelta = deltas[0] ?? 0;
  const maxDelta = deltas.at(-1) ?? 0;

  return {
    repoCount: observations.length,
    averageDelta: observations.reduce((sum, entry) => sum + entry.delta, 0) / observations.length,
    weightedAverageDelta: totalRelevantCommits === 0 ? 0 : weightedDeltaTotal / totalRelevantCommits,
    medianDelta,
    minDelta,
    maxDelta,
    deltaRange: maxDelta - minDelta,
    positiveDeltaCount: observations.filter((entry) => entry.delta > 0).length,
    negativeDeltaCount: observations.filter((entry) => entry.delta < 0).length,
  };
}

function evaluateGateReasons(
  aggregate: DomainDesignShadowRolloutGateAggregate,
  observationCount: number,
  options?: {
    requireManifestPaths?: boolean;
    hasMissingVersionedManifestPath?: boolean;
    minObservationCount?: number;
    insufficientObservationReason?: string;
  },
): string[] {
  const reasons: string[] = [];
  const minObservationCount = options?.minObservationCount ?? SHADOW_ROLLOUT_MIN_REAL_REPO_OBSERVATIONS;
  const insufficientObservationReason = options?.insufficientObservationReason ?? "insufficient_real_repo_observations";

  if (observationCount < minObservationCount) {
    reasons.push(insufficientObservationReason);
  }
  if (options?.requireManifestPaths && options.hasMissingVersionedManifestPath) {
    reasons.push("missing_versioned_manifest_path");
  }
  if (aggregate.deltaRange > SHADOW_ROLLOUT_MAX_DELTA_RANGE) {
    reasons.push("real_repo_delta_range_above_threshold");
  }
  if (Math.abs(aggregate.weightedAverageDelta) > SHADOW_ROLLOUT_MAX_WEIGHTED_AVERAGE_DELTA) {
    reasons.push("real_repo_weighted_average_delta_above_threshold");
  }

  return reasons;
}

export function evaluateShadowRolloutGate(
  observations: DomainDesignShadowRolloutGateObservation[],
): DomainDesignShadowRolloutGateEvaluation {
  const overall = summarizeGateObservations(observations);
  const repoOwnedCount = observations.filter((entry) => entry.modelSource === "repo_owned").length;
  const versionedManifestCount = observations.filter((entry) => entry.modelSource === "versioned_manifest").length;
  const categories = Array.from(
    observations
      .reduce((groups, observation) => {
        const current = groups.get(observation.category) ?? [];
        current.push(observation);
        groups.set(observation.category, current);
        return groups;
      }, new Map<string, DomainDesignShadowRolloutGateObservation[]>())
      .entries(),
  )
    .map(
      ([category, categoryObservations]): DomainDesignShadowRolloutGateCategorySummary => ({
        category,
        repoIds: categoryObservations.map((entry) => entry.repoId),
        summary: summarizeGateObservations(categoryObservations),
        gate: (() => {
          const summary = summarizeGateObservations(categoryObservations);
          const reasons = evaluateGateReasons(summary, categoryObservations.length, {
            requireManifestPaths: true,
            hasMissingVersionedManifestPath: categoryObservations.some(
              (entry) => entry.modelSource === "versioned_manifest" && !entry.modelPath,
            ),
            minObservationCount: SHADOW_ROLLOUT_MIN_CATEGORY_REPO_OBSERVATIONS,
            insufficientObservationReason: "insufficient_category_observations",
          });
          return {
            reasons,
            replacementVerdict: reasons.length === 0 ? "go" : "no_go",
            rolloutDisposition: reasons.length === 0 ? "replace" : "shadow_only",
          };
        })(),
      }),
    )
    .sort((left, right) => left.category.localeCompare(right.category));

  const reasons = evaluateGateReasons(overall, observations.length, {
    requireManifestPaths: true,
    hasMissingVersionedManifestPath: observations.some(
      (entry) => entry.modelSource === "versioned_manifest" && !entry.modelPath,
    ),
  });

  return {
    observations,
    repoCount: observations.length,
    repoOwnedCount,
    versionedManifestCount,
    overall,
    categories,
    reasons,
    replacementVerdict: reasons.length === 0 ? "go" : "no_go",
    rolloutDisposition: reasons.length === 0 ? "replace" : "shadow_only",
  };
}
