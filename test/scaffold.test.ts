import { afterEach, describe } from "vitest";

import { cleanupTemporaryRepo } from "./helpers.js";
import { registerScaffoldArchitectureGenericTests } from "./scaffold-architecture-generic.js";
import { registerScaffoldConstraintsTests } from "./scaffold-constraints.js";
import { registerScaffoldDomainNoiseTests } from "./scaffold-domain-noise.js";
import { registerScaffoldExplicitAggregateTests } from "./scaffold-explicit-aggregates.js";
import { registerScaffoldModelTests } from "./scaffold-model.js";

describe("scaffold commands", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
  });

  registerScaffoldModelTests(tempRoots);
  registerScaffoldConstraintsTests(tempRoots);
  registerScaffoldExplicitAggregateTests(tempRoots);
  registerScaffoldArchitectureGenericTests(tempRoots);
  registerScaffoldDomainNoiseTests();
});
