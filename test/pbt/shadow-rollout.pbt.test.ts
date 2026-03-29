import fc from "fast-check";
import { describe, expect, test } from "vitest";

import type {
  DomainDesignShadowRolloutGateAggregate,
  DomainDesignShadowRolloutGateObservation,
} from "../../src/core/contracts.js";
import { evaluateShadowRolloutGate } from "../../src/core/shadow-rollout.js";
import { gateObservationArrayArbitrary, zeroWeightGateObservationArrayArbitrary } from "./generators/shadow-rollout.js";

const PROPERTY_SEED = 20260329;
const PROPERTY_RUNS = 100;

function summarizeGateObservationsReference(
  observations: DomainDesignShadowRolloutGateObservation[],
): DomainDesignShadowRolloutGateAggregate {
  if (observations.length === 0) {
    return {
      repoCount: 0,
      averageDelta: 0,
      weightedAverageDelta: 0,
      medianDelta: 0,
      minDelta: 0,
      maxDelta: 0,
      deltaRange: 0,
      positiveDeltaCount: 0,
      negativeDeltaCount: 0,
    };
  }

  const deltas = observations.map((entry) => entry.delta).sort((left, right) => left - right);
  const repoCount = observations.length;
  const averageDelta = observations.reduce((sum, entry) => sum + entry.delta, 0) / repoCount;
  const totalRelevantCommits = observations.reduce((sum, entry) => sum + entry.relevantCommitCount, 0);
  const weightedAverageDelta =
    totalRelevantCommits === 0
      ? averageDelta
      : observations.reduce((sum, entry) => sum + entry.delta * entry.relevantCommitCount, 0) / totalRelevantCommits;
  const middleIndex = Math.floor(deltas.length / 2);
  const medianDelta =
    deltas.length % 2 === 0
      ? ((deltas[middleIndex - 1] ?? 0) + (deltas[middleIndex] ?? 0)) / 2
      : (deltas[middleIndex] ?? 0);
  const minDelta = deltas[0] ?? 0;
  const maxDelta = deltas.at(-1) ?? 0;

  return {
    repoCount,
    averageDelta,
    weightedAverageDelta,
    medianDelta,
    minDelta,
    maxDelta,
    deltaRange: maxDelta - minDelta,
    positiveDeltaCount: observations.filter((entry) => entry.delta > 0).length,
    negativeDeltaCount: observations.filter((entry) => entry.delta < 0).length,
  };
}

describe("shadow rollout property tests", () => {
  test("matches the reference aggregate for arbitrary observations", () => {
    fc.assert(
      fc.property(gateObservationArrayArbitrary, (observations) => {
        const evaluation = evaluateShadowRolloutGate(observations);
        const reference = summarizeGateObservationsReference(observations);

        expect(evaluation.repoCount).toBe(observations.length);
        expect(evaluation.repoOwnedCount + evaluation.versionedManifestCount).toBe(observations.length);
        expect(evaluation.overall).toEqual(reference);

        const categoryRepoIds = new Set(evaluation.categories.flatMap((category) => category.repoIds));
        expect(categoryRepoIds).toEqual(new Set(observations.map((observation) => observation.repoId)));

        for (const category of evaluation.categories) {
          const categoryObservations = observations.filter((observation) => observation.category === category.category);
          expect(new Set(category.repoIds)).toEqual(
            new Set(categoryObservations.map((observation) => observation.repoId)),
          );
          expect(category.summary).toEqual(summarizeGateObservationsReference(categoryObservations));
        }
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });

  test("uses arithmetic mean as the zero-weight weighted average fallback", () => {
    fc.assert(
      fc.property(zeroWeightGateObservationArrayArbitrary, (observations) => {
        const evaluation = evaluateShadowRolloutGate(observations);
        expect(evaluation.overall.weightedAverageDelta).toBe(evaluation.overall.averageDelta);
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED + 1 },
    );
  });
});
