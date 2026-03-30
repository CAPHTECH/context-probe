import { chmod } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import {
  CODEX_STUB,
  getMetric,
  POLICY_PATH,
  ULI_BAD_TRACE_ENTRY,
  ULI_GOOD_ENTRY,
  ULI_MODEL_PATH,
} from "./scoring-validation.helpers.js";

export function registerDomainDocsUliScoringValidationTests(tempRoots: string[]): void {
  test("ULI is higher for well-traced glossary terms than for untraced or colliding terms", async () => {
    await chmod(CODEX_STUB, 0o755);

    const goodRoot = await createTemporaryWorkspace([ULI_GOOD_ENTRY]);
    const badTraceRoot = await createTemporaryWorkspace([ULI_BAD_TRACE_ENTRY]);
    tempRoots.push(goodRoot, badTraceRoot);

    const goodRepo = path.join(goodRoot, ULI_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, ULI_GOOD_ENTRY, "docs");
    const badTraceRepo = path.join(badTraceRoot, ULI_BAD_TRACE_ENTRY, "repo");
    const badTraceDocs = path.join(badTraceRoot, ULI_BAD_TRACE_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init uli good");
    await initializeTemporaryGitRepo(badTraceRepo, "feat: init uli bad trace");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs,
      },
      { cwd: process.cwd() },
    );
    const badTraceResponse = await COMMANDS["score.compute"]!(
      {
        repo: badTraceRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badTraceDocs,
      },
      { cwd: process.cwd() },
    );
    const badCollisionResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs,
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none",
      },
      { cwd: process.cwd() },
    );

    const goodUli = getMetric(goodResponse, "ULI");
    const badTraceUli = getMetric(badTraceResponse, "ULI");
    const badCollisionUli = getMetric(badCollisionResponse, "ULI");

    expect(goodUli.value).toBeGreaterThan(badTraceUli.value);
    expect(goodUli.value).toBeGreaterThan(badCollisionUli.value);
    expect(goodUli.components.TL ?? 0).toBeGreaterThan(badTraceUli.components.TL ?? 0);
    expect(badCollisionUli.components.TC ?? 0).toBeGreaterThan(goodUli.components.TC ?? 0);
  }, 15000);
}
