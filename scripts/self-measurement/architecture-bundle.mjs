#!/usr/bin/env node

import path from "node:path";

export const ARCHITECTURE_SELF_MEASUREMENT_PATHS = {
  constraints: "config/self-measurement/architecture-constraints.yaml",
  boundaryMap: "config/self-measurement/architecture-boundary-map.yaml",
  scenarios: "config/self-measurement/architecture-scenarios.yaml",
  scenarioObservations: "config/self-measurement/architecture-scenario-observations.yaml",
  scenarioBenchmarkSummary: "config/self-measurement/architecture-scenario-benchmark-summary.json",
  topology: "config/self-measurement/architecture-topology.yaml",
  runtimeObservations: "config/self-measurement/architecture-runtime-observations.yaml",
  telemetryObservations: "config/self-measurement/architecture-telemetry-observations.yaml",
  patternRuntimeObservations: "config/self-measurement/architecture-pattern-runtime-observations.yaml",
  deliveryObservations: "config/self-measurement/architecture-delivery-observations.yaml",
};

export const ARCHITECTURE_SELF_MEASUREMENT_FRESHNESS = {
  measuredDays: 7,
  curatedDays: 30,
};

export const ARCHITECTURE_BOUNDARY_NAME_ALIASES = {
  domain_services: "analysis",
};

export const ARCHITECTURE_CURATED_SNAPSHOT_PATHS = [
  ARCHITECTURE_SELF_MEASUREMENT_PATHS.scenarios,
  ARCHITECTURE_SELF_MEASUREMENT_PATHS.topology,
  ARCHITECTURE_SELF_MEASUREMENT_PATHS.runtimeObservations,
  ARCHITECTURE_SELF_MEASUREMENT_PATHS.telemetryObservations,
  ARCHITECTURE_SELF_MEASUREMENT_PATHS.patternRuntimeObservations,
  ARCHITECTURE_SELF_MEASUREMENT_PATHS.deliveryObservations,
];

export function resolveArchitectureSelfMeasurementPaths(repoRoot) {
  return Object.fromEntries(
    Object.entries(ARCHITECTURE_SELF_MEASUREMENT_PATHS).map(([key, relativePath]) => [
      key,
      path.join(repoRoot, relativePath),
    ]),
  );
}

function scoreComputeArgs(paths, repoRoot) {
  return [
    "run",
    "--silent",
    "dev",
    "--",
    "score.compute",
    "--domain",
    "architecture_design",
    "--repo",
    repoRoot,
    "--constraints",
    paths.constraints,
    "--boundary-map",
    paths.boundaryMap,
    "--scenario-catalog",
    paths.scenarios,
    "--scenario-observations",
    paths.scenarioObservations,
    "--topology-model",
    paths.topology,
    "--runtime-observations",
    paths.runtimeObservations,
    "--telemetry-observations",
    paths.telemetryObservations,
    "--pattern-runtime-observations",
    paths.patternRuntimeObservations,
    "--delivery-observations",
    paths.deliveryObservations,
    "--policy",
    "fixtures/policies/default.yaml",
  ];
}

function reportGenerateArgs(paths, repoRoot) {
  return [
    "run",
    "--silent",
    "dev",
    "--",
    "report.generate",
    "--domain",
    "architecture_design",
    "--repo",
    repoRoot,
    "--constraints",
    paths.constraints,
    "--boundary-map",
    paths.boundaryMap,
    "--scenario-catalog",
    paths.scenarios,
    "--scenario-observations",
    paths.scenarioObservations,
    "--topology-model",
    paths.topology,
    "--runtime-observations",
    paths.runtimeObservations,
    "--telemetry-observations",
    paths.telemetryObservations,
    "--pattern-runtime-observations",
    paths.patternRuntimeObservations,
    "--delivery-observations",
    paths.deliveryObservations,
    "--policy",
    "fixtures/policies/default.yaml",
    "--format",
    "md",
  ];
}

export function createArchitectureBenchmarkPlan({ paths, repoRoot }) {
  return [
    {
      scenarioId: "S-001",
      note: "`npm run dev -- score.compute --domain architecture_design ...`",
      sourceLabel: "score.compute",
      run: {
        kind: "execFile",
        file: "npm",
        args: scoreComputeArgs(paths, repoRoot),
      },
    },
    {
      scenarioId: "S-002",
      note: "`npm run dev -- report.generate --domain architecture_design ... --format md`",
      sourceLabel: "report.generate",
      run: {
        kind: "execFile",
        file: "npm",
        args: reportGenerateArgs(paths, repoRoot),
      },
    },
    {
      scenarioId: "S-003",
      note: "`npm run check && npm test`",
      sourceLabel: "local verification cycle",
      run: {
        kind: "sequence",
        steps: [
          {
            file: "npm",
            args: ["run", "--silent", "check"],
          },
          {
            file: "npm",
            args: ["test"],
          },
        ],
      },
      overrideEnvVar: "CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND",
    },
  ];
}

export function mapLayerNameToBoundaryName(layerName) {
  return ARCHITECTURE_BOUNDARY_NAME_ALIASES[layerName] ?? layerName;
}
