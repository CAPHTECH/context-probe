import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CONTEXT } from "./command-surface.helpers.js";

describe("command surface shadow rollout helpers", () => {
  test("shadow rollout batch observation reports a missing policy path before invoking the observe command", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-probe-shadow-batch-missing-policy-"));
    const batchSpecPath = path.join(tempDir, "batch-spec.yaml");
    await writeFile(
      batchSpecPath,
      [
        'version: "1.0"',
        "entries:",
        "  - repoId: missing-policy",
        '    category: "stable"',
        '    repo: "."',
        '    model: "./model.yaml"',
      ].join("\n"),
      "utf8",
    );

    await expect(
      COMMANDS["score.observe_shadow_rollout_batch"]!({ "batch-spec": batchSpecPath }, CONTEXT),
    ).rejects.toThrow("missing a policy path");
  });
});
