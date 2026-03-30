import { afterEach, describe } from "vitest";

import { registerArchitectureCoreScoringValidationTests } from "./scoring-validation.architecture-core.js";
import { registerArchitectureEvolutionScoringValidationTests } from "./scoring-validation.architecture-evolution.js";
import { registerArchitectureRuntimeScoringValidationTests } from "./scoring-validation.architecture-runtime.js";
import { registerDomainDocsScoringValidationTests } from "./scoring-validation.domain-docs.js";
import { registerDomainHistoryScoringValidationTests } from "./scoring-validation.domain-history.js";
import { cleanupValidationTempRoots } from "./scoring-validation.helpers.js";

describe("score validation", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await cleanupValidationTempRoots(tempRoots);
  });

  registerArchitectureCoreScoringValidationTests(tempRoots);
  registerArchitectureRuntimeScoringValidationTests(tempRoots);
  registerArchitectureEvolutionScoringValidationTests(tempRoots);
  registerDomainHistoryScoringValidationTests(tempRoots);
  registerDomainDocsScoringValidationTests(tempRoots);
});
