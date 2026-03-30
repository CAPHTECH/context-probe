import {
  scoreArchitectureEvolutionEfficiency,
  scoreArchitectureEvolutionLocality,
} from "../analyzers/architecture-evolution.js";
import type {
  ArchitecturePolicy,
  ComputeArchitectureScoresOptions,
  DeliveryNormalizationResult,
  EvolutionEfficiencyScore,
  EvolutionLocalityScore,
} from "./architecture-scoring-types.js";
import { evaluateFormula } from "./formula.js";
import { normalizeHistory } from "./history.js";

function collectArchitectureHistoryGlobs(options: ComputeArchitectureScoresOptions): string[] {
  if (options.boundaryMap && options.boundaryMap.boundaries.length > 0) {
    return options.boundaryMap.boundaries.flatMap((entry) => entry.pathGlobs);
  }
  return options.constraints.layers.flatMap((entry) => entry.globs);
}

export interface ArchitectureEvolutionInputResults {
  architectureCommits: Awaited<ReturnType<typeof normalizeHistory>>;
  architectureHistoryDiagnostics: string[];
  evolutionLocalityScore: EvolutionLocalityScore;
  evolutionEfficiencyScore: EvolutionEfficiencyScore;
  localityValue: number;
}

export async function resolveArchitectureEvolutionInputs(
  options: ComputeArchitectureScoresOptions,
  policy: ArchitecturePolicy,
  deliveryNormalizationResult?: DeliveryNormalizationResult,
): Promise<ArchitectureEvolutionInputResults> {
  let architectureCommits: Awaited<ReturnType<typeof normalizeHistory>> = [];
  let architectureHistoryDiagnostics: string[] = [];
  try {
    architectureCommits = await normalizeHistory(options.repoPath, options.policyConfig, options.profileName, {
      includePathGlobs: collectArchitectureHistoryGlobs(options),
    });
  } catch (error) {
    architectureHistoryDiagnostics = [
      error instanceof Error
        ? `Skipped architecture history analysis: ${error.message}`
        : "Skipped architecture history analysis",
    ];
  }

  const evolutionLocalityScore = scoreArchitectureEvolutionLocality({
    commits: architectureCommits,
    constraints: options.constraints,
    ...(options.boundaryMap ? { boundaryMap: options.boundaryMap } : {}),
  });
  const localityValue = policy.metrics.AELS
    ? evaluateFormula(policy.metrics.AELS.formula, {
        CrossBoundaryCoChange: evolutionLocalityScore.CrossBoundaryCoChange,
        WeightedPropagationCost: evolutionLocalityScore.WeightedPropagationCost,
        WeightedClusteringCost: evolutionLocalityScore.WeightedClusteringCost,
      })
    : 0.4 * (1 - evolutionLocalityScore.CrossBoundaryCoChange) +
      0.3 * (1 - evolutionLocalityScore.WeightedPropagationCost) +
      0.3 * (1 - evolutionLocalityScore.WeightedClusteringCost);
  const evolutionEfficiencyScore = scoreArchitectureEvolutionEfficiency({
    ...(options.deliveryObservations
      ? { deliveryObservations: options.deliveryObservations }
      : deliveryNormalizationResult
        ? { deliveryObservations: deliveryNormalizationResult.deliveryObservations }
        : {}),
    locality: localityValue,
    localityConfidence: evolutionLocalityScore.confidence,
    localityUnknowns: evolutionLocalityScore.unknowns,
  });

  return {
    architectureCommits,
    architectureHistoryDiagnostics,
    evolutionLocalityScore,
    evolutionEfficiencyScore,
    localityValue,
  };
}
