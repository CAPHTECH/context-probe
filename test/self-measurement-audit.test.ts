import { execFile as execFileCallback } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";
import YAML from "yaml";

import { cleanupTemporaryRepo, createTemporaryWorkspace } from "./helpers.js";

const execFile = promisify(execFileCallback);

const AUDIT_SCRIPT_PATH = path.resolve("scripts/self-measurement/audit-architecture-freshness.mjs");
const REFRESH_SCRIPT_PATH = path.resolve("scripts/self-measurement/refresh-architecture-inputs.mjs");
const PROJECT_ENTRIES = ["src", "config/self-measurement"];

describe("architecture self-measurement audit", () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupTemporaryRepo(repoPath);
      repoPath = undefined;
    }
  });

  test("reports a clean bundle when self-measurement snapshots are fresh", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
      },
    });

    const { stdout, stderr } = await execFile(
      process.execPath,
      [AUDIT_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
      },
    );

    expect(stdout).toContain("architecture self-measurement freshness: no warnings");
    expect(stderr).toBe("");
  }, 60000);

  test("warns on stale measured, curated, and derived snapshots without failing", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
      },
    });

    const scenarioObservationsPath = path.join(
      repoPath,
      "config/self-measurement/architecture-scenario-observations.yaml",
    );
    const staleScenarioObservations = await readYaml<Record<string, unknown>>(scenarioObservationsPath);
    staleScenarioObservations.snapshot = {
      sourceKind: "measured",
      capturedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(scenarioObservationsPath, staleScenarioObservations);

    const telemetryPath = path.join(repoPath, "config/self-measurement/architecture-telemetry-observations.yaml");
    const staleTelemetry = await readYaml<Record<string, unknown>>(telemetryPath);
    staleTelemetry.snapshot = {
      sourceKind: "curated",
      reviewedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(telemetryPath, staleTelemetry);

    const complexitySnapshotPath = path.join(repoPath, "config/self-measurement/architecture-complexity-snapshot.yaml");
    const staleComplexitySnapshot = await readYaml<Record<string, unknown>>(complexitySnapshotPath);
    staleComplexitySnapshot.snapshot = {
      sourceKind: "curated",
      reviewedAt: "2025-01-01T00:00:00Z",
    };
    await writeYaml(complexitySnapshotPath, staleComplexitySnapshot);

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

    const complexityExportPath = path.join(repoPath, "config/self-measurement/architecture-complexity-export.yaml");
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

    const { stdout, stderr } = await execFile(
      process.execPath,
      [AUDIT_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
      },
    );

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

  test("warns when the contract baseline is missing without failing", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
      },
    });

    const contractBaselinePath = path.join(repoPath, "config/self-measurement/architecture-contract-baseline.yaml");
    await rm(contractBaselinePath, { force: true });

    const { stdout, stderr } = await execFile(
      process.execPath,
      [AUDIT_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
      },
    );

    expect(stdout).toContain("architecture self-measurement freshness: 1 warning(s)");
    expect(stderr).toContain(
      "Contract baseline config/self-measurement/architecture-contract-baseline.yaml is missing.",
    );
  }, 60000);

  test("warns when the derived complexity export is missing without failing", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
      },
    });

    const complexityExportPath = path.join(repoPath, "config/self-measurement/architecture-complexity-export.yaml");
    await rm(complexityExportPath, { force: true });

    const { stdout, stderr } = await execFile(
      process.execPath,
      [AUDIT_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
      },
    );

    expect(stdout).toContain("architecture self-measurement freshness: 1 warning(s)");
    expect(stderr).toContain(
      "Derived complexity export config/self-measurement/architecture-complexity-export.yaml is missing.",
    );
  }, 60000);

  test("warns when the curated complexity snapshot is missing without failing", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
      },
    });

    const complexitySnapshotPath = path.join(repoPath, "config/self-measurement/architecture-complexity-snapshot.yaml");
    await rm(complexitySnapshotPath, { force: true });

    const { stdout, stderr } = await execFile(
      process.execPath,
      [AUDIT_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
      },
    );

    expect(stdout).toContain("architecture self-measurement freshness: 1 warning(s)");
    expect(stderr).toContain(
      "Curated snapshot config/self-measurement/architecture-complexity-snapshot.yaml is missing.",
    );
  }, 60000);
});

async function readYaml<T>(filePath: string): Promise<T> {
  return YAML.parse(await readFile(filePath, "utf8")) as T;
}

async function writeYaml(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, YAML.stringify(value), "utf8");
}
