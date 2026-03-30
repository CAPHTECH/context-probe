import type {
  CochangeCommit,
  CochangePersistenceAnalysis,
  CochangePersistenceCandidateScore,
  DomainModel,
  EvolutionLocalityModelComparison,
} from "./contracts.js";
import { computeEvolutionLocalityScore, scoreEvolutionLocality } from "./history-locality.js";
import { analyzeCochangePersistence } from "./history-persistence-analysis.js";
import { computeClusterPenalty } from "./history-persistence-clusters.js";
import { clamp01 } from "./history-shared.js";

function scorePersistenceLocalityCandidate(
  commits: CochangeCommit[],
  model: DomainModel,
): {
  analysis: CochangePersistenceAnalysis;
  candidate: CochangePersistenceCandidateScore;
  confidence: number;
  unknowns: string[];
} {
  const result = analyzeCochangePersistence(commits, model);
  if (result.analysis.relevantCommitCount === 0 || result.analysis.contextsSeen.length === 0) {
    const fallbackElsScore = computeEvolutionLocalityScore(scoreEvolutionLocality(commits, model));
    return {
      analysis: result.analysis,
      candidate: {
        localityScore: fallbackElsScore,
        persistentCouplingPenalty: clamp01(1 - fallbackElsScore),
        strongestPair: null,
        strongestCluster: null,
        clusterPenalty: 0,
        pairPenalty: 0,
        coherencePenalty: 0,
      },
      confidence: result.confidence,
      unknowns: result.unknowns,
    };
  }
  const strongestPair = result.analysis.pairWeights[0] ?? null;
  const strongestCluster = result.analysis.stableChangeClusters[0] ?? null;
  const clusterPenalty = computeClusterPenalty(strongestCluster, result.analysis.contextsSeen.length);
  const pairPenalty = strongestPair?.jaccard ?? 0;
  const coherencePenalty = strongestPair ? clamp01((1 - result.analysis.noiseRatio) * pairPenalty) : 0;
  const persistentCouplingPenalty = clamp01(0.6 * clusterPenalty + 0.3 * pairPenalty + 0.1 * coherencePenalty);

  return {
    analysis: result.analysis,
    candidate: {
      localityScore: clamp01(1 - persistentCouplingPenalty),
      persistentCouplingPenalty,
      strongestPair,
      strongestCluster,
      clusterPenalty,
      pairPenalty,
      coherencePenalty,
    },
    confidence: result.confidence,
    unknowns: result.unknowns,
  };
}

export function compareEvolutionLocalityModels(
  commits: CochangeCommit[],
  model: DomainModel,
): {
  comparison: EvolutionLocalityModelComparison;
  confidence: number;
  unknowns: string[];
} {
  const elsAnalysis = scoreEvolutionLocality(commits, model);
  const persistence = scorePersistenceLocalityCandidate(commits, model);
  const elsScore = computeEvolutionLocalityScore(elsAnalysis);

  return {
    comparison: {
      els: {
        score: elsScore,
        components: {
          CCL: elsAnalysis.crossContextChangeLocality,
          FS: elsAnalysis.featureScatter,
          SCR: elsAnalysis.surpriseCouplingRatio,
        },
      },
      persistenceCandidate: persistence.candidate,
      persistenceAnalysis: persistence.analysis,
      delta: persistence.candidate.localityScore - elsScore,
    },
    confidence: persistence.confidence,
    unknowns: persistence.unknowns,
  };
}
