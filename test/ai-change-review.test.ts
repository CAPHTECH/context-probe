import path from "node:path";

import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { AiChangeReviewScoreResult } from "../src/core/contracts.js";
import {
  createAiChangeReviewFixture,
  createJsSpecifierDeleteAiChangeReviewFixture,
  createSparseAiChangeReviewFixture,
} from "./ai-change-review.helpers.js";
import { cleanupTemporaryRepo } from "./helpers.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS = 15_000;

describe("ai change review scoring", () => {
  test(
    "requires base and head branches for ai_change_review",
    async () => {
      const fixture = await createAiChangeReviewFixture();
      try {
        await expect(
          COMMANDS["score.compute"]!(
            {
              domain: "ai_change_review",
              repo: fixture.repoPath,
              policy: POLICY_PATH,
            },
            { cwd: process.cwd() },
          ),
        ).rejects.toThrow("`--base-branch` and `--head-branch` are required");
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );

  test(
    "fails clearly when a requested branch does not exist",
    async () => {
      const fixture = await createAiChangeReviewFixture();
      try {
        await expect(
          COMMANDS["score.compute"]!(
            {
              domain: "ai_change_review",
              repo: fixture.repoPath,
              policy: POLICY_PATH,
              "base-branch": fixture.baseBranch,
              "head-branch": "missing-branch",
            },
            { cwd: process.cwd() },
          ),
        ).rejects.toThrow();
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );

  test(
    "returns an empty review target list for an empty branch diff",
    async () => {
      const fixture = await createAiChangeReviewFixture({ withFeatureChanges: false });
      try {
        const response = await COMMANDS["score.compute"]!(
          {
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: POLICY_PATH,
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          { cwd: process.cwd() },
        );
        const result = response.result as AiChangeReviewScoreResult;

        expect(response.status).toBe("ok");
        expect(result.reviewTargets).toEqual([]);
        expect(result.diffSummary.changedFileCount).toBe(0);
        expect(result.diffSummary.changedHunkCount).toBe(0);
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );

  test(
    "scores changed files and emits review targets with expected reasons",
    async () => {
      const fixture = await createAiChangeReviewFixture();
      try {
        const response = await COMMANDS["score.compute"]!(
          {
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: POLICY_PATH,
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          { cwd: process.cwd() },
        );
        const result = response.result as AiChangeReviewScoreResult;
        const byPath = new Map(result.reviewTargets.map((target) => [target.path, target]));

        expect(result.diffSummary.changedFileCount).toBe(3);
        expect(result.diffSummary.changedHunkCount).toBeGreaterThanOrEqual(3);
        expect(result.diffSummary.analyzedFileCount).toBe(3);

        const utilTarget = byPath.get("src/shared/util.ts");
        expect(utilTarget?.priority).toBe("high");
        expect(utilTarget?.reasons).toEqual(expect.arrayContaining(["wide_blast_radius", "history_hotspot"]));
        expect(utilTarget?.line).toBeGreaterThan(0);

        const paymentTarget = byPath.get("src/service/payment.ts");
        expect(paymentTarget?.priority).toBe("medium");
        expect(paymentTarget?.reasons).toContain("test_gap");

        const largeTarget = byPath.get("src/large.ts");
        expect(largeTarget?.priority).toBe("medium");
        expect(largeTarget?.reasons).toContain("large_change");
        expect(largeTarget?.summary).toContain("large diff");
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );

  test(
    "renamed hotspot files inherit dependency and history signals from the previous path",
    async () => {
      const fixture = await createAiChangeReviewFixture({
        withFeatureChanges: false,
        withRenamedSharedUtil: true,
      });
      try {
        const response = await COMMANDS["score.compute"]!(
          {
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: POLICY_PATH,
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          { cwd: process.cwd() },
        );
        const result = response.result as AiChangeReviewScoreResult;
        const renamedTarget = result.reviewTargets.find((target) => target.path === "src/shared/util-renamed.ts");

        expect(renamedTarget?.priority).toBe("high");
        expect(renamedTarget?.reasons).toEqual(expect.arrayContaining(["wide_blast_radius", "history_hotspot"]));
        expect(renamedTarget?.summary).toContain("downstream dependencies");
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );

  test(
    "deleted dependency hubs still surface stale downstream imports as blast radius",
    async () => {
      const fixture = await createAiChangeReviewFixture({
        withFeatureChanges: false,
        withDeletedSharedUtil: true,
      });
      try {
        const response = await COMMANDS["score.compute"]!(
          {
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: POLICY_PATH,
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          { cwd: process.cwd() },
        );
        const result = response.result as AiChangeReviewScoreResult;
        const deletedTarget = result.reviewTargets.find((target) => target.path === "src/shared/util.ts");

        expect(deletedTarget?.priority).toBe("high");
        expect(deletedTarget?.reasons).toEqual(expect.arrayContaining(["wide_blast_radius", "history_hotspot"]));
        expect(deletedTarget?.summary).toContain("downstream dependencies");
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );

  test(
    "sparse history does not promote a file into history_hotspot after a single follow-up commit",
    async () => {
      const fixture = await createSparseAiChangeReviewFixture();
      try {
        const response = await COMMANDS["score.compute"]!(
          {
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: POLICY_PATH,
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          { cwd: process.cwd() },
        );
        const result = response.result as AiChangeReviewScoreResult;
        const lonelyTarget = result.reviewTargets.find((target) => target.path === "src/lonely.ts");

        expect(lonelyTarget?.reasons).not.toContain("history_hotspot");
        expect(lonelyTarget?.reasons).toContain("test_gap");
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );

  test(
    "deleted files imported through .js specifiers still surface wide blast radius",
    async () => {
      const fixture = await createJsSpecifierDeleteAiChangeReviewFixture();
      try {
        const response = await COMMANDS["score.compute"]!(
          {
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: POLICY_PATH,
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          { cwd: process.cwd() },
        );
        const result = response.result as AiChangeReviewScoreResult;
        const deletedTarget = result.reviewTargets.find((target) => target.path === "src/shared/util.ts");

        expect(deletedTarget?.priority).toBe("high");
        expect(deletedTarget?.reasons).toContain("wide_blast_radius");
        expect(deletedTarget?.reasons).not.toContain("history_hotspot");
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );
});
