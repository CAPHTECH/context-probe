import fc from "fast-check";

import type { DomainDesignShadowRolloutGateObservation } from "../../../src/core/contracts.js";

const categoryArbitrary = fc.constantFrom("application", "tooling", "shared");
const modelSourceArbitrary = fc.constantFrom("repo_owned" as const, "versioned_manifest" as const);
const deltaArbitrary = fc.integer({ min: -250, max: 250 }).map((value) => value / 1000);

const repoIdArbitrary = fc
  .tuple(categoryArbitrary, fc.integer({ min: 0, max: 1000 }))
  .map(([category, id]) => `${category}-${id}`);

const gateObservationArbitrary: fc.Arbitrary<DomainDesignShadowRolloutGateObservation> = fc
  .record({
    repoId: repoIdArbitrary,
    category: categoryArbitrary,
    modelSource: modelSourceArbitrary,
    relevantCommitCount: fc.integer({ min: 0, max: 100 }),
    delta: deltaArbitrary,
    hasModelPath: fc.boolean(),
  })
  .map(({ hasModelPath, ...observation }) => ({
    ...observation,
    ...(hasModelPath ? { modelPath: `/tmp/${observation.repoId}.yaml` } : {}),
  }));

export const gateObservationArrayArbitrary = fc.uniqueArray(gateObservationArbitrary, {
  maxLength: 12,
  selector: (observation) => observation.repoId,
});

export const zeroWeightGateObservationArrayArbitrary = fc.uniqueArray(
  fc
    .record({
      repoId: repoIdArbitrary,
      category: categoryArbitrary,
      modelSource: modelSourceArbitrary,
      delta: deltaArbitrary,
      hasModelPath: fc.boolean(),
    })
    .map(({ hasModelPath, ...observation }) => ({
      ...observation,
      relevantCommitCount: 0,
      ...(hasModelPath ? { modelPath: `/tmp/${observation.repoId}.yaml` } : {}),
    })),
  {
    minLength: 1,
    maxLength: 12,
    selector: (observation) => observation.repoId,
  },
);
