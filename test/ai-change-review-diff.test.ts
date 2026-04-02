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
  test("parses repo-relative status lines for added, deleted, and renamed files", () => {
    expect(parseAiChangeReviewNameStatusLine("A\tsrc/new.ts")).toMatchObject({
      path: "src/new.ts",
      changeType: "added",
    });
    expect(parseAiChangeReviewNameStatusLine("D\ta/old.ts")).toMatchObject({
      path: "a/old.ts",
      changeType: "deleted",
    });
    expect(parseAiChangeReviewNameStatusLine("R100\ta/old.ts\tb/new.ts")).toMatchObject({
      path: "b/new.ts",
      previousPath: "a/old.ts",
      changeType: "renamed",
    });
  });

  test("keeps repo-relative paths that start with a or b in name-status output", () => {
    expect(parseAiChangeReviewNameStatusLine("M\ta/example.ts")).toMatchObject({
      path: "a/example.ts",
      changeType: "modified",
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

  test("patch parsing keeps repository paths that include a or b directory names", () => {
    const filesByPath = new Map<string, AiChangeReviewChangedFile>([
      [
        "a/example.ts",
        {
          path: "a/example.ts",
          changeType: "modified",
          hunks: [],
          changedLines: 0,
          representativeLine: 1,
        },
      ],
      [
        "b/example.ts",
        {
          path: "b/example.ts",
          previousPath: "a/example.ts",
          changeType: "renamed",
          hunks: [],
          changedLines: 0,
          representativeLine: 1,
        },
      ],
    ]);

    parseAiChangeReviewDiffHunks(
      [
        "diff --git a/a/example.ts b/b/example.ts",
        "rename from a/example.ts",
        "rename to b/example.ts",
        "--- a/a/example.ts",
        "+++ b/b/example.ts",
        "@@ -1,1 +1,2 @@",
        "-old",
        "+new",
      ].join("\n"),
      filesByPath,
    );

    expect(filesByPath.get("b/example.ts")).toMatchObject({
      changedLines: 3,
      representativeLine: 1,
      hunks: [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 2, representativeLine: 1 }],
    });
  });

  test("diff headers preserve repository paths that begin with a or b without rename metadata", () => {
    const filesByPath = new Map<string, AiChangeReviewChangedFile>([
      [
        "b/example.ts",
        {
          path: "b/example.ts",
          changeType: "modified",
          hunks: [],
          changedLines: 0,
          representativeLine: 1,
        },
      ],
    ]);

    parseAiChangeReviewDiffHunks(
      [
        "diff --git a/b/example.ts b/b/example.ts",
        "--- a/b/example.ts",
        "+++ b/b/example.ts",
        "@@ -4,1 +4,2 @@",
        "-old",
        "+new",
      ].join("\n"),
      filesByPath,
    );

    expect(filesByPath.get("b/example.ts")).toMatchObject({
      changedLines: 3,
      representativeLine: 4,
      hunks: [{ oldStart: 4, oldCount: 1, newStart: 4, newCount: 2, representativeLine: 4 }],
    });
  });
});
