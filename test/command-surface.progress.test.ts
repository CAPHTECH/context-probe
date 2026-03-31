import path from "node:path";

import { describe, expect, test, vi } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CONTEXT, DOMAIN_MODEL_PATH } from "./command-surface.helpers.js";

describe("command surface progress reporting", () => {
  test("score.compute reports progress through the command context during domain scoring", async () => {
    const reportProgress = vi.fn();

    await COMMANDS["score.compute"]!(
      {
        domain: "domain_design",
        repo: ".",
        model: DOMAIN_MODEL_PATH,
        policy: path.resolve("fixtures/policies/default.yaml"),
        "docs-root": "docs",
      },
      {
        ...CONTEXT,
        reportProgress,
      },
    );

    expect(reportProgress).toHaveBeenCalled();
    expect(
      reportProgress.mock.calls.some(
        ([update]) => update.phase === "history" && String(update.message).includes("history analysis"),
      ),
    ).toBe(true);
    expect(
      reportProgress.mock.calls.some(
        ([update]) =>
          update.phase === "docs" &&
          (String(update.message).includes("Computing ULI from document evidence.") ||
            String(update.message).includes("BFS: mapping document fragments to domain contexts.") ||
            String(update.message).includes("AFS: mapping invariants to aggregates and contexts.")),
      ),
    ).toBe(true);
    expect(
      reportProgress.mock.calls.some(
        ([update]) =>
          update.phase === "domain_design" &&
          String(update.message).includes("Assembling final domain score response."),
      ),
    ).toBe(true);
    expect(reportProgress.mock.calls.some(([update]) => update.phase === "domain_design")).toBe(true);
  }, 60000);
});
