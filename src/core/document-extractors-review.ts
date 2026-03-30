import type { GlossaryTerm, InvariantCandidate, ReviewResolutionLog, RuleCandidate } from "./contracts.js";
import { applyReviewOverrides } from "./review.js";

export function applyGlossaryReview(
  items: GlossaryTerm[],
  applyReviewLog: boolean | undefined,
  reviewLog?: ReviewResolutionLog,
) {
  return applyReviewLog ? applyReviewOverrides(items, reviewLog, "termId") : items;
}

export function applyRulesReview(
  items: RuleCandidate[],
  applyReviewLog: boolean | undefined,
  reviewLog?: ReviewResolutionLog,
) {
  return applyReviewLog ? applyReviewOverrides(items, reviewLog, "ruleId") : items;
}

export function applyInvariantsReview(
  items: InvariantCandidate[],
  applyReviewLog: boolean | undefined,
  reviewLog?: ReviewResolutionLog,
) {
  return applyReviewLog ? applyReviewOverrides(items, reviewLog, "invariantId") : items;
}
