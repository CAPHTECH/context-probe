import type { ArchitectureEvidenceBundle } from "./architecture-scoring-evidence.js";
import type { ArchitectureMetricBuilderArgs } from "./architecture-scoring-metric-shared.js";
import { buildCompositeArchitectureMetricScores } from "./architecture-scoring-metrics-composite.js";
import { buildCoreArchitectureMetricScores } from "./architecture-scoring-metrics-core.js";
import { buildEvolutionArchitectureMetricScores } from "./architecture-scoring-metrics-evolution.js";
import { buildRuntimeArchitectureMetricScores } from "./architecture-scoring-metrics-runtime.js";
import type {
  ArchitecturePolicy,
  ArchitectureScoringContext,
  ComputeArchitectureScoresOptions,
} from "./architecture-scoring-types.js";
import type { MetricScore } from "./contracts.js";

export function buildArchitectureMetricScores(
  options: ComputeArchitectureScoresOptions,
  policy: ArchitecturePolicy,
  context: ArchitectureScoringContext,
  evidence: ArchitectureEvidenceBundle,
): MetricScore[] {
  const builderArgs: ArchitectureMetricBuilderArgs = { options, policy, context, evidence };
  const scores = [
    ...buildCoreArchitectureMetricScores(builderArgs),
    ...buildRuntimeArchitectureMetricScores(builderArgs),
    ...buildEvolutionArchitectureMetricScores(builderArgs),
  ];
  scores.push(...buildCompositeArchitectureMetricScores(builderArgs, scores));
  return scores;
}
