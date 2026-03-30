import { afterEach, describe } from "vitest";

import { cleanupTemporaryRepo } from "./helpers.js";
import { registerSelfMeasurementAuditCleanTests } from "./self-measurement-audit.clean.js";
import { registerSelfMeasurementAuditMissingTests } from "./self-measurement-audit.missing.js";
import { registerSelfMeasurementAuditStaleTests } from "./self-measurement-audit.stale.js";

describe("architecture self-measurement audit", () => {
  const state: { repoPath?: string } = {};

  afterEach(async () => {
    if (state.repoPath) {
      await cleanupTemporaryRepo(state.repoPath);
      delete state.repoPath;
    }
  });

  registerSelfMeasurementAuditCleanTests(state);
  registerSelfMeasurementAuditStaleTests(state);
  registerSelfMeasurementAuditMissingTests(state);
});
