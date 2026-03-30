import { chmod } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import {
  AFS_BAD_ENTRY,
  AFS_GOOD_ENTRY,
  AFS_MODEL_PATH,
  BFS_BAD_ENTRY,
  BFS_GOOD_ENTRY,
  BFS_MODEL_PATH,
  CODEX_STUB,
  DRF_BAD_ENTRY,
  DRF_GOOD_ENTRY,
  DRF_MODEL_PATH,
  getMetric,
  POLICY_PATH,
  ULI_BAD_TRACE_ENTRY,
  ULI_GOOD_ENTRY,
  ULI_MODEL_PATH,
} from "./scoring-validation.helpers.js";

export function registerDomainDocsScoringValidationTests(tempRoots: string[]): void {
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
