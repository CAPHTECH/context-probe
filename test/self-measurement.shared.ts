import path from "node:path";

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const MODEL_ENTRY = "config/self-measurement/domain-model.yaml";
export const CONSTRAINTS_ENTRY = "config/self-measurement/architecture-constraints.yaml";
export const COMPLEXITY_EXPORT_ENTRY = "config/self-measurement/architecture-complexity-export.yaml";
export const BOUNDARY_MAP_ENTRY = "config/self-measurement/architecture-boundary-map.yaml";
export const CONTRACT_BASELINE_ENTRY = "config/self-measurement/architecture-contract-baseline.yaml";
export const SCENARIO_CATALOG_ENTRY = "config/self-measurement/architecture-scenarios.yaml";
export const SCENARIO_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-scenario-observations.yaml";
export const TOPOLOGY_ENTRY = "config/self-measurement/architecture-topology.yaml";
export const RUNTIME_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-runtime-observations.yaml";
export const TELEMETRY_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-telemetry-observations.yaml";
export const PATTERN_RUNTIME_OBSERVATIONS_ENTRY =
  "config/self-measurement/architecture-pattern-runtime-observations.yaml";
export const DELIVERY_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-delivery-observations.yaml";
export const PROJECT_ENTRIES = ["src", "config/self-measurement"];
export const SELF_MEASUREMENT_NOW = "2026-03-30T00:00:00Z";
export const REFRESH_SCRIPT_PATH = path.resolve("scripts/self-measurement/refresh-architecture-inputs.mjs");
