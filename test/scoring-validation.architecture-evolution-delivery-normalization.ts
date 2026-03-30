import { registerArchitectureEvolutionDeliveryScoringValidationTests } from "./scoring-validation.architecture-evolution-delivery-normalization-direct.js";
import { registerArchitectureEvolutionDeliveryExportNormalizationScoringValidationTests } from "./scoring-validation.architecture-evolution-delivery-normalization-export.js";
import { registerArchitectureEvolutionDeliveryRawNormalizationScoringValidationTests } from "./scoring-validation.architecture-evolution-delivery-normalization-raw.js";

export function registerArchitectureEvolutionDeliveryNormalizationScoringValidationTests(tempRoots: string[]): void {
  registerArchitectureEvolutionDeliveryScoringValidationTests(tempRoots);
  registerArchitectureEvolutionDeliveryRawNormalizationScoringValidationTests(tempRoots);
  registerArchitectureEvolutionDeliveryExportNormalizationScoringValidationTests(tempRoots);
}
