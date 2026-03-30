import { registerArchitectureRuntimeOasInputScoringValidationTests } from "./scoring-validation.architecture-runtime-oas-inputs.js";
import { registerArchitectureRuntimePatternScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns.js";
import { registerArchitectureRuntimeTopologyScoringValidationTests } from "./scoring-validation.architecture-runtime-tis.js";

export function registerArchitectureRuntimeScoringValidationTests(tempRoots: string[]): void {
  registerArchitectureRuntimeOasInputScoringValidationTests(tempRoots);
  registerArchitectureRuntimePatternScoringValidationTests();
  registerArchitectureRuntimeTopologyScoringValidationTests();
}
