import { afterEach, describe } from "vitest";

import { cleanupTemporaryRepo } from "./helpers.js";
import { registerSelfMeasurementClassificationTests } from "./self-measurement.classification.js";
import { registerSelfMeasurementNoGitTests } from "./self-measurement.no-git.js";
import { registerSelfMeasurementSmokeTests } from "./self-measurement.smoke.js";

describe("self measurement", () => {
  const state: { repoPath?: string } = {};

  afterEach(async () => {
    if (state.repoPath) {
      await cleanupTemporaryRepo(state.repoPath);
      delete state.repoPath;
    }
  });

  registerSelfMeasurementSmokeTests(state);
  registerSelfMeasurementClassificationTests(state);
  registerSelfMeasurementNoGitTests(state);
});
