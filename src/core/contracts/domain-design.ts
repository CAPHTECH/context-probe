import type { BoundaryLeakFinding, CochangeAnalysis, EvolutionLocalityModelComparison } from "./analysis.js";
import type { CommandStatus } from "./common.js";
import type { DomainDesignPilotAnalysis, MetricScore } from "./governance.js";

export interface DomainDesignShadowAnalysis {
  localityModels: EvolutionLocalityModelComparison;
}

export interface DomainDesignScoreResult {
  domainId: "domain_design";
  metrics: MetricScore[];
  leakFindings: BoundaryLeakFinding[];
  history: CochangeAnalysis | null;
  crossContextReferences: number;
  shadow?: DomainDesignShadowAnalysis;
  pilot?: DomainDesignPilotAnalysis;
}

export interface DomainDesignShadowRolloutObservation {
  domainId: "domain_design";
  metricId: "ELS";
  elsMetric: MetricScore;
  shadow: DomainDesignShadowAnalysis;
  observation: {
    policyDelta: number;
    modelDelta: number;
    driftCategory: "aligned" | "candidate_higher" | "candidate_lower";
    tieTolerance: number;
  };
  history: CochangeAnalysis | null;
  crossContextReferences: number;
}

export interface DomainDesignShadowRolloutBatchSpecEntry {
  repoId: string;
  repo: string;
  model: string;
  label?: string;
  category?: string;
  modelSource?: "repo_owned" | "versioned_manifest";
  policy?: string;
  tieTolerance?: number;
}

export interface DomainDesignShadowRolloutBatchSpec {
  version: string;
  policy?: string;
  tieTolerance?: number;
  entries: DomainDesignShadowRolloutBatchSpecEntry[];
}

export interface DomainDesignShadowRolloutBatchObservation {
  repoId: string;
  label?: string;
  category: string;
  modelSource: "repo_owned" | "versioned_manifest";
  repoPath: string;
  modelPath: string;
  policyPath: string;
  status: CommandStatus;
  elsMetric: number;
  persistenceLocalityScore: number;
  policyDelta: number;
  modelDelta: number;
  driftCategory: "aligned" | "candidate_higher" | "candidate_lower";
  relevantCommitCount: number;
  confidence: number;
  unknowns: string[];
}

export interface DomainDesignShadowRolloutBatchAggregate {
  repoCount: number;
  averageDelta: number;
  weightedAverageDelta: number;
  minDelta: number;
  maxDelta: number;
  deltaRange: number;
  driftCounts: {
    aligned: number;
    candidateHigher: number;
    candidateLower: number;
  };
}

export interface DomainDesignShadowRolloutBatchCategorySummary {
  category: string;
  repoIds: string[];
  summary: DomainDesignShadowRolloutBatchAggregate;
}

export interface DomainDesignShadowRolloutBatchResult {
  observations: DomainDesignShadowRolloutBatchObservation[];
  categories: DomainDesignShadowRolloutBatchCategorySummary[];
  overall: DomainDesignShadowRolloutBatchAggregate;
}

export interface DomainDesignShadowRolloutRegistryEntry {
  repoId: string;
  label?: string;
  category: string;
  modelSource: "repo_owned" | "versioned_manifest";
  manifestPath?: string;
  observation: {
    relevantCommitCount: number;
    delta: number;
  };
}

export interface DomainDesignShadowRolloutRegistry {
  version: string;
  repos: DomainDesignShadowRolloutRegistryEntry[];
}

export interface DomainDesignShadowRolloutGateObservation {
  repoId: string;
  category: string;
  modelSource: "repo_owned" | "versioned_manifest";
  modelPath?: string;
  relevantCommitCount: number;
  delta: number;
}

export interface DomainDesignShadowRolloutGateAggregate {
  repoCount: number;
  averageDelta: number;
  weightedAverageDelta: number;
  medianDelta: number;
  minDelta: number;
  maxDelta: number;
  deltaRange: number;
  positiveDeltaCount: number;
  negativeDeltaCount: number;
}

export interface DomainDesignShadowRolloutGateCategorySummary {
  category: string;
  repoIds: string[];
  summary: DomainDesignShadowRolloutGateAggregate;
  gate: {
    reasons: string[];
    replacementVerdict: "go" | "no_go";
    rolloutDisposition: "replace" | "shadow_only";
  };
}

export interface DomainDesignShadowRolloutGateEvaluation {
  observations: DomainDesignShadowRolloutGateObservation[];
  repoCount: number;
  repoOwnedCount: number;
  versionedManifestCount: number;
  overall: DomainDesignShadowRolloutGateAggregate;
  categories: DomainDesignShadowRolloutGateCategorySummary[];
  reasons: string[];
  replacementVerdict: "go" | "no_go";
  rolloutDisposition: "replace" | "shadow_only";
}

export interface DomainDesignShadowRolloutGateResult {
  source: "registry" | "batch_spec";
  registryPath?: string;
  batchSpecPath?: string;
  evaluation: DomainDesignShadowRolloutGateEvaluation;
}
