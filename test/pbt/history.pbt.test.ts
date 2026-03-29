import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { compareEvolutionLocalityModels } from "../../src/core/history.js";
import { addIrrelevantFiles, HISTORY_PBT_MODEL, historyCommitArrayArbitrary } from "./generators/history.js";

const PROPERTY_SEED = 20260329;
const PROPERTY_RUNS = 100;

describe("history property tests", () => {
  test("keeps evolution locality comparison stable under commit reordering", () => {
    fc.assert(
      fc.property(historyCommitArrayArbitrary, (commits) => {
        const forward = compareEvolutionLocalityModels(commits, HISTORY_PBT_MODEL);
        const reversed = compareEvolutionLocalityModels([...commits].reverse(), HISTORY_PBT_MODEL);
        expect(reversed).toEqual(forward);
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });

  test("ignores irrelevant files outside modeled contexts", () => {
    fc.assert(
      fc.property(historyCommitArrayArbitrary, (commits) => {
        const base = compareEvolutionLocalityModels(commits, HISTORY_PBT_MODEL);
        const withIrrelevant = compareEvolutionLocalityModels(addIrrelevantFiles(commits), HISTORY_PBT_MODEL);
        expect(withIrrelevant).toEqual(base);
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED + 1 },
    );
  });

  test("keeps locality and coupling scores within normalized bounds", () => {
    fc.assert(
      fc.property(historyCommitArrayArbitrary, (commits) => {
        const result = compareEvolutionLocalityModels(commits, HISTORY_PBT_MODEL);
        expect(result.comparison.els.score).toBeGreaterThanOrEqual(0);
        expect(result.comparison.els.score).toBeLessThanOrEqual(1);
        expect(result.comparison.persistenceCandidate.localityScore).toBeGreaterThanOrEqual(0);
        expect(result.comparison.persistenceCandidate.localityScore).toBeLessThanOrEqual(1);
        expect(result.comparison.persistenceCandidate.persistentCouplingPenalty).toBeGreaterThanOrEqual(0);
        expect(result.comparison.persistenceCandidate.persistentCouplingPenalty).toBeLessThanOrEqual(1);
        if (result.comparison.persistenceCandidate.strongestPair) {
          expect(result.comparison.persistenceCandidate.strongestPair.jaccard).toBeGreaterThanOrEqual(0);
          expect(result.comparison.persistenceCandidate.strongestPair.jaccard).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED + 2 },
    );
  });
});
