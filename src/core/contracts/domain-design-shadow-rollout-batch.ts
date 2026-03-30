import type { CommandStatus } from "./common.js";

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
