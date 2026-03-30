import { afterEach, describe } from "vitest";

import { registerPersistenceAdoptionBenchmarkTests } from "./persistence-adoption.benchmark.js";
import { cleanupPersistenceTempRoots } from "./persistence-adoption.helpers.js";
import { registerPersistenceAdoptionRealRepoTests } from "./persistence-adoption.real-repo.js";

describe("persistence adoption benchmark", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await cleanupPersistenceTempRoots(tempRoots);
  });

  registerPersistenceAdoptionBenchmarkTests(tempRoots);
  registerPersistenceAdoptionRealRepoTests();
});
