import { afterEach, describe } from "vitest";

import { cleanupTemporaryRepo } from "./helpers.js";
import { registerSelfMeasurementRefreshLoadableTests } from "./self-measurement-refresh.loadable.js";
import { registerSelfMeasurementRefreshStaleTests } from "./self-measurement-refresh.stale.js";

describe("architecture self-measurement refresh", () => {
  const state: { repoPath?: string } = {};

  afterEach(async () => {
    if (state.repoPath) {
      await cleanupTemporaryRepo(state.repoPath);
      delete state.repoPath;
    }
  });

  registerSelfMeasurementRefreshLoadableTests(state);
  registerSelfMeasurementRefreshStaleTests(state);
});
