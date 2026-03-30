import { collectStatementContexts } from "./boundary-fitness-contexts.js";
import type { DomainModel, Fragment, GlossaryTerm, InvariantCandidate, RuleCandidate } from "./contracts.js";

const USE_CASE_SIGNALS = [
  /ユースケース/u,
  /シナリオ/u,
  /期待(?:される)?結果/u,
  /受け入れ基準/u,
  /利用者/u,
  /\buse case\b/i,
  /\bscenario\b/i,
  /\bacceptance\b/i,
];

export interface BoundarySignal {
  kind: "term" | "rule" | "invariant" | "use_case";
  summary: string;
  contexts: string[];
  confidence: number;
  fragmentIds?: string[];
  linkedEntities?: string[];
}

export function localizationScore(contexts: string[]): number {
  if (contexts.length === 0) {
    return 0;
  }
  return 1 / contexts.length;
}

function hasUseCaseSignal(text: string): boolean {
  return USE_CASE_SIGNALS.some((pattern) => pattern.test(text));
}

export function buildAttractionSignals(input: {
  terms: GlossaryTerm[];
  termContexts: Map<string, string[]>;
  rules: RuleCandidate[];
  invariants: InvariantCandidate[];
  fragments: Fragment[];
  fragmentContextMentions: Map<string, string[]>;
  model: DomainModel;
}): BoundarySignal[] {
  const mappedTerms = input.terms
    .map((term) => ({
      term,
      contexts: input.termContexts.get(term.termId) ?? [],
    }))
    .filter((entry) => entry.contexts.length > 0);
  const termSummaries = mappedTerms.map((entry) => ({
    canonicalTerm: entry.term.canonicalTerm,
    contexts: entry.contexts,
  }));
  const signals: BoundarySignal[] = [];

  for (const entry of mappedTerms) {
    signals.push({
      kind: "term",
      summary: entry.term.canonicalTerm,
      contexts: entry.contexts,
      confidence: entry.term.confidence,
      fragmentIds: entry.term.fragmentIds,
      linkedEntities: [entry.term.termId],
    });
  }

  for (const rule of input.rules) {
    const contexts = collectStatementContexts(
      rule.statement,
      rule.fragmentIds,
      input.fragmentContextMentions,
      termSummaries,
      input.model,
    );
    if (contexts.length === 0) {
      continue;
    }
    signals.push({
      kind: "rule",
      summary: rule.statement,
      contexts,
      confidence: rule.confidence,
      fragmentIds: rule.fragmentIds,
      linkedEntities: [rule.ruleId],
    });
  }

  for (const invariant of input.invariants) {
    const contexts = collectStatementContexts(
      invariant.statement,
      invariant.fragmentIds,
      input.fragmentContextMentions,
      termSummaries,
      input.model,
    );
    if (contexts.length === 0) {
      continue;
    }
    signals.push({
      kind: "invariant",
      summary: invariant.statement,
      contexts,
      confidence: invariant.confidence,
      fragmentIds: invariant.fragmentIds,
      linkedEntities: [invariant.invariantId],
    });
  }

  for (const fragment of input.fragments) {
    if (!hasUseCaseSignal(fragment.text)) {
      continue;
    }
    const contexts = input.fragmentContextMentions.get(fragment.fragmentId) ?? [];
    if (contexts.length === 0) {
      continue;
    }
    signals.push({
      kind: "use_case",
      summary: fragment.text,
      contexts,
      confidence: 0.72,
      fragmentIds: [fragment.fragmentId],
    });
  }

  return signals;
}
