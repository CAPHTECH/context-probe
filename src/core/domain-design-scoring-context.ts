import type { CodebaseAnalysis, ExtractionBackend, ExtractionProviderName, ReviewResolutionLog } from "./contracts.js";
import { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";
import type { ProgressReporter } from "./progress.js";
import { buildTermTraceLinks } from "./trace.js";

export interface DomainDesignDocsLoaders {
  getGlossaryResult: () => Promise<Awaited<ReturnType<typeof extractGlossary>>>;
  getRulesResult: () => Promise<Awaited<ReturnType<typeof extractRules>>>;
  getInvariantsResult: () => Promise<Awaited<ReturnType<typeof extractInvariants>>>;
  getTermTraceLinks: () => Promise<Awaited<ReturnType<typeof buildTermTraceLinks>>>;
}

export function createDomainDesignDocsLoaders(options: {
  repoPath: string;
  docsRoot: string | undefined;
  reportProgress?: ProgressReporter;
  extraction:
    | {
        extractor: ExtractionBackend;
        provider?: ExtractionProviderName;
        providerCommand?: string;
        promptProfile?: string;
        fallback?: "heuristic" | "none";
        reviewLog?: ReviewResolutionLog;
        applyReviewLog?: boolean;
      }
    | undefined;
  codebase: CodebaseAnalysis;
}): DomainDesignDocsLoaders | null {
  const docsRoot = options.docsRoot;
  if (!docsRoot) {
    return null;
  }

  const docsExtractionOptions = {
    root: docsRoot,
    cwd: options.repoPath,
    extractor: options.extraction?.extractor ?? "heuristic",
    ...(options.extraction?.provider ? { provider: options.extraction.provider } : {}),
    ...(options.extraction?.providerCommand ? { providerCommand: options.extraction.providerCommand } : {}),
    promptProfile: options.extraction?.promptProfile ?? "default",
    fallback: options.extraction?.fallback ?? "heuristic",
    ...(options.extraction?.reviewLog ? { reviewLog: options.extraction.reviewLog } : {}),
    applyReviewLog: options.extraction?.applyReviewLog ?? false,
  } as const;

  let glossaryResultCache: Awaited<ReturnType<typeof extractGlossary>> | undefined;
  let rulesResultCache: Awaited<ReturnType<typeof extractRules>> | undefined;
  let invariantsResultCache: Awaited<ReturnType<typeof extractInvariants>> | undefined;
  let termTraceLinksCache: Awaited<ReturnType<typeof buildTermTraceLinks>> | undefined;

  const getGlossaryResult = async () => {
    if (!glossaryResultCache) {
      glossaryResultCache = await extractGlossary(docsExtractionOptions);
    }
    return glossaryResultCache;
  };
  const getRulesResult = async () => {
    if (!rulesResultCache) {
      rulesResultCache = await extractRules(docsExtractionOptions);
    }
    return rulesResultCache;
  };
  const getInvariantsResult = async () => {
    if (!invariantsResultCache) {
      invariantsResultCache = await extractInvariants(docsExtractionOptions);
    }
    return invariantsResultCache;
  };
  const getTermTraceLinks = async () => {
    if (!termTraceLinksCache) {
      const glossary = await getGlossaryResult();
      termTraceLinksCache = await buildTermTraceLinks({
        docsRoot,
        repoRoot: options.repoPath,
        terms: glossary.terms,
        codeFiles: options.codebase.scorableSourceFiles,
        onProgress: (update) => {
          options.reportProgress?.({
            phase: "docs",
            message: update.message,
            ...(update.elapsedMs !== undefined ? { elapsedMs: update.elapsedMs } : {}),
          });
        },
      });
    }
    return termTraceLinksCache;
  };

  return {
    getGlossaryResult,
    getRulesResult,
    getInvariantsResult,
    getTermTraceLinks,
  };
}
