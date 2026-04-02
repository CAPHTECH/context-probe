import fc from "fast-check";

import type { AiChangeReviewContext } from "../../../src/core/ai-change-review-context.js";
import type { AiChangeReviewChangedFile } from "../../../src/core/ai-change-review-diff-types.js";

export interface RenamedSignalCase {
  reverseDependencyCount: number;
  historyHotspotCount: number;
  representativeLine: number;
}

export const renamedSignalCaseArbitrary: fc.Arbitrary<RenamedSignalCase> = fc.record({
  reverseDependencyCount: fc.integer({ min: 3, max: 8 }),
  historyHotspotCount: fc.integer({ min: 2, max: 6 }),
  representativeLine: fc.integer({ min: 1, max: 200 }),
});

type SignalLocation = "current" | "previous";

function buildRenamedFile(representativeLine: number): AiChangeReviewChangedFile {
  return {
    path: "src/shared/util-renamed.ts",
    previousPath: "src/shared/util.ts",
    changeType: "renamed",
    changedLines: 2,
    representativeLine,
    hunks: [
      {
        oldStart: representativeLine,
        oldCount: 1,
        newStart: representativeLine,
        newCount: 1,
        representativeLine,
      },
    ],
  };
}

export function buildRenamedSignalContext(
  input: RenamedSignalCase,
  signalLocation: SignalLocation,
): AiChangeReviewContext {
  const file = buildRenamedFile(input.representativeLine);
  const signalPath = signalLocation === "current" ? file.path : (file.previousPath ?? file.path);
  const sourcePaths = new Set(
    Array.from({ length: input.reverseDependencyCount }, (_, index) => `src/app/consumer-${index + 1}.ts`),
  );

  return {
    repoPath: ".",
    baseBranch: "main",
    headBranch: "feature/rename-hotspot",
    mergeBase: "deadbeef",
    files: [file],
    reverseDependencySources: new Map([[signalPath, sourcePaths]]),
    reverseDependencyCounts: new Map([[signalPath, input.reverseDependencyCount]]),
    repoFiles: new Set(["src/shared/util-renamed.ts", "src/shared/util-renamed.test.ts"]),
    changedFiles: new Set([file.path]),
    historyState: {
      counts: new Map([[signalPath, input.historyHotspotCount]]),
      watchlist: new Set([signalPath]),
    },
    historyMs: 0,
  };
}
