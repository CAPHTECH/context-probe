import { rm } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { createTemporaryWorkspace } from "./helpers.js";
import {
  auditArchitectureSelfMeasurement,
  PROJECT_ENTRIES,
  refreshArchitectureSelfMeasurement,
} from "./self-measurement-audit.helpers.js";

export function registerSelfMeasurementAuditMissingTests(state: { repoPath?: string }): void {
  test("warns when the contract baseline is missing without failing", async () => {
    state.repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await refreshArchitectureSelfMeasurement(state.repoPath);

    const contractBaselinePath = path.join(
      state.repoPath,
      "config/self-measurement/architecture-contract-baseline.yaml",
    );
    await rm(contractBaselinePath, { force: true });

    const { stdout, stderr } = await auditArchitectureSelfMeasurement(state.repoPath);

    expect(stdout).toContain("architecture self-measurement freshness: 1 warning(s)");
    expect(stderr).toContain(
      "Contract baseline config/self-measurement/architecture-contract-baseline.yaml is missing.",
    );
  }, 60000);

  test("warns when the derived complexity export is missing without failing", async () => {
    state.repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await refreshArchitectureSelfMeasurement(state.repoPath);

    const complexityExportPath = path.join(
      state.repoPath,
      "config/self-measurement/architecture-complexity-export.yaml",
    );
    await rm(complexityExportPath, { force: true });

    const { stdout, stderr } = await auditArchitectureSelfMeasurement(state.repoPath);

    expect(stdout).toContain("architecture self-measurement freshness: 1 warning(s)");
    expect(stderr).toContain(
      "Derived complexity export config/self-measurement/architecture-complexity-export.yaml is missing.",
    );
  }, 60000);

  test("warns when the curated complexity snapshot is missing without failing", async () => {
    state.repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await refreshArchitectureSelfMeasurement(state.repoPath);

    const complexitySnapshotPath = path.join(
      state.repoPath,
      "config/self-measurement/architecture-complexity-snapshot.yaml",
    );
    await rm(complexitySnapshotPath, { force: true });

    const { stdout, stderr } = await auditArchitectureSelfMeasurement(state.repoPath);

    expect(stdout).toContain("architecture self-measurement freshness: 1 warning(s)");
    expect(stderr).toContain(
      "Curated snapshot config/self-measurement/architecture-complexity-snapshot.yaml is missing.",
    );
  }, 60000);
}
