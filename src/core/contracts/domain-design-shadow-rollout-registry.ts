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
