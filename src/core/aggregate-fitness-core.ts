import { buildAggregateFitnessEvidence } from "./aggregate-fitness-evidence.js";
import {
  type AggregateInvariantMapping,
  average,
  clamp01,
  collectAggregateTargets,
  impliesStrongConsistencyWrite,
  localizationScore,
  unique,
} from "./aggregate-fitness-shared.js";
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

function mapAggregateInvariants(input: {
  aggregateDefinitions: AggregateDefinition[];
  fragments: Fragment[];
  terms: GlossaryTerm[];
  links: TermTraceLink[];
  invariants: InvariantCandidate[];
  model: DomainModel;
  unknowns: string[];
}): AggregateInvariantMapping[] {
  const fragmentContextMentions = buildFragmentContextMentions(input.fragments, input.model);
  const linkByTermId = new Map(input.links.map((link) => [link.termId, link]));
  const mappedTerms = input.terms
    .map((term) => ({
      canonicalTerm: term.canonicalTerm,
      contexts: collectTermContexts(term, linkByTermId.get(term.termId), fragmentContextMentions, input.model),
    }))
    .filter((entry) => entry.contexts.length > 0);

  return input.invariants.map((invariant) => {
    const contexts = collectStatementContexts(
      invariant.statement,
      invariant.fragmentIds,
      fragmentContextMentions,
      mappedTerms,
      input.model,
    );
    const aggregateTargets = collectAggregateTargets(input.aggregateDefinitions, contexts, invariant);
    const localityTargets = aggregateTargets.targets.length > 0 ? aggregateTargets.targets : contexts;
    input.unknowns.push(...aggregateTargets.unknowns);
    return {
      invariant,
      contexts,
      localityTargets,
      localization: localizationScore(localityTargets),
      usedContextProxy: aggregateTargets.targets.length === 0,
      aggregateTargets: aggregateTargets.targets,
    };
  });
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
  const mappedInvariants = mapAggregateInvariants({
    aggregateDefinitions,
    fragments: input.fragments,
    terms: input.terms,
    links: input.links,
    invariants: input.invariants,
    model: input.model,
    unknowns,
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

  const evidence = buildAggregateFitnessEvidence(mappedInvariants);

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
