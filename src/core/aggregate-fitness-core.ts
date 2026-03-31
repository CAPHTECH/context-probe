import { mapAggregateInvariants } from "./aggregate-fitness-mapping.js";
import { scoreAggregateFitness } from "./aggregate-fitness-scoring.js";
import type { DomainModel, Evidence, Fragment, GlossaryTerm, InvariantCandidate, TermTraceLink } from "./contracts.js";
import type { ProgressReporter } from "./progress.js";

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
  reportProgress?: ProgressReporter;
}): AggregateFitnessResult {
  const aggregateDefinitions = input.model.aggregates ?? [];
  const hasExplicitAggregates = aggregateDefinitions.length > 0;
  const unknowns: string[] = hasExplicitAggregates
    ? []
    : ["No aggregate definitions were found, so context is being used as an aggregate proxy."];
  input.reportProgress?.({
    phase: "docs",
    message: "AFS: mapping invariants to aggregates and contexts.",
  });
  const mappingResult = mapAggregateInvariants({
    aggregateDefinitions,
    fragments: input.fragments,
    terms: input.terms,
    links: input.links,
    invariants: input.invariants,
    model: input.model,
    unknowns,
    ...(input.reportProgress ? { reportProgress: input.reportProgress } : {}),
  });
  const diagnostics =
    mappingResult.skippedInvariants.length > 0
      ? [
          `Ignored ${mappingResult.skippedInvariants.length} acceptance-condition-like invariant(s) without aggregate anchors when computing AFS.`,
        ]
      : [];
  input.reportProgress?.({
    phase: "docs",
    message: "AFS: scoring consistency and cross-transaction coordination signals.",
  });
  return scoreAggregateFitness({
    model: input.model,
    invariants: mappingResult.consideredInvariants,
    aggregateDefinitions,
    mappedInvariants: mappingResult.mappings,
    unknowns,
    diagnostics,
  });
}
