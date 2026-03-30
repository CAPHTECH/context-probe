import { registerArchitectureRuntimePatternFamilyFamilyScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-family-family.js";
import { registerArchitectureRuntimePatternFamilyObservabilityScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-family-observability.js";

export function registerArchitectureRuntimePatternFamilyScoringValidationTests(): void {
  registerArchitectureRuntimePatternFamilyFamilyScoringValidationTests();
  registerArchitectureRuntimePatternFamilyObservabilityScoringValidationTests();
}
