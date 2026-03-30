import { normalizeGlossaryFromCli, normalizeGlossaryFromHeuristic } from "./document-extractor-glossary.js";
import {
  normalizeInvariantsFromCli,
  normalizeInvariantsFromHeuristic,
  normalizeRulesFromCli,
  normalizeRulesFromHeuristic,
} from "./document-extractor-statements.js";
import { applyGlossaryReview, applyInvariantsReview, applyRulesReview } from "./document-extractors-review.js";
import { extractWithProvider, normalizeExtractionOptions } from "./document-extractors-runner.js";

export async function extractGlossary(options: import("./document-extractor-types.js").ExtractionOptions) {
  const { metadata, fragments, fallback } = await normalizeExtractionOptions(options);

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("glossary", fragments, options, normalizeGlossaryFromCli);
      return {
        fragments: extracted.fragments,
        terms: applyGlossaryReview(extracted.items, options.applyReviewLog, options.reviewLog),
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
        terms: applyGlossaryReview(terms, options.applyReviewLog, options.reviewLog),
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
    terms: applyGlossaryReview(terms, options.applyReviewLog, options.reviewLog),
    metadata,
    confidence: 0.7,
    unknowns: [],
    diagnostics: [],
  };
}

export async function extractRules(options: import("./document-extractor-types.js").ExtractionOptions) {
  const { metadata, fragments, fallback } = await normalizeExtractionOptions(options);

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("rules", fragments, options, normalizeRulesFromCli);
      return {
        rules: applyRulesReview(extracted.items, options.applyReviewLog, options.reviewLog),
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
        rules: applyRulesReview(rules, options.applyReviewLog, options.reviewLog),
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
    rules: applyRulesReview(rules, options.applyReviewLog, options.reviewLog),
    fragments,
    metadata,
    confidence: 0.7,
    unknowns: [],
    diagnostics: [],
  };
}

export async function extractInvariants(options: import("./document-extractor-types.js").ExtractionOptions) {
  const { metadata, fragments, fallback } = await normalizeExtractionOptions(options);

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("invariants", fragments, options, normalizeInvariantsFromCli);
      return {
        invariants: applyInvariantsReview(extracted.items, options.applyReviewLog, options.reviewLog),
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
        invariants: applyInvariantsReview(invariants, options.applyReviewLog, options.reviewLog),
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
    invariants: applyInvariantsReview(invariants, options.applyReviewLog, options.reviewLog),
    fragments,
    metadata,
    confidence: 0.68,
    unknowns: [],
    diagnostics: [],
  };
}
