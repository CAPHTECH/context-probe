import { registerArchitectureEvolutionDeliveryInputSourceTests } from "./scoring-validation.architecture-evolution-delivery-source-inputs.js";
import { registerArchitectureEvolutionDeliverySourcePrecedenceTests } from "./scoring-validation.architecture-evolution-delivery-source-precedence.js";

export function registerArchitectureEvolutionDeliverySourceScoringValidationTests(tempRoots: string[]): void {
  registerArchitectureEvolutionDeliveryInputSourceTests(tempRoots);
  registerArchitectureEvolutionDeliverySourcePrecedenceTests(tempRoots);
}
