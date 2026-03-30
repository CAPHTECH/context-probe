import { registerDomainHistoryLocalityMergeScoringValidationTests } from "./scoring-validation.domain-history-locality-models-merge.js";
import { registerDomainHistoryLocalityOrderingScoringValidationTests } from "./scoring-validation.domain-history-locality-models-ordering.js";
import { registerDomainHistoryLocalityRenameScoringValidationTests } from "./scoring-validation.domain-history-locality-models-rename.js";

export function registerDomainHistoryLocalityModelScoringValidationTests(tempRoots: string[]): void {
  registerDomainHistoryLocalityOrderingScoringValidationTests(tempRoots);
  registerDomainHistoryLocalityRenameScoringValidationTests(tempRoots);
  registerDomainHistoryLocalityMergeScoringValidationTests(tempRoots);
}
