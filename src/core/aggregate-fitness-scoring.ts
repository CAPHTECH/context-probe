import { buildAggregateFitnessEvidence } from "./aggregate-fitness-evidence.js";
import {
  type AggregateInvariantMapping,
  average,
  clamp01,
  impliesStrongConsistencyWrite,
  unique,
} from "./aggregate-fitness-shared.js";
import type { AggregateDefinition, DomainModel, Evidence, InvariantCandidate } from "./contracts.js";

export interface AggregateFitnessScoringResult {
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

export function scoreAggregateFitness(input: {
  model: DomainModel;
  invariants: InvariantCandidate[];
  aggregateDefinitions: AggregateDefinition[];
  mappedInvariants: AggregateInvariantMapping[];
  unknowns: string[];
}): AggregateFitnessScoringResult {
  const hasExplicitAggregates = input.aggregateDefinitions.length > 0;
  const diagnostics: string[] = [];
  const localizedInvariants = input.mappedInvariants.filter((entry) => entry.localityTargets.length === 1);
  const crossContextInvariants = input.mappedInvariants.filter((entry) => entry.localityTargets.length > 1);
  const mappedInvariantCount = input.mappedInvariants.filter((entry) => entry.localityTargets.length > 0).length;
  const sicSignals = input.mappedInvariants.map((entry) => entry.localization * entry.invariant.confidence);
  const sicWeights = input.mappedInvariants.map((entry) => entry.invariant.confidence);
  const SIC =
    input.mappedInvariants.length === 0
      ? 0.45
      : clamp01(
          sicSignals.reduce((sum, value) => sum + value, 0) /
            Math.max(
              0.0001,
              sicWeights.reduce((sum, value) => sum + value, 0),
            ),
        );

  if (mappedInvariantCount === 0) {
    input.unknowns.push("Invariant responsibility assignment could not be observed, so SIC is provisional.");
  } else if (mappedInvariantCount < input.invariants.length) {
    input.unknowns.push("Some invariants could not be mapped to contexts, so SIC is approximate.");
  }
  if (
    hasExplicitAggregates &&
    input.mappedInvariants.some((entry) => entry.usedContextProxy && entry.contexts.length > 0)
  ) {
    input.unknowns.push("Some invariants could not be mapped to explicit aggregates, so context proxy was retained.");
  }

  const strongConsistencyInvariants = input.mappedInvariants.filter((entry) =>
    impliesStrongConsistencyWrite(entry.invariant.statement),
  );
  let XTC = 0.25;
  if (strongConsistencyInvariants.length === 0) {
    input.unknowns.push("There are too few strong-consistency invariants to support a strong XTC judgment.");
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
        input.mappedInvariants.every((entry) => !entry.usedContextProxy || entry.contexts.length === 0)
          ? 0.8
          : 0.6,
      ],
      0.55,
    ),
  );

  if (hasExplicitAggregates) {
    diagnostics.push(
      `Used ${input.aggregateDefinitions.length} explicit aggregate definition(s) across ${unique(input.aggregateDefinitions.map((aggregate) => aggregate.context)).length} context(s).`,
    );
  }

  return {
    SIC,
    XTC,
    confidence,
    evidence: buildAggregateFitnessEvidence(input.mappedInvariants),
    unknowns: unique(input.unknowns),
    diagnostics,
    details: {
      mappedInvariants: mappedInvariantCount,
      localizedInvariants: localizedInvariants.length,
      crossContextInvariants: crossContextInvariants.length,
      strongConsistencyInvariants: strongConsistencyInvariants.length,
    },
  };
}
