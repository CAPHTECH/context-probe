import { mapAggregateInvariants } from "./aggregate-fitness-mapping.js";
import { scoreAggregateFitness } from "./aggregate-fitness-scoring.js";
import type { DomainModel, Evidence, Fragment, GlossaryTerm, InvariantCandidate, TermTraceLink } from "./contracts.js";

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
  const mappedInvariants = mapAggregateInvariants({
    aggregateDefinitions,
    fragments: input.fragments,
    terms: input.terms,
    links: input.links,
    invariants: input.invariants,
    model: input.model,
    unknowns,
  });
  return scoreAggregateFitness({
    model: input.model,
    invariants: input.invariants,
    aggregateDefinitions,
    mappedInvariants,
    unknowns,
  });
}
