import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test } from "vitest";

import { createTemporaryWorkspace } from "./helpers.js";
import { PROJECT_ENTRIES, refreshArchitectureSelfMeasurement } from "./self-measurement-audit.helpers.js";

const execFile = promisify(execFileCallback);
const CHECK_SCRIPT_PATH = path.resolve("scripts/self-measurement/check-architecture-self-measurement.mjs");

export function registerSelfMeasurementCheckTests(state: { repoPath?: string }): void {
  test("runs the architecture self-measurement audit and score smoke together", async () => {
    state.repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    await refreshArchitectureSelfMeasurement(state.repoPath);

    const { stdout, stderr } = await execFile(
      process.execPath,
      [CHECK_SCRIPT_PATH, "--repo-root", state.repoPath, "--now", "2026-03-30T00:00:00Z"],
      { cwd: process.cwd() },
    );

    expect(stdout).toContain("architecture self-measurement freshness: no warnings");
    expect(stdout).toContain("architecture self-measurement check: ok");
    expect(stderr).toBe("");
  }, 60000);
}
