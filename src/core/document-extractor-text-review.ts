import { INVARIANT_REVIEW_SIGNALS } from "./document-extractor-text-signals.js";
import type { HeuristicStatementCandidate } from "./document-extractor-types.js";

export const INVARIANT_ACCEPTANCE_AMBIGUITY =
  "The boundary between an invariant and an acceptance condition is ambiguous.";

export function buildInvariantReviewState(
  statement: string,
  sourceKind: "sentence" | "bullet",
): Pick<HeuristicStatementCandidate, "confidence" | "unknowns"> {
  const bulletPenalty = sourceKind === "bullet" ? 0.06 : 0;
  if (INVARIANT_REVIEW_SIGNALS.some((pattern) => pattern.test(statement))) {
    return {
      confidence: 0.68 - bulletPenalty,
      unknowns: [INVARIANT_ACCEPTANCE_AMBIGUITY],
    };
  }
  return {
    confidence: 0.82 - bulletPenalty,
    unknowns: [],
  };
}
