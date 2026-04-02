import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { scoreAiChangeReviewTargets } from "../../src/core/ai-change-review-targets.js";
import { buildRenamedSignalContext, renamedSignalCaseArbitrary } from "./generators/ai-change-review.js";

const PROPERTY_SEED = 20260402;
const PROPERTY_RUNS = 75;

describe("ai change review target property tests", () => {
  test("renamed files inherit dependency and history signals from the previous path", () => {
    fc.assert(
      fc.property(renamedSignalCaseArbitrary, (signalCase) => {
        const currentSignals = scoreAiChangeReviewTargets(buildRenamedSignalContext(signalCase, "current"));
        const previousSignals = scoreAiChangeReviewTargets(buildRenamedSignalContext(signalCase, "previous"));

        expect(currentSignals.reviewTargets).toHaveLength(1);
        expect(previousSignals.reviewTargets).toHaveLength(1);
        expect(previousSignals.reviewTargets[0]?.priority).toBe(currentSignals.reviewTargets[0]?.priority);
        expect(previousSignals.reviewTargets[0]?.reasons).toEqual(currentSignals.reviewTargets[0]?.reasons);
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });
});
