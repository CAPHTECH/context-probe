import type {
  DomainModel,
  Evidence,
  Fragment,
  GlossaryTerm,
  InvariantCandidate,
  TermTraceLink
} from "./contracts.js";
import {
  buildFragmentContextMentions,
  collectStatementContexts,
  collectTermContexts
} from "./boundary-fitness.js";
import { toEvidence } from "./response.js";

const STRONG_CONSISTENCY_SIGNALS = [
  /一致/u,
  /整合/u,
  /同時/u,
  /両方/u,
  /またが/u,
  /跨/u,
  /同じ.*(?:更新|確定)/u,
  /\bconsistent\b/i,
  /\bsame transaction\b/i
];
const OBLIGATION_SIGNALS = [/なければならない/u, /べき/u, /\bmust\b/i];

export interface AggregateFitnessResult {
  SIC: number;
  XTC: number;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  diagnostics: string[];
  details: {
    mappedInvariants: number;
    localizedInvariants: number;
    crossContextInvariants: number;
    strongConsistencyInvariants: number;
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function localizationScore(contexts: string[]): number {
  if (contexts.length === 0) {
    return 0.35;
  }
  return 1 / contexts.length;
}

function isStrongConsistencyInvariant(statement: string): boolean {
  return STRONG_CONSISTENCY_SIGNALS.some((pattern) => pattern.test(statement));
}

function impliesStrongConsistencyWrite(statement: string): boolean {
  return isStrongConsistencyInvariant(statement) || OBLIGATION_SIGNALS.some((pattern) => pattern.test(statement));
}

export function computeAggregateFitness(input: {
  model: DomainModel;
  fragments: Fragment[];
  terms: GlossaryTerm[];
  links: TermTraceLink[];
  invariants: InvariantCandidate[];
}): AggregateFitnessResult {
  const unknowns: string[] = ["Aggregate 定義がないため context を aggregate proxy として扱っています"];
  const diagnostics: string[] = [];
  const fragmentContextMentions = buildFragmentContextMentions(input.fragments, input.model);
  const linkByTermId = new Map(input.links.map((link) => [link.termId, link]));
  const mappedTerms = input.terms
    .map((term) => ({
      canonicalTerm: term.canonicalTerm,
      contexts: collectTermContexts(term, linkByTermId.get(term.termId), fragmentContextMentions, input.model)
    }))
    .filter((entry) => entry.contexts.length > 0);

  const mappedInvariants = input.invariants.map((invariant) => {
    const contexts = collectStatementContexts(
      invariant.statement,
      invariant.fragmentIds,
      fragmentContextMentions,
      mappedTerms,
      input.model
    );
    return {
      invariant,
      contexts,
      localization: localizationScore(contexts)
    };
  });

  const localizedInvariants = mappedInvariants.filter((entry) => entry.contexts.length === 1);
  const crossContextInvariants = mappedInvariants.filter((entry) => entry.contexts.length > 1);
  const mappedInvariantCount = mappedInvariants.filter((entry) => entry.contexts.length > 0).length;
  const sicSignals = mappedInvariants.map((entry) => entry.localization * entry.invariant.confidence);
  const sicWeights = mappedInvariants.map((entry) => entry.invariant.confidence);
  const SIC =
    mappedInvariants.length === 0
      ? 0.45
      : clamp01(sicSignals.reduce((sum, value) => sum + value, 0) / Math.max(0.0001, sicWeights.reduce((sum, value) => sum + value, 0)));

  if (mappedInvariantCount === 0) {
    unknowns.push("invariant の責務割当が観測できず SIC は暫定値です");
  } else if (mappedInvariantCount < input.invariants.length) {
    unknowns.push("一部の invariant は context へ割り当てられず SIC は近似です");
  }

  const strongConsistencyInvariants = mappedInvariants.filter((entry) =>
    impliesStrongConsistencyWrite(entry.invariant.statement)
  );
  let XTC = 0.25;
  if (strongConsistencyInvariants.length === 0) {
    unknowns.push("強整合 invariant が少なく XTC の判定根拠が限定的です");
  } else {
    const xtcSignals = strongConsistencyInvariants.map((entry) => {
      if (entry.contexts.length > 1) {
        return 1 * entry.invariant.confidence;
      }
      if (entry.contexts.length === 0) {
        return 0.5 * entry.invariant.confidence;
      }
      return 0;
    });
    const xtcWeights = strongConsistencyInvariants.map((entry) => entry.invariant.confidence);
    XTC = clamp01(
      xtcSignals.reduce((sum, value) => sum + value, 0) /
        Math.max(0.0001, xtcWeights.reduce((sum, value) => sum + value, 0))
    );
  }

  const evidence: Evidence[] = [];
  for (const entry of localizedInvariants.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${entry.invariant.statement.slice(0, 120)} closes within ${entry.contexts[0]}`,
        {
          invariantId: entry.invariant.invariantId,
          contexts: entry.contexts,
          fragmentIds: entry.invariant.fragmentIds
        },
        [entry.invariant.invariantId],
        clamp01(entry.invariant.confidence)
      )
    );
  }
  for (const entry of crossContextInvariants.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${entry.invariant.statement.slice(0, 120)} spans ${entry.contexts.join(", ")}`,
        {
          invariantId: entry.invariant.invariantId,
          contexts: entry.contexts,
          fragmentIds: entry.invariant.fragmentIds
        },
        [entry.invariant.invariantId],
        clamp01(Math.min(entry.invariant.confidence, 0.82))
      )
    );
  }

  const confidence = clamp01(
    average(
      [
        average(input.invariants.map((invariant) => invariant.confidence), 0.5),
        mappedInvariantCount > 0 ? 0.78 : 0.45,
        strongConsistencyInvariants.length > 0 ? 0.76 : 0.55,
        input.model.contexts.length >= 2 ? 0.82 : 0.4
      ],
      0.55
    )
  );

  return {
    SIC,
    XTC,
    confidence,
    evidence,
    unknowns: unique(unknowns),
    diagnostics,
    details: {
      mappedInvariants: mappedInvariantCount,
      localizedInvariants: localizedInvariants.length,
      crossContextInvariants: crossContextInvariants.length,
      strongConsistencyInvariants: strongConsistencyInvariants.length
    }
  };
}
