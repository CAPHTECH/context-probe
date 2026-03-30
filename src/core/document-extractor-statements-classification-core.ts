import type { Fragment } from "./contracts.js";
import {
  buildInvariantReviewState,
  hasAnySignal,
  hasPredicateShape,
  INVARIANT_PREDICATE_PATTERNS,
  INVARIANT_SIGNALS,
  isQuestionLikeStatement,
  isStructuredNoiseFragment,
  normalizeStatement,
  RULE_INVARIANT_AMBIGUITY,
  RULE_PREDICATE_PATTERNS,
  RULE_SIGNALS,
} from "./document-extractor-shared.js";
import { buildStatementSegments } from "./document-extractor-statements-segments.js";

export interface ClassifiedStatementItem {
  statement: string;
  fragment: Fragment;
  confidence: number;
  unknowns: string[];
  sourceKind: "sentence" | "bullet";
}

export interface ClassifiedStatement {
  kind: "rule" | "invariant";
  item: ClassifiedStatementItem;
}

export interface ClassifiedStatementCollections {
  rules: ClassifiedStatementItem[];
  invariants: ClassifiedStatementItem[];
}

function classifyStatement(
  statement: string,
  fragment: Fragment,
  sourceKind: "sentence" | "bullet",
): ClassifiedStatement | undefined {
  const normalized = normalizeStatement(statement);
  if (!normalized || isQuestionLikeStatement(normalized)) {
    return undefined;
  }

  const hasRuleSignal = hasAnySignal(normalized, RULE_SIGNALS);
  const hasInvariantSignal = hasAnySignal(normalized, INVARIANT_SIGNALS);
  const hasRulePredicate = hasPredicateShape(normalized, RULE_PREDICATE_PATTERNS);
  const hasInvariantPredicate = hasPredicateShape(normalized, INVARIANT_PREDICATE_PATTERNS);

  if ((!hasRuleSignal || !hasRulePredicate) && (!hasInvariantSignal || !hasInvariantPredicate)) {
    return undefined;
  }

  const bulletPenalty = sourceKind === "bullet" ? 0.06 : 0;

  if (hasInvariantSignal && hasInvariantPredicate && (!hasRuleSignal || !hasRulePredicate)) {
    const invariantReviewState = buildInvariantReviewState(normalized, sourceKind);
    return {
      kind: "invariant",
      item: {
        statement: normalized,
        fragment,
        confidence: invariantReviewState.confidence,
        unknowns: invariantReviewState.unknowns,
        sourceKind,
      },
    };
  }

  if (hasRuleSignal && hasRulePredicate && hasInvariantSignal && !hasInvariantPredicate) {
    return {
      kind: "rule",
      item: {
        statement: normalized,
        fragment,
        confidence: 0.62 - bulletPenalty,
        unknowns: [RULE_INVARIANT_AMBIGUITY],
        sourceKind,
      },
    };
  }

  if (hasRuleSignal && hasRulePredicate && (!hasInvariantSignal || !hasInvariantPredicate)) {
    return {
      kind: "rule",
      item: {
        statement: normalized,
        fragment,
        confidence: 0.78 - bulletPenalty,
        unknowns: [],
        sourceKind,
      },
    };
  }

  return {
    kind: hasInvariantPredicate ? "invariant" : "rule",
    item: {
      statement: normalized,
      fragment,
      confidence: 0.62 - bulletPenalty,
      unknowns: [RULE_INVARIANT_AMBIGUITY],
      sourceKind,
    },
  };
}

export function collectHeuristicStatementClassifications(fragments: Fragment[]): ClassifiedStatementCollections {
  const rules: ClassifiedStatementItem[] = [];
  const invariants: ClassifiedStatementItem[] = [];
  const seen = new Set<string>();

  for (const fragment of fragments) {
    if (fragment.kind !== "paragraph" || isStructuredNoiseFragment(fragment)) {
      continue;
    }
    for (const segment of buildStatementSegments(fragment)) {
      const classified = classifyStatement(segment.text, fragment, segment.sourceKind);
      if (!classified) {
        continue;
      }
      const dedupeKey = `${classified.kind}:${fragment.fragmentId}:${classified.item.statement}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      if (classified.kind === "rule") {
        rules.push(classified.item);
      } else {
        invariants.push(classified.item);
      }
    }
  }

  return { rules, invariants };
}
