import path from "node:path";

import { expect, test } from "vitest";

import { createTemporaryWorkspace } from "./helpers.js";
import {
  auditArchitectureSelfMeasurement,
  PROJECT_ENTRIES,
  readYaml,
  refreshArchitectureSelfMeasurement,
  writeYaml,
} from "./self-measurement-audit.helpers.js";

export function registerSelfMeasurementAuditStaleTests(state: { repoPath?: string }): void {
  test("warns on stale measured, curated, and derived snapshots without failing", async () => {
    state.repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await refreshArchitectureSelfMeasurement(state.repoPath);

    const scenarioObservationsPath = path.join(
      state.repoPath,
      "config/self-measurement/architecture-scenario-observations.yaml",
    );
    const staleScenarioObservations = await readYaml<Record<string, unknown>>(scenarioObservationsPath);
    staleScenarioObservations.snapshot = {
      sourceKind: "measured",
      capturedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(scenarioObservationsPath, staleScenarioObservations);

    const telemetryPath = path.join(state.repoPath, "config/self-measurement/architecture-telemetry-observations.yaml");
    const staleTelemetry = await readYaml<Record<string, unknown>>(telemetryPath);
    staleTelemetry.snapshot = {
      sourceKind: "curated",
      reviewedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(telemetryPath, staleTelemetry);

    const complexitySnapshotPath = path.join(
      state.repoPath,
      "config/self-measurement/architecture-complexity-snapshot.yaml",
    );
    const staleComplexitySnapshot = await readYaml<Record<string, unknown>>(complexitySnapshotPath);
    staleComplexitySnapshot.snapshot = {
      sourceKind: "curated",
      reviewedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(complexitySnapshotPath, staleComplexitySnapshot);

    const boundaryMapPath = path.join(state.repoPath, "config/self-measurement/architecture-boundary-map.yaml");
    const staleBoundaryMap = await readYaml<Record<string, unknown>>(boundaryMapPath);
    staleBoundaryMap.snapshot = {
      sourceKind: "derived",
      capturedAt: "2026-03-01T00:00:00Z",
      derivedFrom: {
        path: "config/self-measurement/architecture-constraints.yaml",
        sha256: "deadbeef",
      },
    };
    await writeYaml(boundaryMapPath, staleBoundaryMap);

    const complexityExportPath = path.join(
      state.repoPath,
      "config/self-measurement/architecture-complexity-export.yaml",
    );
    const staleComplexityExport = await readYaml<Record<string, unknown>>(complexityExportPath);
    staleComplexityExport.snapshot = {
      sourceKind: "derived",
      capturedAt: "2026-03-01T00:00:00Z",
      derivedFrom: {
        path: "config/self-measurement/architecture-complexity-snapshot.yaml",
        sha256: "deadbeef",
      },
    };
    await writeYaml(complexityExportPath, staleComplexityExport);

    const { stdout, stderr } = await auditArchitectureSelfMeasurement(state.repoPath);

    expect(stdout).toContain("architecture self-measurement freshness: 5 warning(s)");
    expect(stderr).toContain(
      "Measured snapshot config/self-measurement/architecture-scenario-observations.yaml was captured at 2025-01-01T00:00:00Z",
    );
    expect(stderr).toContain(
      "Curated snapshot config/self-measurement/architecture-complexity-snapshot.yaml was last reviewed at 2025-01-01T00:00:00Z",
    );
    expect(stderr).toContain(
      "Curated snapshot config/self-measurement/architecture-telemetry-observations.yaml was last reviewed at 2025-01-01T00:00:00Z",
    );
    expect(stderr).toContain(
      "Derived boundary map config/self-measurement/architecture-boundary-map.yaml was generated from a different constraints hash.",
    );
    expect(stderr).toContain(
      "Derived complexity export config/self-measurement/architecture-complexity-export.yaml was generated from a different complexity snapshot hash.",
    );
  }, 60000);
}
