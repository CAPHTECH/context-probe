import { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";
import { createDefaultExtractionOptions, type ExtractionOptions } from "./scaffold-shared.js";
import { buildTermTraceLinks } from "./trace.js";

export type GlossaryExtractionResult = Awaited<ReturnType<typeof extractGlossary>>;
type RulesExtractionResult = Awaited<ReturnType<typeof extractRules>>;
type InvariantsExtractionResult = Awaited<ReturnType<typeof extractInvariants>>;

export interface DocsBundle {
  glossary: GlossaryExtractionResult;
  rules: RulesExtractionResult;
  invariants: InvariantsExtractionResult;
  termLinks: Awaited<ReturnType<typeof buildTermTraceLinks>>;
}

interface CodebaseFiles {
  scorableSourceFiles: string[];
}

export async function buildDocsBundle(
  repoRoot: string,
  docsRoot: string,
  codebase: CodebaseFiles,
  extractionOptions: ExtractionOptions | undefined,
): Promise<DocsBundle> {
  const options = extractionOptions ?? createDefaultExtractionOptions(docsRoot, repoRoot);
  const [glossary, rules, invariants] = await Promise.all([
    extractGlossary(options),
    extractRules(options),
    extractInvariants(options),
  ]);
  const termLinks = await buildTermTraceLinks({
    docsRoot,
    repoRoot,
    terms: glossary.terms,
    codeFiles: codebase.scorableSourceFiles,
  });
  return { glossary, rules, invariants, termLinks };
}
