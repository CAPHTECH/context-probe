import { registerDomainHistoryLocalityScoringValidationTests } from "./scoring-validation.domain-history-locality.js";
import { registerDomainHistoryLocalityModelScoringValidationTests } from "./scoring-validation.domain-history-locality-models.js";
import { registerDomainHistoryMccsScoringValidationTests } from "./scoring-validation.domain-history-mccs.js";

export function registerDomainHistoryScoringValidationTests(tempRoots: string[]): void {
  registerDomainHistoryMccsScoringValidationTests(tempRoots);
  registerDomainHistoryLocalityScoringValidationTests(tempRoots);
  registerDomainHistoryLocalityModelScoringValidationTests(tempRoots);
}
