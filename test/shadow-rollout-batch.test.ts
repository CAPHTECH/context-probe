import { rm } from "node:fs/promises";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { CommandResponse, DomainDesignShadowRolloutBatchResult } from "../src/core/contracts.js";
import { summarizeShadowRolloutBatchObservations } from "../src/core/shadow-rollout.js";
import {
  createShadowRolloutBatchWorkspace,
  seedScatteredRepo,
  writeShadowRolloutBatchSpec,
} from "./shadow-rollout-batch.helpers.js";

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
    const workspace = await createShadowRolloutBatchWorkspace();
    tempPaths.push(workspace.baselineRepo, workspace.scatteredRepo, workspace.specRoot);

    await seedScatteredRepo(workspace.scatteredRepo);
    await writeShadowRolloutBatchSpec(workspace);

    const response = (await COMMANDS["score.observe_shadow_rollout_batch"]!(
      {
        "batch-spec": workspace.batchSpecPath,
      },
      { cwd: process.cwd() },
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
    expect(baseline?.modelPath).toBe(workspace.copiedModelPath);
    expect(baseline?.policyPath).toBe(workspace.copiedPolicyPath);
    expect(scattered?.modelPath).toBe(workspace.copiedModelPath);
    expect(scattered?.policyPath).toBe(workspace.copiedPolicyPath);
    expect(
      result.overall.driftCounts.aligned +
        result.overall.driftCounts.candidateHigher +
        result.overall.driftCounts.candidateLower,
    ).toBe(2);

    const expectedWeightedAverage =
      ((baseline?.policyDelta ?? 0) * (baseline?.relevantCommitCount ?? 0) +
        (scattered?.policyDelta ?? 0) * (scattered?.relevantCommitCount ?? 0)) /
      ((baseline?.relevantCommitCount ?? 0) + (scattered?.relevantCommitCount ?? 0));

    expect(result.overall.averageDelta).toBeCloseTo(
      ((baseline?.policyDelta ?? 0) + (scattered?.policyDelta ?? 0)) / 2,
      12,
    );
    expect(result.overall.weightedAverageDelta).toBeCloseTo(expectedWeightedAverage, 12);
    expect(result.overall.minDelta).toBeCloseTo(Math.min(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0), 12);
    expect(result.overall.maxDelta).toBeCloseTo(Math.max(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0), 12);
    expect(result.overall.deltaRange).toBeCloseTo(
      Math.max(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0) -
        Math.min(baseline?.policyDelta ?? 0, scattered?.policyDelta ?? 0),
      12,
    );
    expect(response.provenance).toContainEqual(
      expect.objectContaining({ path: workspace.batchSpecPath, note: "shadow rollout batch spec" }),
    );
  }, 20000);

  test("summarizes empty and zero-weight batches without dividing by zero", () => {
    expect(summarizeShadowRolloutBatchObservations([])).toEqual({
      repoCount: 0,
      averageDelta: 0,
      weightedAverageDelta: 0,
      minDelta: 0,
      maxDelta: 0,
      deltaRange: 0,
      driftCounts: {
        aligned: 0,
        candidateHigher: 0,
        candidateLower: 0,
      },
    });

    expect(
      summarizeShadowRolloutBatchObservations([
        {
          repoId: "alpha",
          category: "stable",
          modelSource: "repo_owned",
          repoPath: "/tmp/alpha-repo",
          modelPath: "/tmp/alpha-model.yaml",
          policyPath: "/tmp/alpha-policy.yaml",
          relevantCommitCount: 0,
          policyDelta: 0.2,
          modelDelta: 0.2,
          driftCategory: "aligned",
          elsMetric: 0.9,
          persistenceLocalityScore: 0.9,
          confidence: 0.8,
          unknowns: [],
          status: "ok",
        },
        {
          repoId: "beta",
          category: "stable",
          modelSource: "repo_owned",
          repoPath: "/tmp/beta-repo",
          modelPath: "/tmp/beta-model.yaml",
          policyPath: "/tmp/beta-policy.yaml",
          relevantCommitCount: 0,
          policyDelta: 0.1,
          modelDelta: 0.1,
          driftCategory: "candidate_higher",
          elsMetric: 0.85,
          persistenceLocalityScore: 0.85,
          confidence: 0.8,
          unknowns: [],
          status: "ok",
        },
      ]),
    ).toMatchObject({
      repoCount: 2,
      averageDelta: 0.15000000000000002,
      weightedAverageDelta: 0.15000000000000002,
      driftCounts: {
        aligned: 1,
        candidateHigher: 1,
        candidateLower: 0,
      },
    });
  });
});
