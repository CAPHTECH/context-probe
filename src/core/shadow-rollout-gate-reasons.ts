import type { DomainDesignShadowRolloutGateAggregate } from "./contracts.js";
import {
  SHADOW_ROLLOUT_MIN_CATEGORY_REPO_OBSERVATIONS,
  SHADOW_ROLLOUT_MIN_REAL_REPO_OBSERVATIONS,
} from "./shadow-rollout-summary.js";

const SHADOW_ROLLOUT_MAX_WEIGHTED_AVERAGE_DELTA = 0.05;
const SHADOW_ROLLOUT_MAX_DELTA_RANGE = 0.15;

export function evaluateGateReasons(
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

export const SHADOW_ROLLOUT_GATE_CATEGORY_MIN_OBSERVATIONS = SHADOW_ROLLOUT_MIN_CATEGORY_REPO_OBSERVATIONS;
