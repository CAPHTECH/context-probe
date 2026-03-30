import { afterEach, describe } from "vitest";

import { cleanupTemporaryRepo } from "./helpers.js";
import { registerSelfMeasurementCheckTests } from "./self-measurement-check.run.js";

describe("architecture self-measurement check", () => {
  const state: { repoPath?: string } = {};

  afterEach(async () => {
    if (state.repoPath) {
      await cleanupTemporaryRepo(state.repoPath);
      delete state.repoPath;
    }
  });

  registerSelfMeasurementCheckTests(state);
});
