import type { Fragment, InvariantCandidate, RuleCandidate } from "./contracts.js";
import { createEvidenceFromFragment, createInvariantId, createRuleId } from "./document-extractor-shared.js";
import {
  type ClassifiedStatementItem,
  collectHeuristicStatementClassifications,
} from "./document-extractor-statements-classification-core.js";

function toRuleCandidate(item: ClassifiedStatementItem): RuleCandidate {
  return {
    ruleId: createRuleId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "business_rule",
    statement: item.statement,
    confidence: item.confidence,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, item.confidence)],
    unknowns: item.unknowns,
    fragmentIds: [item.fragment.fragmentId],
    relatedTerms: [],
  };
}

function toInvariantCandidate(item: ClassifiedStatementItem): InvariantCandidate {
  return {
    invariantId: createInvariantId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "strong_invariant",
    statement: item.statement,
    confidence: item.confidence,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, item.confidence)],
    unknowns: item.unknowns,
    fragmentIds: [item.fragment.fragmentId],
    relatedTerms: [],
  };
}

export function normalizeRulesFromHeuristic(fragments: Fragment[]): RuleCandidate[] {
  return collectHeuristicStatementClassifications(fragments).rules.map(toRuleCandidate);
}

export function normalizeInvariantsFromHeuristic(fragments: Fragment[]): InvariantCandidate[] {
  return collectHeuristicStatementClassifications(fragments).invariants.map(toInvariantCandidate);
}
