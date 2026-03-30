import { registerArchitectureEvolutionDeliveryNormalizationScoringValidationTests } from "./scoring-validation.architecture-evolution-delivery-normalization.js";
import { registerArchitectureEvolutionDeliverySourceScoringValidationTests } from "./scoring-validation.architecture-evolution-delivery-sources.js";
import { registerArchitectureEvolutionLocalityScoringValidationTests } from "./scoring-validation.architecture-evolution-locality.js";

export function registerArchitectureEvolutionScoringValidationTests(tempRoots: string[]): void {
  registerArchitectureEvolutionLocalityScoringValidationTests(tempRoots);
  registerArchitectureEvolutionDeliveryNormalizationScoringValidationTests(tempRoots);
  registerArchitectureEvolutionDeliverySourceScoringValidationTests(tempRoots);
}
