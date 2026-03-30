import { registerArchitectureRuntimePatternRawFamilyCqrsScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-raw-family-cqrs.js";
import { registerArchitectureRuntimePatternRawFamilyEventDrivenScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-raw-family-event-driven.js";
import { registerArchitectureRuntimePatternRawFamilyLayeredScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-raw-family-layered.js";
import { registerArchitectureRuntimePatternRawFamilyMicroservicesScoringValidationTests } from "./scoring-validation.architecture-runtime-patterns-raw-family-microservices.js";

export function registerArchitectureRuntimePatternRawFamilyScoringValidationTests(): void {
  registerArchitectureRuntimePatternRawFamilyLayeredScoringValidationTests();
  registerArchitectureRuntimePatternRawFamilyMicroservicesScoringValidationTests();
  registerArchitectureRuntimePatternRawFamilyCqrsScoringValidationTests();
  registerArchitectureRuntimePatternRawFamilyEventDrivenScoringValidationTests();
}
