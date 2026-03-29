import { execFile as execFileCallback } from "node:child_process";
import { appendFile, cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { CommandResponse, DomainDesignShadowRolloutBatchResult } from "../src/core/contracts.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

const execFile = promisify(execFileCallback);

const FIXTURE_REPO = path.resolve("fixtures/domain-design/sample-repo");
const FIXTURE_MODEL = path.resolve("fixtures/domain-design/model.yaml");
const FIXTURE_POLICY = path.resolve("fixtures/policies/default.yaml");

describe("shadow rollout batch observation", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const current = tempPaths.pop();
      if (current) {
        await rm(current, { recursive: true, force: true });
      }
    }
  });

  test("aggregates multiple repo observations from a batch spec", async () => {
    const baselineRepo = await createTemporaryGitRepoFromFixture(FIXTURE_REPO);
    const scatteredRepo = await createTemporaryGitRepoFromFixture(FIXTURE_REPO);
    const specRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-shadow-batch-"));
    const batchSpecPath = path.join(specRoot, "batch-spec.yaml");
    const copiedModelPath = path.join(specRoot, "model.yaml");
    const copiedPolicyPath = path.join(specRoot, "policy.yaml");
    tempPaths.push(baselineRepo, scatteredRepo, specRoot);

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/contracts/invoice-contract.ts":
          "\nexport interface ShadowScatteredInvoiceOne { id: string; }\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const shadowScatteredOne = 'scattered-1';\n"
      },
      "feat: scattered cross-context 1"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/contracts/invoice-contract.ts":
          "\nexport interface ShadowScatteredInvoiceTwo { id: string; }\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const shadowScatteredTwo = 'scattered-2';\n"
      },
      "feat: scattered cross-context 2"
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
        `    repo: "${baselineRepo}"`,
        '    model: "./model.yaml"',
        "  - repoId: scattered",
        '    label: "Scattered"',
        '    category: "risky"',
        `    repo: "${scatteredRepo}"`,
        '    model: "./model.yaml"'
      ].join("\n"),
      "utf8"
    );

    const response = (await COMMANDS["score.observe_shadow_rollout_batch"]!(
      {
        "batch-spec": batchSpecPath
      },
      { cwd: process.cwd() }
    )) as CommandResponse<DomainDesignShadowRolloutBatchResult>;

    const result = response.result;
    const baseline = result.observations.find((entry) => entry.repoId === "baseline");
    const scattered = result.observations.find((entry) => entry.repoId === "scattered");

    expect(response.status).not.toBe("error");
    expect(result.observations).toHaveLength(2);
    expect(result.categories.map((entry) => entry.category).sort()).toEqual(["risky", "stable"]);
    expect(result.categories.find((entry) => entry.category === "stable")?.repoIds).toEqual(["baseline"]);
    expect(result.categories.find((entry) => entry.category === "risky")?.repoIds).toEqual(["scattered"]);
    expect(result.overall.repoCount).toBe(2);
    expect(baseline).toBeDefined();
    expect(scattered).toBeDefined();
    expect(baseline?.modelPath).toBe(copiedModelPath);
    expect(baseline?.policyPath).toBe(copiedPolicyPath);
    expect(scattered?.modelPath).toBe(copiedModelPath);
    expect(scattered?.policyPath).toBe(copiedPolicyPath);
    expect(result.overall.driftCounts.aligned + result.overall.driftCounts.candidateHigher + result.overall.driftCounts.candidateLower).toBe(2);

    const expectedWeightedAverage =
      ((baseline?.policyDelta ?? 0) * (baseline?.relevantCommitCount ?? 0) +
        (scattered?.policyDelta ?? 0) * (scattered?.relevantCommitCount ?? 0)) /
      ((baseline?.relevantCommitCount ?? 0) + (scattered?.relevantCommitCount ?? 0));

    expect(result.overall.averageDelta).toBeCloseTo(
      ((baseline?.policyDelta ?? 0) + (scattered?.policyDelta ?? 0)) / 2,
      12
    );
    expect(result.overall.weightedAverageDelta).toBeCloseTo(expectedWeightedAverage, 12);
    expect(result.overall.minDelta).toBeCloseTo(
      Math.min(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0),
      12
    );
    expect(result.overall.maxDelta).toBeCloseTo(
      Math.max(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0),
      12
    );
    expect(result.overall.deltaRange).toBeCloseTo(
      Math.max(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0) -
        Math.min(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0),
      12
    );
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

  await execFile("git", ["add", "-A"], { cwd: repoPath });
  await execFile("git", ["commit", "-m", message], { cwd: repoPath });
}
