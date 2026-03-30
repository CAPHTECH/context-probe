import { registerDomainHistoryLocalityComparisonScoringValidationTests } from "./scoring-validation.domain-history-locality-comparison.js";
import { registerDomainHistoryLocalityPersistenceScoringValidationTests } from "./scoring-validation.domain-history-locality-persistence.js";
import { registerDomainHistoryLocalityShadowScoringValidationTests } from "./scoring-validation.domain-history-locality-shadow.js";

export function registerDomainHistoryLocalityScoringValidationTests(tempRoots: string[]): void {
  registerDomainHistoryLocalityComparisonScoringValidationTests(tempRoots);
  registerDomainHistoryLocalityShadowScoringValidationTests(tempRoots);
  registerDomainHistoryLocalityPersistenceScoringValidationTests(tempRoots);
}
