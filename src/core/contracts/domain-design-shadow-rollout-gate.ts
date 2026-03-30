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
