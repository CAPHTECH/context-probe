import { registerDomainDocsAfsScoringValidationTests } from "./scoring-validation.domain-docs-afs.js";
import { registerDomainDocsBfsScoringValidationTests } from "./scoring-validation.domain-docs-bfs.js";
import { registerDomainDocsDrfScoringValidationTests } from "./scoring-validation.domain-docs-drf.js";
import { registerDomainDocsUliScoringValidationTests } from "./scoring-validation.domain-docs-uli.js";

export function registerDomainDocsScoringValidationTests(tempRoots: string[]): void {
  registerDomainDocsUliScoringValidationTests(tempRoots);
  registerDomainDocsDrfScoringValidationTests(tempRoots);
  registerDomainDocsBfsScoringValidationTests(tempRoots);
  registerDomainDocsAfsScoringValidationTests(tempRoots);
}
