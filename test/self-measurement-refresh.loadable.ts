import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace } from "./helpers.js";
import {
  BOUNDARY_MAP_ENTRY,
  COMPLEXITY_EXPORT_ENTRY,
  DELIVERY_OBSERVATIONS_ENTRY,
  PATTERN_RUNTIME_OBSERVATIONS_ENTRY,
  POLICY_PATH,
  PROJECT_ENTRIES,
  RUNTIME_OBSERVATIONS_ENTRY,
  SCENARIO_CATALOG_ENTRY,
  SCENARIO_OBSERVATIONS_ENTRY,
  TELEMETRY_OBSERVATIONS_ENTRY,
  TOPOLOGY_ENTRY,
} from "./self-measurement.shared.js";
import { readYaml, runSelfMeasurementRefresh } from "./self-measurement-refresh.helpers.js";

export function registerSelfMeasurementRefreshLoadableTests(state: { repoPath?: string }): void {
  test("refreshes measured and derived self-measurement inputs with loadable output", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;
    const complexityExportBefore = await readFile(path.join(repoPath, COMPLEXITY_EXPORT_ENTRY), "utf8");

    await runSelfMeasurementRefresh(repoPath);

    const benchmarkSummary = JSON.parse(
      await readFile(
        path.join(repoPath, "config/self-measurement/architecture-scenario-benchmark-summary.json"),
        "utf8",
      ),
    ) as {
      snapshot?: { sourceKind?: string; capturedAt?: string };
      benchmarkSummary?: { observations?: Array<{ scenarioId: string; observed: number }> };
    };
    expect(benchmarkSummary.snapshot).toEqual({
      sourceKind: "measured",
      capturedAt: "2026-03-30T00:00:00Z",
    });
    expect(benchmarkSummary.benchmarkSummary?.observations?.map((entry) => entry.scenarioId)).toEqual([
      "S-001",
      "S-002",
      "S-003",
    ]);
    expect(benchmarkSummary.benchmarkSummary?.observations?.every((entry) => entry.observed >= 0)).toBe(true);

    const scenarioObservations = await readYaml<{
      snapshot?: { sourceKind?: string; capturedAt?: string };
      observations?: Array<{ scenarioId: string }>;
    }>(path.join(repoPath, SCENARIO_OBSERVATIONS_ENTRY));
    expect(scenarioObservations.snapshot).toEqual({
      sourceKind: "measured",
      capturedAt: "2026-03-30T00:00:00Z",
    });
    expect(scenarioObservations.observations?.map((entry) => entry.scenarioId)).toEqual(["S-001", "S-002", "S-003"]);

    const boundaryMap = await readYaml<{
      snapshot?: {
        sourceKind?: string;
        capturedAt?: string;
        derivedFrom?: { path?: string; sha256?: string };
      };
      boundaries?: Array<{ name: string }>;
    }>(path.join(repoPath, BOUNDARY_MAP_ENTRY));
    expect(boundaryMap.snapshot?.sourceKind).toBe("derived");
    expect(boundaryMap.snapshot?.capturedAt).toBe("2026-03-30T00:00:00Z");
    expect(boundaryMap.snapshot?.derivedFrom?.path).toBe("config/self-measurement/architecture-constraints.yaml");
    expect(boundaryMap.snapshot?.derivedFrom?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(boundaryMap.boundaries?.map((entry) => entry.name)).toEqual([
      "contracts",
      "foundation",
      "analysis",
      "application",
    ]);

    const complexityExportAfter = await readFile(path.join(repoPath, COMPLEXITY_EXPORT_ENTRY), "utf8");
    expect(complexityExportAfter).toBe(complexityExportBefore);

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        constraints: path.join(repoPath, "config/self-measurement/architecture-constraints.yaml"),
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": path.join(repoPath, COMPLEXITY_EXPORT_ENTRY),
        "boundary-map": path.join(repoPath, BOUNDARY_MAP_ENTRY),
        "scenario-catalog": path.join(repoPath, SCENARIO_CATALOG_ENTRY),
        "scenario-observations": path.join(repoPath, SCENARIO_OBSERVATIONS_ENTRY),
        "topology-model": path.join(repoPath, TOPOLOGY_ENTRY),
        "runtime-observations": path.join(repoPath, RUNTIME_OBSERVATIONS_ENTRY),
        "telemetry-observations": path.join(repoPath, TELEMETRY_OBSERVATIONS_ENTRY),
        "pattern-runtime-observations": path.join(repoPath, PATTERN_RUNTIME_OBSERVATIONS_ENTRY),
        "delivery-observations": path.join(repoPath, DELIVERY_OBSERVATIONS_ENTRY),
      },
      { cwd: process.cwd() },
    );
    expect(response.status).not.toBe("error");
    expect(response.unknowns).not.toContain("No scenario catalog was provided, so QSF is unobserved.");
  }, 60000);
}
