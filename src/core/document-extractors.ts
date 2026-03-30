import { normalizeDocuments } from "./artifacts.js";
import type { ExtractionKind, Fragment, GlossaryTerm, InvariantCandidate, RuleCandidate } from "./contracts.js";
import { normalizeGlossaryFromCli, normalizeGlossaryFromHeuristic } from "./document-extractor-glossary.js";
import { buildMetadata, type ExtractionOptions } from "./document-extractor-shared.js";
import {
  normalizeInvariantsFromCli,
  normalizeInvariantsFromHeuristic,
  normalizeRulesFromCli,
  normalizeRulesFromHeuristic,
} from "./document-extractor-statements.js";
import { runCliExtraction } from "./providers.js";
import { applyReviewOverrides } from "./review.js";

function applyGlossaryReview(items: GlossaryTerm[], options: ExtractionOptions): GlossaryTerm[] {
  return options.applyReviewLog ? applyReviewOverrides(items, options.reviewLog, "termId") : items;
}

function applyRulesReview(items: RuleCandidate[], options: ExtractionOptions): RuleCandidate[] {
  return options.applyReviewLog ? applyReviewOverrides(items, options.reviewLog, "ruleId") : items;
}

function applyInvariantsReview(items: InvariantCandidate[], options: ExtractionOptions): InvariantCandidate[] {
  return options.applyReviewLog ? applyReviewOverrides(items, options.reviewLog, "invariantId") : items;
}

async function extractWithProvider<T>(
  kind: ExtractionKind,
  fragments: Fragment[],
  options: ExtractionOptions,
  normalize: (rawItems: Record<string, unknown>[], fragments: Fragment[]) => T[],
) {
  if (!options.provider) {
    throw new Error("CLI extractor requires `provider`");
  }
  const providerResult = await runCliExtraction({
    cwd: options.cwd,
    provider: options.provider,
    kind,
    promptProfile: options.promptProfile ?? "default",
    fragments,
    ...(options.providerCommand ? { providerCommand: options.providerCommand } : {}),
  });

  return {
    fragments,
    items: normalize(providerResult.items, fragments),
    confidence: providerResult.confidence,
    unknowns: providerResult.unknowns,
    diagnostics: providerResult.diagnostics,
    provider: providerResult.provider,
  };
}

export async function extractGlossary(options: ExtractionOptions) {
  const metadata = buildMetadata(options);
  const fragments = await normalizeDocuments(options.root);
  const fallback = options.fallback ?? "heuristic";

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("glossary", fragments, options, normalizeGlossaryFromCli);
      return {
        fragments: extracted.fragments,
        terms: applyGlossaryReview(extracted.items, options),
        metadata: {
          ...metadata,
          provider: extracted.provider,
        },
        confidence: extracted.confidence,
        unknowns: extracted.unknowns,
        diagnostics: extracted.diagnostics,
      };
    } catch (error) {
      if (fallback === "none") {
        throw error;
      }
      const terms = normalizeGlossaryFromHeuristic(fragments);
      return {
        fragments,
        terms: applyGlossaryReview(terms, options),
        metadata,
        confidence: 0.55,
        unknowns: ["The CLI extractor failed, so a heuristic fallback was used."],
        diagnostics: [error instanceof Error ? error.message : "CLI extractor failed"],
      };
    }
  }

  const terms = normalizeGlossaryFromHeuristic(fragments);
  return {
    fragments,
    terms: applyGlossaryReview(terms, options),
    metadata,
    confidence: 0.7,
    unknowns: [],
    diagnostics: [],
  };
}

export async function extractRules(options: ExtractionOptions) {
  const metadata = buildMetadata(options);
  const fragments = await normalizeDocuments(options.root);
  const fallback = options.fallback ?? "heuristic";

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("rules", fragments, options, normalizeRulesFromCli);
      return {
        rules: applyRulesReview(extracted.items, options),
        fragments: extracted.fragments,
        metadata: {
          ...metadata,
          provider: extracted.provider,
        },
        confidence: extracted.confidence,
        unknowns: extracted.unknowns,
        diagnostics: extracted.diagnostics,
      };
    } catch (error) {
      if (fallback === "none") {
        throw error;
      }
      const rules = normalizeRulesFromHeuristic(fragments);
      return {
        rules: applyRulesReview(rules, options),
        fragments,
        metadata,
        confidence: 0.55,
        unknowns: ["The CLI extractor failed, so a heuristic fallback was used."],
        diagnostics: [error instanceof Error ? error.message : "CLI extractor failed"],
      };
    }
  }

  const rules = normalizeRulesFromHeuristic(fragments);
  return {
    rules: applyRulesReview(rules, options),
    fragments,
    metadata,
    confidence: 0.7,
    unknowns: [],
    diagnostics: [],
  };
}

export async function extractInvariants(options: ExtractionOptions) {
  const metadata = buildMetadata(options);
  const fragments = await normalizeDocuments(options.root);
  const fallback = options.fallback ?? "heuristic";

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("invariants", fragments, options, normalizeInvariantsFromCli);
      return {
        invariants: applyInvariantsReview(extracted.items, options),
        fragments: extracted.fragments,
        metadata: {
          ...metadata,
          provider: extracted.provider,
        },
        confidence: extracted.confidence,
        unknowns: extracted.unknowns,
        diagnostics: extracted.diagnostics,
      };
    } catch (error) {
      if (fallback === "none") {
        throw error;
      }
      const invariants = normalizeInvariantsFromHeuristic(fragments);
      return {
        invariants: applyInvariantsReview(invariants, options),
        fragments,
        metadata,
        confidence: 0.55,
        unknowns: ["The CLI extractor failed, so a heuristic fallback was used."],
        diagnostics: [error instanceof Error ? error.message : "CLI extractor failed"],
      };
    }
  }

  const invariants = normalizeInvariantsFromHeuristic(fragments);
  return {
    invariants: applyInvariantsReview(invariants, options),
    fragments,
    metadata,
    confidence: 0.68,
    unknowns: [],
    diagnostics: [],
  };
}
