export {
  buildMetadata,
  createEvidenceFromFragment,
  createInvariantId,
  createRuleId,
  createTermId,
  findFragmentsByIds,
} from "./document-extractor-identity.js";
export {
  buildInvariantReviewState,
  hasAnySignal,
  hasPredicateShape,
  INVARIANT_PREDICATE_PATTERNS,
  INVARIANT_SIGNALS,
  isListItemLine,
  isQuestionLikeStatement,
  isStructuredNoiseFragment,
  normalizeInlineTerm,
  normalizeStatement,
  RULE_INVARIANT_AMBIGUITY,
  RULE_PREDICATE_PATTERNS,
  RULE_SIGNALS,
  splitIntoSentences,
  stripListMarker,
} from "./document-extractor-text.js";
export type {
  ExtractionOptions,
  HeuristicStatementCandidate,
  HeuristicTermCandidate,
  StatementSegment,
} from "./document-extractor-types.js";
