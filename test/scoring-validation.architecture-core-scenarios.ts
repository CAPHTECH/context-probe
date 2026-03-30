import { registerArchitectureCoreScenarioPrecedenceScoringValidationTests } from "./scoring-validation.architecture-core-scenarios-precedence.js";
import { registerArchitectureCoreScenarioSourceScoringValidationTests } from "./scoring-validation.architecture-core-scenarios-sources.js";
import { registerArchitectureCoreScenarioValueScoringValidationTests } from "./scoring-validation.architecture-core-scenarios-values.js";

export function registerArchitectureCoreScenarioScoringValidationTests(tempRoots: string[]): void {
  registerArchitectureCoreScenarioValueScoringValidationTests();
  registerArchitectureCoreScenarioSourceScoringValidationTests(tempRoots);
  registerArchitectureCoreScenarioPrecedenceScoringValidationTests(tempRoots);
}
