import { appendFile, cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type {
  CommandResponse,
  DomainDesignShadowRolloutGateResult
} from "../src/core/contracts.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

const FIXTURE_REPO = path.resolve("fixtures/domain-design/sample-repo");
const FIXTURE_MODEL = path.resolve("fixtures/domain-design/model.yaml");
const FIXTURE_POLICY = path.resolve("fixtures/policies/default.yaml");
const REGISTRY_PATH = path.resolve("fixtures/validation/shadow-rollout/registry.yaml");

describe("shadow rollout gate command", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const current = tempPaths.pop();
      if (current) {
        await rm(current, { recursive: true, force: true });
      }
    }
  });

  test("evaluates the versioned real-repo registry", async () => {
    const response = (await COMMANDS["gate.evaluate_shadow_rollout"]!(
      {
        registry: REGISTRY_PATH
      },
      { cwd: process.cwd() }
    )) as CommandResponse<DomainDesignShadowRolloutGateResult>;

    expect(response.status).toBe("warning");
    expect(response.result.source).toBe("registry");
    expect(response.result.evaluation.repoCount).toBe(7);
    const application = response.result.evaluation.categories.find(
      (entry) => entry.category === "application"
    );
    const tooling = response.result.evaluation.categories.find(
      (entry) => entry.category === "tooling"
    );
    expect(response.result.evaluation.categories.map((entry) => entry.category)).toEqual([
      "application",
      "tooling"
    ]);
    expect(application?.gate.rolloutDisposition).toBe("replace");
    expect(application?.gate.replacementVerdict).toBe("go");
    expect(application?.gate.reasons).toEqual([]);
    expect(tooling?.gate.rolloutDisposition).toBe("shadow_only");
    expect(tooling?.gate.replacementVerdict).toBe("no_go");
    expect(tooling?.gate.reasons).toEqual(["real_repo_weighted_average_delta_above_threshold"]);
    expect(response.result.evaluation.rolloutDisposition).toBe("shadow_only");
    expect(response.result.evaluation.reasons).toEqual(["real_repo_delta_range_above_threshold"]);
    expect(response.provenance).toContainEqual(
      expect.objectContaining({ path: REGISTRY_PATH, note: "shadow rollout registry" })
    );
  });

  test("evaluates a live batch spec through the gate surface", async () => {
    const baselineRepo = await createTemporaryGitRepoFromFixture(FIXTURE_REPO);
    const scatteredRepo = await createTemporaryGitRepoFromFixture(FIXTURE_REPO);
    const specRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-shadow-gate-"));
    const batchSpecPath = path.join(specRoot, "batch-spec.yaml");
    const copiedModelPath = path.join(specRoot, "model.yaml");
    const copiedPolicyPath = path.join(specRoot, "policy.yaml");
    tempPaths.push(baselineRepo, scatteredRepo, specRoot);

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/contracts/invoice-contract.ts":
          "\nexport interface ShadowGateInvoiceOne { id: string; }\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const shadowGateOne = 'gate-1';\n"
      },
      "feat: gate scattered 1"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/contracts/invoice-contract.ts":
          "\nexport interface ShadowGateInvoiceTwo { id: string; }\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const shadowGateTwo = 'gate-2';\n"
      },
      "feat: gate scattered 2"
    );

    await cp(FIXTURE_MODEL, copiedModelPath);
    await cp(FIXTURE_POLICY, copiedPolicyPath);
    await writeFile(
      batchSpecPath,
      [
        'version: "1.0"',
        'policy: "./policy.yaml"',
        "tieTolerance: 0.02",
        "entries:",
        "  - repoId: baseline",
        '    label: "Baseline"',
        '    category: "stable"',
        '    modelSource: "repo_owned"',
        `    repo: "${baselineRepo}"`,
        '    model: "./model.yaml"',
        "  - repoId: scattered",
        '    label: "Scattered"',
        '    category: "risky"',
        '    modelSource: "repo_owned"',
        `    repo: "${scatteredRepo}"`,
        '    model: "./model.yaml"'
      ].join("\n"),
      "utf8"
    );

    const response = (await COMMANDS["gate.evaluate_shadow_rollout"]!(
      {
        "batch-spec": batchSpecPath
      },
      { cwd: process.cwd() }
    )) as CommandResponse<DomainDesignShadowRolloutGateResult>;

    expect(response.status).toBe("warning");
    expect(response.result.source).toBe("batch_spec");
    expect(response.result.batchSpecPath).toBe(batchSpecPath);
    expect(response.result.evaluation.repoCount).toBe(2);
    expect(response.result.evaluation.reasons).toContain("insufficient_real_repo_observations");
    expect(response.result.evaluation.rolloutDisposition).toBe("shadow_only");
    expect(response.provenance).toContainEqual(
      expect.objectContaining({ path: batchSpecPath, note: "shadow rollout batch spec" })
    );
  }, 20000);
});

async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    await appendFile(path.join(repoPath, relativePath), content, "utf8");
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  await run("git", ["add", "-A"], { cwd: repoPath });
  await run("git", ["commit", "-m", message], { cwd: repoPath });
}
