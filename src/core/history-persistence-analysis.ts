import type { CochangeCommit, CochangePersistenceAnalysis, DomainModel } from "./contracts.js";
import { buildPairWeights, deriveStableClusters } from "./history-persistence-clusters.js";
import { buildHistoryObservationQuality, contextualizeCommits, unique } from "./history-shared.js";

export function analyzeCochangePersistence(
  commits: CochangeCommit[],
  model: DomainModel,
): { analysis: CochangePersistenceAnalysis; confidence: number; unknowns: string[] } {
  const relevant = contextualizeCommits(commits, model);
  const contextsSeen = unique(relevant.flatMap((commit) => commit.contexts)).sort();
  const pairWeights = buildPairWeights(relevant);
  const { stableChangeClusters, naturalSplitLevels, noiseRatio, hasWeightRange } = deriveStableClusters(
    contextsSeen,
    pairWeights,
  );
  const quality = buildHistoryObservationQuality({
    relevantCommitCount: relevant.length,
    contextsSeen,
    pairWeightCount: pairWeights.length,
    hasWeightRange,
  });

  return {
    analysis: {
      relevantCommitCount: relevant.length,
      contextsSeen,
      pairWeights,
      stableChangeClusters,
      naturalSplitLevels,
      noiseRatio,
    },
    confidence: quality.confidence,
    unknowns: quality.unknowns,
  };
}
