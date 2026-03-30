import { registerArchitectureRuntimeOasInputExportScoringValidationTests } from "./scoring-validation.architecture-runtime-oas-inputs-export.js";
import { registerArchitectureRuntimeOasInputPrecedenceScoringValidationTests } from "./scoring-validation.architecture-runtime-oas-inputs-precedence.js";
import { registerArchitectureRuntimeOasInputRawScoringValidationTests } from "./scoring-validation.architecture-runtime-oas-inputs-raw.js";
import { registerArchitectureRuntimeOasInputSignalScoringValidationTests } from "./scoring-validation.architecture-runtime-oas-inputs-signal.js";
import { registerArchitectureRuntimeOasInputSourceScoringValidationTests } from "./scoring-validation.architecture-runtime-oas-inputs-source.js";

export function registerArchitectureRuntimeOasInputScoringValidationTests(tempRoots: string[]): void {
  registerArchitectureRuntimeOasInputSignalScoringValidationTests();
  registerArchitectureRuntimeOasInputRawScoringValidationTests();
  registerArchitectureRuntimeOasInputExportScoringValidationTests();
  registerArchitectureRuntimeOasInputSourceScoringValidationTests(tempRoots);
  registerArchitectureRuntimeOasInputPrecedenceScoringValidationTests(tempRoots);
}
