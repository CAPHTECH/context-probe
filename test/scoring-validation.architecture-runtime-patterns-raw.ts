import { registerArchitectureRuntimePatternRawFamilyScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-raw-family.js";
import { registerArchitectureRuntimePatternRawPrecedenceScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-raw-precedence.js";

export function registerArchitectureRuntimePatternRawScoringValidationTests(): void {
  registerArchitectureRuntimePatternRawFamilyScoringValidationTests();
  registerArchitectureRuntimePatternRawPrecedenceScoringValidationTests();
}
