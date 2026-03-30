import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace } from "./helpers.js";
import { MODEL_ENTRY, POLICY_PATH, PROJECT_ENTRIES } from "./self-measurement.shared.js";

export function registerSelfMeasurementNoGitTests(state: { repoPath?: string }): void {
  test("degrades gracefully when git metadata is absent", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    expect(response.diagnostics.some((entry) => entry.includes("Skipped history analysis"))).toBe(true);
    expect(response.unknowns).toContain("Git information required for history analysis is missing.");
  });
}
