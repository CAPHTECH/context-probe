import { registerArchitectureCoreComplexityScoringValidationTests } from "./scoring-validation.architecture-core-complexity.js";
import { registerArchitectureCoreCompositeScoringValidationTests } from "./scoring-validation.architecture-core-composite.js";
import { registerArchitectureCoreProtocolScoringValidationTests } from "./scoring-validation.architecture-core-protocol.js";
import { registerArchitectureCoreScenarioScoringValidationTests } from "./scoring-validation.architecture-core-scenarios.js";
import { registerArchitectureCoreStructureScoringValidationTests } from "./scoring-validation.architecture-core-structure.js";

export function registerArchitectureCoreScoringValidationTests(tempRoots: string[]): void {
  registerArchitectureCoreStructureScoringValidationTests();
  registerArchitectureCoreProtocolScoringValidationTests(tempRoots);
  registerArchitectureCoreComplexityScoringValidationTests(tempRoots);
  registerArchitectureCoreScenarioScoringValidationTests(tempRoots);
  registerArchitectureCoreCompositeScoringValidationTests();
}
