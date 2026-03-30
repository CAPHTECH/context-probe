import { expect, test } from "vitest";

import { createTemporaryWorkspace } from "./helpers.js";
import {
  auditArchitectureSelfMeasurement,
  PROJECT_ENTRIES,
  refreshArchitectureSelfMeasurement,
} from "./self-measurement-audit.helpers.js";

export function registerSelfMeasurementAuditCleanTests(state: { repoPath?: string }): void {
  test("reports a clean bundle when self-measurement snapshots are fresh", async () => {
    state.repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await refreshArchitectureSelfMeasurement(state.repoPath);

    const { stdout, stderr } = await auditArchitectureSelfMeasurement(state.repoPath);

    expect(stdout).toContain("architecture self-measurement freshness: no warnings");
    expect(stderr).toBe("");
  }, 60000);
}
