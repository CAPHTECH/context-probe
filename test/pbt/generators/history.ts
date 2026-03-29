import fc from "fast-check";

import type { CochangeCommit, DomainModel } from "../../../src/core/contracts.js";

const CONTEXT_NAMES = ["billing", "fulfillment", "support"] as const;

export const HISTORY_PBT_MODEL: DomainModel = {
  version: "1.0",
  contexts: [
    { name: "billing", pathGlobs: ["src/billing/**"] },
    { name: "fulfillment", pathGlobs: ["src/fulfillment/**"] },
    { name: "support", pathGlobs: ["src/support/**"] },
  ],
};

const contextFileArbitrary = fc
  .tuple(fc.constantFrom(...CONTEXT_NAMES), fc.integer({ min: 0, max: 30 }))
  .map(([contextName, id]) => `src/${contextName}/file-${id}.ts`);

const irrelevantFileArbitrary = fc.oneof(
  fc.integer({ min: 0, max: 30 }).map((id) => `docs/doc-${id}.md`),
  fc.integer({ min: 0, max: 30 }).map((id) => `scripts/task-${id}.sh`),
  fc.constant("README.md"),
);

const historyFileArbitrary = fc.oneof(contextFileArbitrary, irrelevantFileArbitrary);

export const historyCommitArrayArbitrary: fc.Arbitrary<CochangeCommit[]> = fc
  .array(fc.uniqueArray(historyFileArbitrary, { minLength: 1, maxLength: 4 }), { maxLength: 12 })
  .map((fileSets) =>
    fileSets.map(
      (files, index): CochangeCommit => ({
        hash: `h${index.toString(16)}`,
        subject: `commit-${index}`,
        files,
      }),
    ),
  );

export function addIrrelevantFiles(commits: CochangeCommit[]): CochangeCommit[] {
  return commits.map((commit, index) => ({
    ...commit,
    files: [...commit.files, `docs/irrelevant-${index}.md`, `scripts/irrelevant-${index}.sh`],
  }));
}
