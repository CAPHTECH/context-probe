import { buildFragmentContextMentions, collectStatementContexts, collectTermContexts } from "./boundary-fitness.js";
import type {
  AggregateDefinition,
  DomainModel,
  Evidence,
  Fragment,
  GlossaryTerm,
  InvariantCandidate,
  TermTraceLink,
} from "./contracts.js";
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
  /\bsame transaction\b/i,
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

function collectAggregateTargets(
  aggregateDefinitions: AggregateDefinition[],
  contexts: string[],
  invariant: InvariantCandidate,
): { targets: string[]; unknowns: string[] } {
  if (aggregateDefinitions.length === 0) {
    return { targets: [], unknowns: [] };
  }

  const unknowns: string[] = [];
  const matched = new Set<string>();
  const normalizedStatement = invariant.statement.toLowerCase();
  const relatedTerms = new Set((invariant.relatedTerms ?? []).map((term) => term.toLowerCase()));
  const eligibleAggregates =
    contexts.length === 0
      ? aggregateDefinitions
      : aggregateDefinitions.filter((aggregate) => contexts.includes(aggregate.context));

  for (const aggregate of eligibleAggregates) {
    const aliases = unique([aggregate.name, ...(aggregate.aliases ?? [])]);
    if (
      aliases.some((alias) => {
        const normalizedAlias = alias.toLowerCase();
        return normalizedStatement.includes(normalizedAlias) || relatedTerms.has(normalizedAlias);
      })
    ) {
      matched.add(`${aggregate.context}::${aggregate.name}`);
    }
  }

  if (matched.size > 0) {
    return { targets: Array.from(matched), unknowns };
  }

  if (contexts.length === 1) {
    const sameContextAggregates = aggregateDefinitions.filter((aggregate) => aggregate.context === contexts[0]);
    if (sameContextAggregates.length === 1) {
      return {
        targets: [`${sameContextAggregates[0]?.context}::${sameContextAggregates[0]?.name}`],
        unknowns,
      };
    }
    if (sameContextAggregates.length > 1) {
      unknowns.push(
        `Invariant "${invariant.invariantId}" could not be mapped to a specific aggregate within ${contexts[0]}.`,
      );
    }
  }

  return { targets: [], unknowns };
}

