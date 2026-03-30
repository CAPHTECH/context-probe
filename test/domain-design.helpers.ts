import path from "node:path";

export const FIXTURE_ROOT = path.resolve("fixtures/domain-design");
export const SHADOW_ROLLOUT_REGISTRY_PATH = path.resolve("fixtures/validation/shadow-rollout/registry.yaml");

export interface DomainDesignTestState {
  repoPath: string | undefined;
}
