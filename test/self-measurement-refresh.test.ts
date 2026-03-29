import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";
import YAML from "yaml";

import { COMMANDS } from "../src/commands.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace } from "./helpers.js";

const execFile = promisify(execFileCallback);

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const REFRESH_SCRIPT_PATH = path.resolve("scripts/self-measurement/refresh-architecture-inputs.mjs");
const PROJECT_ENTRIES = ["src", "config/self-measurement"];

describe("architecture self-measurement refresh", () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupTemporaryRepo(repoPath);
      repoPath = undefined;
    }
  });

  test("refreshes measured and derived self-measurement inputs with loadable output", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);

    await execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
      },
    });

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
    }>(path.join(repoPath, "config/self-measurement/architecture-scenario-observations.yaml"));
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
    }>(path.join(repoPath, "config/self-measurement/architecture-boundary-map.yaml"));
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

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        constraints: path.join(repoPath, "config/self-measurement/architecture-constraints.yaml"),
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": path.join(repoPath, "config/self-measurement/architecture-boundary-map.yaml"),
        "scenario-catalog": path.join(repoPath, "config/self-measurement/architecture-scenarios.yaml"),
        "scenario-observations": path.join(repoPath, "config/self-measurement/architecture-scenario-observations.yaml"),
        "topology-model": path.join(repoPath, "config/self-measurement/architecture-topology.yaml"),
        "runtime-observations": path.join(repoPath, "config/self-measurement/architecture-runtime-observations.yaml"),
        "telemetry-observations": path.join(
          repoPath,
          "config/self-measurement/architecture-telemetry-observations.yaml",
        ),
        "pattern-runtime-observations": path.join(
          repoPath,
          "config/self-measurement/architecture-pattern-runtime-observations.yaml",
        ),
        "delivery-observations": path.join(repoPath, "config/self-measurement/architecture-delivery-observations.yaml"),
      },
      { cwd: process.cwd() },
    );
    expect(response.status).not.toBe("error");
    expect(response.unknowns).not.toContain("No scenario catalog was provided, so QSF is unobserved.");
  }, 60000);

  test("warns on stale curated snapshots and boundary drift without failing", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);

    const telemetryPath = path.join(repoPath, "config/self-measurement/architecture-telemetry-observations.yaml");
    const staleTelemetry = await readYaml<Record<string, unknown>>(telemetryPath);
    staleTelemetry.snapshot = {
      sourceKind: "curated",
      reviewedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(telemetryPath, staleTelemetry);

    const boundaryMapPath = path.join(repoPath, "config/self-measurement/architecture-boundary-map.yaml");
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

    const { stderr } = await execFile(
      process.execPath,
      [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
        },
      },
    );

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
});

async function readYaml<T>(filePath: string): Promise<T> {
  return YAML.parse(await readFile(filePath, "utf8")) as T;
}

async function writeYaml(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, YAML.stringify(value), "utf8");
}
