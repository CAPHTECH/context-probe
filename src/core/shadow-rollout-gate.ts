import type {
  DomainDesignShadowRolloutGateCategorySummary,
  DomainDesignShadowRolloutGateEvaluation,
  DomainDesignShadowRolloutGateObservation,
} from "./contracts.js";
import { evaluateGateReasons, SHADOW_ROLLOUT_GATE_CATEGORY_MIN_OBSERVATIONS } from "./shadow-rollout-gate-reasons.js";
import { summarizeGateObservations } from "./shadow-rollout-gate-summary.js";

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
            minObservationCount: SHADOW_ROLLOUT_GATE_CATEGORY_MIN_OBSERVATIONS,
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
