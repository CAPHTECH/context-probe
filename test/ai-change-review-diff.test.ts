import { describe, expect, test } from "vitest";

import { collectBranchDiff } from "../src/core/ai-change-review-diff.js";
import {
  applyAiChangeReviewDiffLine,
  createAiChangeReviewDiffCursor,
  parseAiChangeReviewDiffHunks,
  parseAiChangeReviewHunkHeader,
  parseAiChangeReviewNameStatusLine,
} from "../src/core/ai-change-review-diff-parser.js";
import type { AiChangeReviewChangedFile } from "../src/core/ai-change-review-diff-types.js";
import { createAiChangeReviewFixture } from "./ai-change-review.helpers.js";
import { cleanupTemporaryRepo } from "./helpers.js";

const SLOW_AI_CHANGE_REVIEW_DIFF_TEST_TIMEOUT_MS = 15_000;

describe("ai change review diff helpers", () => {
  test("parses status lines for added, deleted, and renamed files", () => {
    expect(parseAiChangeReviewNameStatusLine("A\ta/src/new.ts")).toMatchObject({
      path: "src/new.ts",
      changeType: "added",
    });
    expect(parseAiChangeReviewNameStatusLine("D\tb/src/old.ts")).toMatchObject({
      path: "src/old.ts",
      changeType: "deleted",
    });
    expect(parseAiChangeReviewNameStatusLine("R100\ta/src/old.ts\tb/src/new.ts")).toMatchObject({
      path: "src/new.ts",
      previousPath: "src/old.ts",
      changeType: "renamed",
    });
  });

  test("parses hunk headers for additions and deletion-only hunks", () => {
    expect(parseAiChangeReviewHunkHeader("@@ -4,2 +8,3 @@")).toMatchObject({
      oldStart: 4,
      oldCount: 2,
      newStart: 8,
      newCount: 3,
      representativeLine: 8,
    });
    expect(parseAiChangeReviewHunkHeader("@@ -9,2 +0,0 @@")).toMatchObject({
      oldStart: 9,
      oldCount: 2,
      newStart: 0,
      newCount: 0,
      representativeLine: 9,
    });
  });

  test("tracks state across rename and delete hunks", () => {
    const filesByPath = new Map<string, AiChangeReviewChangedFile>([
      [
        "src/app/consumer-d.ts",
        {
          path: "src/app/consumer-d.ts",
          previousPath: "src/app/consumer-c.ts",
          changeType: "renamed",
          hunks: [],
          changedLines: 0,
          representativeLine: 1,
        },
      ],
      [
        "src/service/payment.ts",
        {
          path: "src/service/payment.ts",
          changeType: "deleted",
          hunks: [],
          changedLines: 0,
          representativeLine: 1,
        },
      ],
    ]);

    parseAiChangeReviewDiffHunks(
      [
        "diff --git a/src/app/consumer-c.ts b/src/app/consumer-d.ts",
        "rename from src/app/consumer-c.ts",
        "rename to src/app/consumer-d.ts",
        "--- a/src/app/consumer-c.ts",
        "+++ b/src/app/consumer-d.ts",
        "@@ -10,2 +10,3 @@",
        "-old",
        "+new",
        "diff --git a/src/service/payment.ts b/src/service/payment.ts",
        "--- a/src/service/payment.ts",
        "+++ /dev/null",
        "@@ -3,2 +0,0 @@",
        "-charge",
        "-return amount;",
      ].join("\n"),
      filesByPath,
    );

    expect(filesByPath.get("src/app/consumer-d.ts")).toMatchObject({
      changedLines: 5,
      representativeLine: 10,
      hunks: [{ oldStart: 10, oldCount: 2, newStart: 10, newCount: 3, representativeLine: 10 }],
    });
    expect(filesByPath.get("src/service/payment.ts")).toMatchObject({
      changedLines: 2,
      representativeLine: 3,
      hunks: [{ oldStart: 3, oldCount: 2, newStart: 0, newCount: 0, representativeLine: 3 }],
    });
  });

  test(
    "collectBranchDiff preserves rename and delete entries without content changes",
    async () => {
      const fixture = await createAiChangeReviewFixture({
        withFeatureChanges: false,
        withRenameChange: true,
        withDeletedFile: true,
      });
      try {
        const diff = await collectBranchDiff({
          repoPath: fixture.repoPath,
          baseBranch: fixture.baseBranch,
          headBranch: fixture.headBranch,
        });

        expect(diff.files).toHaveLength(2);
        expect(diff.files).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: "src/app/consumer-d.ts",
              previousPath: "src/app/consumer-c.ts",
              changeType: "renamed",
              changedLines: 0,
              representativeLine: 1,
            }),
            expect.objectContaining({
              path: "src/service/payment.ts",
              changeType: "deleted",
              changedLines: 3,
              representativeLine: 1,
              hunks: [
                expect.objectContaining({
                  oldStart: 1,
                  oldCount: 3,
                  newStart: 0,
                  newCount: 0,
                  representativeLine: 1,
                }),
              ],
            }),
          ]),
        );
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_DIFF_TEST_TIMEOUT_MS,
  );

  test("applies diff lines with a reusable cursor", () => {
    const filesByPath = new Map<string, AiChangeReviewChangedFile>([
      [
        "src/example.ts",
        {
          path: "src/example.ts",
          changeType: "modified",
          hunks: [],
          changedLines: 0,
          representativeLine: 1,
        },
      ],
    ]);
    const cursor = createAiChangeReviewDiffCursor();

    applyAiChangeReviewDiffLine("diff --git a/src/example.ts b/src/example.ts", filesByPath, cursor);
    applyAiChangeReviewDiffLine("--- a/src/example.ts", filesByPath, cursor);
    applyAiChangeReviewDiffLine("+++ b/src/example.ts", filesByPath, cursor);
    applyAiChangeReviewDiffLine("@@ -2,1 +2,2 @@", filesByPath, cursor);

    expect(filesByPath.get("src/example.ts")).toMatchObject({
      changedLines: 3,
      representativeLine: 2,
      hunks: [{ oldStart: 2, oldCount: 1, newStart: 2, newCount: 2, representativeLine: 2 }],
    });
  });
});