export function computeAggregateFitness(input: {
  model: DomainModel;
  fragments: Fragment[];
  terms: GlossaryTerm[];
  links: TermTraceLink[];
  invariants: InvariantCandidate[];
}): AggregateFitnessResult {
  const aggregateDefinitions = input.model.aggregates ?? [];
  const hasExplicitAggregates = aggregateDefinitions.length > 0;
  const unknowns: string[] = hasExplicitAggregates
    ? []
    : ["No aggregate definitions were found, so context is being used as an aggregate proxy."];
  const diagnostics: string[] = [];
  const fragmentContextMentions = buildFragmentContextMentions(input.fragments, input.model);
  const linkByTermId = new Map(input.links.map((link) => [link.termId, link]));
  const mappedTerms = input.terms
    .map((term) => ({
      canonicalTerm: term.canonicalTerm,
      contexts: collectTermContexts(term, linkByTermId.get(term.termId), fragmentContextMentions, input.model),
    }))
    .filter((entry) => entry.contexts.length > 0);

  const mappedInvariants = input.invariants.map((invariant) => {
    const contexts = collectStatementContexts(
      invariant.statement,
      invariant.fragmentIds,
      fragmentContextMentions,
      mappedTerms,
      input.model,
    );
    const aggregateTargets = collectAggregateTargets(aggregateDefinitions, contexts, invariant);
    const localityTargets = aggregateTargets.targets.length > 0 ? aggregateTargets.targets : contexts;
    unknowns.push(...aggregateTargets.unknowns);
    return {
      invariant,
      contexts,
      localityTargets,
      localization: localizationScore(localityTargets),
      usedContextProxy: aggregateTargets.targets.length === 0,
      aggregateTargets: aggregateTargets.targets,
    };
  });

  const localizedInvariants = mappedInvariants.filter((entry) => entry.localityTargets.length === 1);
  const crossContextInvariants = mappedInvariants.filter((entry) => entry.localityTargets.length > 1);
  const mappedInvariantCount = mappedInvariants.filter((entry) => entry.localityTargets.length > 0).length;
  const sicSignals = mappedInvariants.map((entry) => entry.localization * entry.invariant.confidence);
  const sicWeights = mappedInvariants.map((entry) => entry.invariant.confidence);
  const SIC =
    mappedInvariants.length === 0
      ? 0.45
      : clamp01(
          sicSignals.reduce((sum, value) => sum + value, 0) /
            Math.max(
              0.0001,
              sicWeights.reduce((sum, value) => sum + value, 0),
            ),
        );

  if (mappedInvariantCount === 0) {
    unknowns.push("Invariant responsibility assignment could not be observed, so SIC is provisional.");
  } else if (mappedInvariantCount < input.invariants.length) {
    unknowns.push("Some invariants could not be mapped to contexts, so SIC is approximate.");
  }
  if (hasExplicitAggregates && mappedInvariants.some((entry) => entry.usedContextProxy && entry.contexts.length > 0)) {
    unknowns.push("Some invariants could not be mapped to explicit aggregates, so context proxy was retained.");
  }

  const strongConsistencyInvariants = mappedInvariants.filter((entry) =>
    impliesStrongConsistencyWrite(entry.invariant.statement),
  );
  let XTC = 0.25;
  if (strongConsistencyInvariants.length === 0) {
    unknowns.push("There are too few strong-consistency invariants to support a strong XTC judgment.");
  } else {
    const xtcSignals = strongConsistencyInvariants.map((entry) => {
      if (entry.localityTargets.length > 1) {
        return 1 * entry.invariant.confidence;
      }
      if (entry.localityTargets.length === 0) {
        return 0.5 * entry.invariant.confidence;
      }
      return 0;
    });
    const xtcWeights = strongConsistencyInvariants.map((entry) => entry.invariant.confidence);
    XTC = clamp01(
      xtcSignals.reduce((sum, value) => sum + value, 0) /
        Math.max(
          0.0001,
          xtcWeights.reduce((sum, value) => sum + value, 0),
        ),
    );
  }

  const evidence: Evidence[] = [];
  for (const entry of localizedInvariants.slice(0, 4)) {
    const localityLabel = entry.aggregateTargets[0] ?? entry.contexts[0];
    evidence.push(
      toEvidence(
        `${entry.invariant.statement.slice(0, 120)} closes within ${localityLabel}`,
        {
          invariantId: entry.invariant.invariantId,
          contexts: entry.contexts,
          localityTargets: entry.localityTargets,
          fragmentIds: entry.invariant.fragmentIds,
        },
        [entry.invariant.invariantId],
        clamp01(entry.invariant.confidence),
      ),
    );
  }
  for (const entry of crossContextInvariants.slice(0, 4)) {
    const localityLabel = entry.localityTargets.join(", ");
    evidence.push(
      toEvidence(
        `${entry.invariant.statement.slice(0, 120)} spans ${localityLabel}`,
        {
          invariantId: entry.invariant.invariantId,
          contexts: entry.contexts,
          localityTargets: entry.localityTargets,
          fragmentIds: entry.invariant.fragmentIds,
        },
        [entry.invariant.invariantId],
        clamp01(Math.min(entry.invariant.confidence, 0.82)),
      ),
    );
  }

  const confidence = clamp01(
    average(
      [
        average(
          input.invariants.map((invariant) => invariant.confidence),
          0.5,
        ),
        mappedInvariantCount > 0 ? 0.78 : 0.45,
        strongConsistencyInvariants.length > 0 ? 0.76 : 0.55,
        hasExplicitAggregates ? 0.84 : input.model.contexts.length >= 2 ? 0.82 : 0.4,
        hasExplicitAggregates &&
        mappedInvariants.every((entry) => !entry.usedContextProxy || entry.contexts.length === 0)
          ? 0.8
          : 0.6,
      ],
      0.55,
    ),
  );

  if (hasExplicitAggregates) {
    diagnostics.push(
      `Used ${aggregateDefinitions.length} explicit aggregate definition(s) across ${unique(aggregateDefinitions.map((aggregate) => aggregate.context)).length} context(s).`,
    );
  }

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
      strongConsistencyInvariants: strongConsistencyInvariants.length,
    },
  };
}
