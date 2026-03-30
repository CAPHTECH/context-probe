import { registerArchitectureRuntimePatternFamilyScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-family.js";
import { registerArchitectureRuntimePatternRawScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-raw.js";

export function registerArchitectureRuntimePatternScoringValidationTests(): void {
  registerArchitectureRuntimePatternFamilyScoringValidationTests();
  registerArchitectureRuntimePatternRawScoringValidationTests();
}
