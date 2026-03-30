import { registerArchitectureCoreCompositeApsiScoringValidationTests } from "./scoring-validation.architecture-core-composite-apsi.js";
import { registerArchitectureCoreCompositePolicyScoringValidationTests } from "./scoring-validation.architecture-core-composite-policy.js";

export function registerArchitectureCoreCompositeScoringValidationTests(): void {
  registerArchitectureCoreCompositeApsiScoringValidationTests();
  registerArchitectureCoreCompositePolicyScoringValidationTests();
}
