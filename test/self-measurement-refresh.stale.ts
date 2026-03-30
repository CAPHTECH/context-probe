import path from "node:path";

import { expect, test } from "vitest";

import { createTemporaryWorkspace } from "./helpers.js";
import { BOUNDARY_MAP_ENTRY, PROJECT_ENTRIES } from "./self-measurement.shared.js";
import { readYaml, runSelfMeasurementRefresh, writeYaml } from "./self-measurement-refresh.helpers.js";

export function registerSelfMeasurementRefreshStaleTests(state: { repoPath?: string }): void {
  test("warns on stale curated snapshots and boundary drift without failing", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;

    const telemetryPath = path.join(repoPath, "config/self-measurement/architecture-telemetry-observations.yaml");
    const staleTelemetry = await readYaml<Record<string, unknown>>(telemetryPath);
    staleTelemetry.snapshot = {
      sourceKind: "curated",
      reviewedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(telemetryPath, staleTelemetry);

    const boundaryMapPath = path.join(repoPath, BOUNDARY_MAP_ENTRY);
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

    const { stderr } = await runSelfMeasurementRefresh(repoPath);

    expect(stderr).toContain(
      "Curated snapshot config/self-measurement/architecture-telemetry-observations.yaml was last reviewed at 2025-01-01T00:00:00Z",
    );
    expect(stderr).toContain(
      "Derived boundary map config/self-measurement/architecture-boundary-map.yaml was generated from a different constraints hash",
    );

    const refreshedBoundaryMap = await readYaml<{
      snapshot?: { derivedFrom?: { sha256?: string } };
    }>(boundaryMapPath);
    expect(refreshedBoundaryMap.snapshot?.derivedFrom?.sha256).not.toBe("deadbeef");
  }, 60000);
}
