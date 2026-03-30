import path from "node:path";

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const ELS_MODEL_PATH = path.resolve("fixtures/validation/scoring/els/model.yaml");
export const ELS_BASE_ENTRY = "fixtures/validation/scoring/els/base-repo";

export const DRIFT_TOLERANCE = 0.05;
export const MAX_THIN_HISTORY_CONFIDENCE = 0.75;
export const MAX_THIN_HISTORY_LOCALITY_SCORE = 0.5;
export const MIN_REPO_BACKED_ADVANTAGE_CASES = 2;
export const MIN_IMPROVEMENT_RATE = 0.2;

export const REAL_REPO_REGISTRY_PATH = path.resolve("fixtures/validation/shadow-rollout/registry.yaml");
export const SIM_PRISM_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/sim_prism-domain-model.yaml");
export const PCE_MEMORY_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/pce-memory-domain-model.yaml");
export const ZAKKI_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/zakki-domain-model.yaml");
export const ASSAY_KIT_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/assay-kit-domain-model.yaml");
export const PROJECT_LOGICA_MANIFEST_PATH = path.resolve(
  "fixtures/validation/shadow-rollout/project_logica-domain-model.yaml",
);
