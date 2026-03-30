import { rm } from "node:fs/promises";

import { afterEach, describe } from "vitest";

import { registerShadowRolloutGateEvaluationTests } from "./shadow-rollout-gate.evaluation.js";
import { registerShadowRolloutGateRegistryTests } from "./shadow-rollout-gate.registry.js";

describe("shadow rollout gate command", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const current = tempPaths.pop();
      if (current) {
        await rm(current, { recursive: true, force: true });
      }
    }
  });

  registerShadowRolloutGateRegistryTests(tempPaths);
  registerShadowRolloutGateEvaluationTests();
});
