import type { DomainDesignShadowRolloutGateEvaluation, DomainModel } from "../src/core/contracts.js";

export interface LocalityComparisonResult {
  els: {
    score: number;
    components: { CCL: number; FS: number; SCR: number };
  };
  persistenceCandidate: {
    localityScore: number;
    persistentCouplingPenalty: number;
  };
  persistenceAnalysis: {
    relevantCommitCount: number;
    pairWeights: Array<{ rawCount: number; jaccard: number }>;
  };
  delta: number;
}

export interface ComparisonEnvelope {
  result: LocalityComparisonResult;
  confidence: number;
  unknowns: string[];
}

export interface RankingCase {
  kind: "control" | "advantage";
  evidenceLevel: "synthetic" | "repo_backed";
  id: string;
  build: () => Promise<{
    better: LocalityComparisonResult;
    worse: LocalityComparisonResult;
  }>;
}

export interface DriftCase {
  kind: "robustness";
  id: string;
  maxDrift?: number;
  build: () => Promise<{
    baseline: LocalityComparisonResult;
    variant: LocalityComparisonResult;
  }>;
}

export interface ConfidenceCase {
  kind: "confidence";
  id: string;
  maxConfidence?: number;
  maxLocalityScore?: number;
  requiredUnknownFragment: string;
  build: () => Promise<ComparisonEnvelope>;
}

export interface DeterminismCase {
  kind: "determinism";
  id: string;
  build: () => Promise<{
    forward: ComparisonEnvelope;
    reversed: ComparisonEnvelope;
  }>;
}

export type AcceptanceCase = RankingCase | DriftCase | ConfidenceCase | DeterminismCase;

export interface AdvantageSummary {
  caseCount: number;
  elsMisclassifications: number;
  persistenceMisclassifications: number;
  improvementRate: number;
}

export interface BenchmarkSummary {
  controlViolations: number;
  syntheticAdvantage: AdvantageSummary;
  repoBackedAdvantage: AdvantageSummary;
  robustnessViolations: number;
  confidenceViolations: number;
  determinismViolations: number;
  reasons: string[];
  verdict: "go" | "no_go";
}

export interface RealRepoManifestModels {
  simPrismModel: DomainModel;
  pceMemoryModel: DomainModel;
  zakkiModel: DomainModel;
  assayKitModel: DomainModel;
  projectLogicaModel: DomainModel;
}

export type RealRepoReplacementGate = DomainDesignShadowRolloutGateEvaluation;
