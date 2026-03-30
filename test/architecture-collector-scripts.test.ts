import { afterEach, describe } from "vitest";

import { registerArchitectureCollectorComplexityTests } from "./architecture-collector-scripts.complexity.js";
import { registerArchitectureCollectorDeliveryTests } from "./architecture-collector-scripts.delivery.js";
import { registerArchitectureCollectorGoldenTests } from "./architecture-collector-scripts.golden.js";
import { registerArchitectureCollectorScenarioTests } from "./architecture-collector-scripts.scenario.js";
import { registerArchitectureCollectorTelemetryTests } from "./architecture-collector-scripts.telemetry.js";
import { cleanupTemporaryRepo } from "./helpers.js";

describe("architecture reference collectors", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
  });

  registerArchitectureCollectorGoldenTests();
  registerArchitectureCollectorTelemetryTests(tempRoots);
  registerArchitectureCollectorScenarioTests(tempRoots);
  registerArchitectureCollectorComplexityTests(tempRoots);
  registerArchitectureCollectorDeliveryTests(tempRoots);
});
