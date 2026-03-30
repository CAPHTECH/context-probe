import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import { DRF_BAD_ENTRY, DRF_GOOD_ENTRY, DRF_MODEL_PATH, getMetric, POLICY_PATH } from "./scoring-validation.helpers.js";

export function registerDomainDocsDrfScoringValidationTests(tempRoots: string[]): void {
  test("DRF is higher for explicit rules and invariants than for ambiguous documents", async () => {
    const goodRoot = await createTemporaryWorkspace([DRF_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([DRF_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, DRF_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, DRF_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, DRF_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, DRF_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init drf good");
    await initializeTemporaryGitRepo(badRepo, "feat: init drf bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: DRF_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: DRF_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs,
      },
      { cwd: process.cwd() },
    );

    const goodDrf = getMetric(goodResponse, "DRF");
    const badDrf = getMetric(badResponse, "DRF");

    expect(goodDrf.value).toBeGreaterThan(badDrf.value);
    expect(goodDrf.components.RC ?? 0).toBeGreaterThan(badDrf.components.RC ?? 0);
    expect(goodDrf.components.RA ?? 0).toBeGreaterThan(badDrf.components.RA ?? 0);
    expect(badDrf.unknowns).toContain("SC is an approximation based on use-case signals.");
  }, 15000);
}
