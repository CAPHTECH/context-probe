import type { Fragment, InvariantCandidate, RuleCandidate } from "./contracts.js";
import {
  createEvidenceFromFragment,
  createInvariantId,
  createRuleId,
  findFragmentsByIds,
} from "./document-extractor-shared.js";

interface RawStatementItem {
  statement: string;
  fragmentIds: string[];
  confidence: number;
  type: string;
  evidence: ReturnType<typeof createEvidenceFromFragment>[];
  unknowns: string[];
  relatedTerms: string[];
}

function collectRawStatementItems(
  rawItems: Record<string, unknown>[],
  fragments: Fragment[],
  defaultConfidence: number,
  defaultType: string,
): RawStatementItem[] {
  return rawItems
    .filter((item) => typeof item.statement === "string")
    .map((item) => {
      const statement = item.statement as string;
      const fragmentIds = Array.isArray(item.fragmentIds)
        ? item.fragmentIds.filter((value): value is string => typeof value === "string")
        : [];
      const supportingFragments = findFragmentsByIds(fragments, fragmentIds);
      const confidence = typeof item.confidence === "number" ? item.confidence : defaultConfidence;
      return {
        statement,
        fragmentIds,
        confidence,
        type: typeof item.type === "string" ? item.type : defaultType,
        evidence: supportingFragments.map((fragment) => createEvidenceFromFragment(fragment, statement, confidence)),
        unknowns: Array.isArray(item.unknowns)
          ? item.unknowns.filter((value): value is string => typeof value === "string")
          : [],
        relatedTerms: Array.isArray(item.relatedTerms)
          ? item.relatedTerms.filter((value): value is string => typeof value === "string")
          : [],
      };
    });
}

export function normalizeRulesFromCli(rawItems: Record<string, unknown>[], fragments: Fragment[]): RuleCandidate[] {
  return collectRawStatementItems(rawItems, fragments, 0.7, "business_rule").map((item) => ({
    ruleId: createRuleId(`${item.statement}:${item.fragmentIds.join(",")}`),
    type: item.type,
    statement: item.statement,
    confidence: item.confidence,
    evidence: item.evidence,
    unknowns: item.unknowns,
    fragmentIds: item.fragmentIds,
    relatedTerms: item.relatedTerms,
  }));
}

export function normalizeInvariantsFromCli(
  rawItems: Record<string, unknown>[],
  fragments: Fragment[],
): InvariantCandidate[] {
  return collectRawStatementItems(rawItems, fragments, 0.68, "strong_invariant").map((item) => ({
    invariantId: createInvariantId(`${item.statement}:${item.fragmentIds.join(",")}`),
    type: item.type,
    statement: item.statement,
    confidence: item.confidence,
    evidence: item.evidence,
    unknowns: item.unknowns,
    fragmentIds: item.fragmentIds,
    relatedTerms: item.relatedTerms,
  }));
}
