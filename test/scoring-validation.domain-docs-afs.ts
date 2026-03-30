import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import { AFS_BAD_ENTRY, AFS_GOOD_ENTRY, AFS_MODEL_PATH, getMetric, POLICY_PATH } from "./scoring-validation.helpers.js";

export function registerDomainDocsAfsScoringValidationTests(tempRoots: string[]): void {
  test("AFS is higher for localized invariants than for cross-context transaction invariants", async () => {
    const goodRoot = await createTemporaryWorkspace([AFS_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([AFS_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, AFS_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, AFS_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, AFS_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, AFS_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init afs good");
    await initializeTemporaryGitRepo(badRepo, "feat: init afs bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: AFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: AFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs,
      },
      { cwd: process.cwd() },
    );

    const goodAfs = getMetric(goodResponse, "AFS");
    const badAfs = getMetric(badResponse, "AFS");

    expect(goodAfs.value).toBeGreaterThan(badAfs.value);
    expect(goodAfs.components.SIC ?? 0).toBeGreaterThan(badAfs.components.SIC ?? 0);
    expect(badAfs.components.XTC ?? 0).toBeGreaterThan(goodAfs.components.XTC ?? 0);
    expect(goodAfs.unknowns).toContain(
      "No aggregate definitions were found, so context is being used as an aggregate proxy.",
    );
  }, 15000);
}
