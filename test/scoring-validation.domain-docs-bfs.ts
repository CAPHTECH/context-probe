import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import { BFS_BAD_ENTRY, BFS_GOOD_ENTRY, BFS_MODEL_PATH, getMetric, POLICY_PATH } from "./scoring-validation.helpers.js";

export function registerDomainDocsBfsScoringValidationTests(tempRoots: string[]): void {
  test("BFS is higher for context-localized documents than for misaligned shared-boundary documents", async () => {
    const goodRoot = await createTemporaryWorkspace([BFS_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([BFS_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, BFS_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, BFS_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, BFS_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, BFS_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init bfs good");
    await initializeTemporaryGitRepo(badRepo, "feat: init bfs bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: BFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: BFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs,
      },
      { cwd: process.cwd() },
    );

    const goodBfs = getMetric(goodResponse, "BFS");
    const badBfs = getMetric(badResponse, "BFS");

    expect(goodBfs.value).toBeGreaterThan(badBfs.value);
    expect(goodBfs.components.A ?? 0).toBeGreaterThan(badBfs.components.A ?? 0);
    expect(goodBfs.components.R ?? 0).toBeGreaterThanOrEqual(badBfs.components.R ?? 0);
  }, 15000);
}
