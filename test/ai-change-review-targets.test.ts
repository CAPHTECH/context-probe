import { describe, expect, test } from "vitest";

import type { AiChangeReviewContext } from "../src/core/ai-change-review-context.js";
import type { AiChangeReviewChangedFile } from "../src/core/ai-change-review-diff-types.js";
import { scoreAiChangeReviewTargets } from "../src/core/ai-change-review-targets.js";

function buildChangedFile(overrides: Partial<AiChangeReviewChangedFile>): AiChangeReviewChangedFile {
  return {
    path: "src/example.ts",
    changeType: "modified",
    hunks: [
      {
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 1,
        representativeLine: 1,
      },
    ],
    changedLines: 10,
    representativeLine: 1,
    ...overrides,
  };
}

function buildContext(
  file: AiChangeReviewChangedFile,
  overrides?: Partial<AiChangeReviewContext>,
): AiChangeReviewContext {
  return {
    repoPath: ".",
    baseBranch: "main",
    headBranch: "feature/noise-reduction",
    mergeBase: "deadbeef",
    files: [file],
    reverseDependencySources: new Map([
      [file.path, new Set(["src/consumer-a.ts", "src/consumer-b.ts", "src/consumer-c.ts"])],
    ]),
    reverseDependencyCounts: new Map([[file.path, 3]]),
    repoFiles: new Set([file.path]),
    changedFiles: new Set([file.path]),
    historyState: {
      counts: new Map([[file.path, 5]]),
      watchlist: new Set([file.path]),
    },
    historyMs: 0,
    ...overrides,
  };
}

describe("ai change review target noise reduction", () => {
  test("documentation changes do not get hotspot or blast-radius reasons by default", () => {
    const file = buildChangedFile({
      path: "docs/guides/user-guide.md",
      changedLines: 40,
      hunks: [
        { oldStart: 10, oldCount: 10, newStart: 10, newCount: 10, representativeLine: 10 },
        { oldStart: 30, oldCount: 10, newStart: 30, newCount: 10, representativeLine: 30 },
        { oldStart: 50, oldCount: 10, newStart: 50, newCount: 10, representativeLine: 50 },
      ],
      representativeLine: 10,
    });

    const result = scoreAiChangeReviewTargets(buildContext(file));

    expect(result.reviewTargets).toEqual([]);
  });

  test("test files are downgraded to low-priority large-change review items", () => {
    const file = buildChangedFile({
      path: "test/ai-change-review.helpers.ts",
      changedLines: 120,
      hunks: [
        { oldStart: 1, oldCount: 20, newStart: 1, newCount: 20, representativeLine: 1 },
        { oldStart: 40, oldCount: 20, newStart: 40, newCount: 20, representativeLine: 40 },
        { oldStart: 80, oldCount: 20, newStart: 80, newCount: 20, representativeLine: 80 },
        { oldStart: 120, oldCount: 20, newStart: 120, newCount: 20, representativeLine: 120 },
        { oldStart: 160, oldCount: 20, newStart: 160, newCount: 20, representativeLine: 160 },
      ],
      representativeLine: 1,
    });

    const result = scoreAiChangeReviewTargets(buildContext(file));

    expect(result.reviewTargets).toHaveLength(1);
    expect(result.reviewTargets[0]?.priority).toBe("low");
    expect(result.reviewTargets[0]?.reasons).toEqual(["large_change"]);
  });

  test("implementation files still keep hotspot and blast-radius signals", () => {
    const file = buildChangedFile({
      path: "src/core/contracts.ts",
      changedLines: 35,
      hunks: [
        { oldStart: 1, oldCount: 5, newStart: 1, newCount: 5, representativeLine: 1 },
        { oldStart: 20, oldCount: 5, newStart: 20, newCount: 5, representativeLine: 20 },
        { oldStart: 40, oldCount: 5, newStart: 40, newCount: 5, representativeLine: 40 },
      ],
      representativeLine: 1,
    });

    const result = scoreAiChangeReviewTargets(
      buildContext(file, {
        repoFiles: new Set([file.path]),
        changedFiles: new Set([file.path]),
      }),
    );

    expect(result.reviewTargets).toHaveLength(1);
    expect(result.reviewTargets[0]?.priority).toBe("high");
    expect(result.reviewTargets[0]?.reasons).toEqual(
      expect.arrayContaining(["wide_blast_radius", "history_hotspot", "large_change", "test_gap"]),
    );
  });
});
