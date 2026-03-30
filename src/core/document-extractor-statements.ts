import type { Fragment, InvariantCandidate, RuleCandidate } from "./contracts.js";
import {
  buildInvariantReviewState,
  createEvidenceFromFragment,
  createInvariantId,
  createRuleId,
  findFragmentsByIds,
  type HeuristicStatementCandidate,
  hasAnySignal,
  hasPredicateShape,
  INVARIANT_PREDICATE_PATTERNS,
  INVARIANT_SIGNALS,
  isListItemLine,
  isQuestionLikeStatement,
  isStructuredNoiseFragment,
  normalizeStatement,
  RULE_INVARIANT_AMBIGUITY,
  RULE_PREDICATE_PATTERNS,
  RULE_SIGNALS,
  type StatementSegment,
  splitIntoSentences,
  stripListMarker,
} from "./document-extractor-shared.js";

function buildStatementSegments(fragment: Fragment): StatementSegment[] {
  const segments: StatementSegment[] = [];
  const proseBuffer: string[] = [];

  const flushProse = () => {
    if (proseBuffer.length === 0) {
      return;
    }
    splitIntoSentences(proseBuffer.join(" ")).forEach((sentence) => {
      segments.push({
        text: sentence,
        sourceKind: "sentence",
      });
    });
    proseBuffer.length = 0;
  };

  for (const rawLine of fragment.text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushProse();
      continue;
    }
    if (isListItemLine(line)) {
      flushProse();
      const bullet = normalizeStatement(stripListMarker(line));
      if (bullet) {
        segments.push({
          text: bullet,
          sourceKind: "bullet",
        });
      }
      continue;
    }
    proseBuffer.push(line);
  }

  flushProse();
  return segments;
}

function classifyStatement(
  statement: string,
  fragment: Fragment,
  sourceKind: "sentence" | "bullet",
): { kind: "rule" | "invariant"; item: HeuristicStatementCandidate } | undefined {
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

function classifyHeuristicStatements(fragments: Fragment[]): {
  rules: HeuristicStatementCandidate[];
  invariants: HeuristicStatementCandidate[];
} {
  const rules: HeuristicStatementCandidate[] = [];
  const invariants: HeuristicStatementCandidate[] = [];
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

export function normalizeRulesFromHeuristic(fragments: Fragment[]): RuleCandidate[] {
  return classifyHeuristicStatements(fragments).rules.map((item) => ({
    ruleId: createRuleId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "business_rule",
    statement: item.statement,
    confidence: item.confidence,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, item.confidence)],
    unknowns: item.unknowns,
    fragmentIds: [item.fragment.fragmentId],
    relatedTerms: [],
  }));
}

export function normalizeInvariantsFromHeuristic(fragments: Fragment[]): InvariantCandidate[] {
  return classifyHeuristicStatements(fragments).invariants.map((item) => ({
    invariantId: createInvariantId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "strong_invariant",
    statement: item.statement,
    confidence: item.confidence,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, item.confidence)],
    unknowns: item.unknowns,
    fragmentIds: [item.fragment.fragmentId],
    relatedTerms: [],
  }));
}

export function normalizeRulesFromCli(rawItems: Record<string, unknown>[], fragments: Fragment[]): RuleCandidate[] {
  return rawItems
    .filter((item) => typeof item.statement === "string")
    .map((item) => {
      const statement = item.statement as string;
      const fragmentIds = Array.isArray(item.fragmentIds)
        ? item.fragmentIds.filter((value): value is string => typeof value === "string")
        : [];
      const supportingFragments = findFragmentsByIds(fragments, fragmentIds);
      const confidence = typeof item.confidence === "number" ? item.confidence : 0.7;
      return {
        ruleId: createRuleId(`${statement}:${fragmentIds.join(",")}`),
        type: typeof item.type === "string" ? item.type : "business_rule",
        statement,
        confidence,
        evidence: supportingFragments.map((fragment) => createEvidenceFromFragment(fragment, statement, confidence)),
        unknowns: Array.isArray(item.unknowns)
          ? item.unknowns.filter((value): value is string => typeof value === "string")
          : [],
        fragmentIds,
        relatedTerms: Array.isArray(item.relatedTerms)
          ? item.relatedTerms.filter((value): value is string => typeof value === "string")
          : [],
      };
    });
}

export function normalizeInvariantsFromCli(
  rawItems: Record<string, unknown>[],
  fragments: Fragment[],
): InvariantCandidate[] {
  return rawItems
    .filter((item) => typeof item.statement === "string")
    .map((item) => {
      const statement = item.statement as string;
      const fragmentIds = Array.isArray(item.fragmentIds)
        ? item.fragmentIds.filter((value): value is string => typeof value === "string")
        : [];
      const supportingFragments = findFragmentsByIds(fragments, fragmentIds);
      const confidence = typeof item.confidence === "number" ? item.confidence : 0.68;
      return {
        invariantId: createInvariantId(`${statement}:${fragmentIds.join(",")}`),
        type: typeof item.type === "string" ? item.type : "strong_invariant",
        statement,
        confidence,
        evidence: supportingFragments.map((fragment) => createEvidenceFromFragment(fragment, statement, confidence)),
        unknowns: Array.isArray(item.unknowns)
          ? item.unknowns.filter((value): value is string => typeof value === "string")
          : [],
        fragmentIds,
        relatedTerms: Array.isArray(item.relatedTerms)
          ? item.relatedTerms.filter((value): value is string => typeof value === "string")
          : [],
      };
    });
}
