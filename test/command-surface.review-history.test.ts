import path from "node:path";

import { describe, expect, test } from "vitest";

import { COMMANDS, maybeWriteOutput } from "../src/commands.js";
import { createAiChangeReviewFixture } from "./ai-change-review.helpers.js";
import { ARCHITECTURE_CONSTRAINTS_PATH, CONTEXT, withTemporaryDirectory } from "./command-surface.helpers.js";
import { cleanupTemporaryRepo } from "./helpers.js";

const SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS = 15_000;

describe("command surface review and history helpers", () => {
  test("review.list_unknowns accepts both input files and source-command delegation", async () => {
    await withTemporaryDirectory("context-probe-review-", async (tempDir) => {
      const scorePath = path.join(tempDir, "score.json");
      const scoreResponse = await COMMANDS["score.compute"]!(
        {
          domain: "architecture_design",
          repo: ".",
          constraints: ARCHITECTURE_CONSTRAINTS_PATH,
          policy: path.resolve("fixtures/policies/default.yaml"),
        },
        CONTEXT,
      );

      await maybeWriteOutput(scoreResponse, { output: scorePath }, CONTEXT);

      const fromInput = await COMMANDS["review.list_unknowns"]!({ input: scorePath }, CONTEXT);
      const fromSourceCommand = await COMMANDS["review.list_unknowns"]!(
        {
          "source-command": "score.compute",
          domain: "architecture_design",
          repo: ".",
          constraints: ARCHITECTURE_CONSTRAINTS_PATH,
          policy: path.resolve("fixtures/policies/default.yaml"),
        },
        CONTEXT,
      );

      expect((fromInput.result as { reviewItems: unknown[] }).reviewItems.length).toBeGreaterThanOrEqual(0);
      expect((fromSourceCommand.result as { reviewItems: unknown[] }).reviewItems.length).toBeGreaterThanOrEqual(0);
      expect(fromSourceCommand.unknowns).toEqual(scoreResponse.unknowns);
    });
  }, 60000);

  test("history commands honor policy/profile inputs and review.resolve enforces required paths", async () => {
    const normalized = await COMMANDS["ingest.normalize_history"]!(
      {
        repo: ".",
        policy: path.resolve("fixtures/policies/default.yaml"),
        profile: "layered",
      },
      CONTEXT,
    );
    const locality = await COMMANDS["history.score_evolution_locality"]!(
      {
        repo: ".",
        model: path.resolve("config/self-measurement/domain-model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      CONTEXT,
    );

    expect(((normalized.result as { commits: unknown[] }).commits ?? []).length).toBeGreaterThan(0);
    expect(locality.confidence).toBeGreaterThan(0);
    await expect(COMMANDS["review.resolve"]!({}, CONTEXT)).rejects.toThrow(
      "`--review-items` and `--resolutions` are required",
    );
  });

  test(
    "review.list_unknowns renders ai_change_review targets with priority and provenance",
    async () => {
      const fixture = await createAiChangeReviewFixture();
      try {
        const scoreResponse = await COMMANDS["score.compute"]!(
          {
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: path.resolve("fixtures/policies/default.yaml"),
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          CONTEXT,
        );

        const reviewResponse = await COMMANDS["review.list_unknowns"]!(
          {
            "source-command": "score.compute",
            domain: "ai_change_review",
            repo: fixture.repoPath,
            policy: path.resolve("fixtures/policies/default.yaml"),
            "base-branch": fixture.baseBranch,
            "head-branch": fixture.headBranch,
          },
          CONTEXT,
        );

        const reviewItems = (
          reviewResponse.result as {
            reviewItems: Array<{ priority?: string; provenance?: Array<{ path?: string; line?: number }> }>;
          }
        ).reviewItems;

        expect(reviewItems.length).toBeGreaterThan(0);
        expect(reviewItems.some((item) => item.priority === "high")).toBe(true);
        expect(reviewItems.some((item) => item.provenance?.[0]?.path === "src/shared/util.ts")).toBe(true);
        expect(reviewItems.some((item) => (item.provenance?.[0]?.line ?? 0) > 0)).toBe(true);
        expect(reviewResponse.meta?.measurementQuality).toEqual(scoreResponse.meta?.measurementQuality);
        expect(reviewResponse.unknowns).toEqual(scoreResponse.unknowns);
      } finally {
        await cleanupTemporaryRepo(fixture.repoPath);
      }
    },
    SLOW_AI_CHANGE_REVIEW_TEST_TIMEOUT_MS,
  );
});
