import { expect, test } from "vitest";

import { evaluateShadowRolloutGate } from "../src/core/shadow-rollout.js";

export function registerShadowRolloutGateEvaluationTests(): void {
  test("blocks category replacement when a versioned manifest path is missing", () => {
    const evaluation = evaluateShadowRolloutGate([
      {
        repoId: "app-a",
        category: "application",
        modelSource: "versioned_manifest",
        relevantCommitCount: 50,
        delta: 0.01,
      },
      {
        repoId: "app-b",
        category: "application",
        modelSource: "versioned_manifest",
        modelPath: "/tmp/app-b-model.yaml",
        relevantCommitCount: 60,
        delta: 0.02,
      },
      {
        repoId: "app-c",
        category: "application",
        modelSource: "versioned_manifest",
        modelPath: "/tmp/app-c-model.yaml",
        relevantCommitCount: 55,
        delta: 0.015,
      },
      {
        repoId: "tool-a",
        category: "tooling",
        modelSource: "repo_owned",
        modelPath: "/tmp/tool-a-model.yaml",
        relevantCommitCount: 40,
        delta: 0.01,
      },
      {
        repoId: "tool-b",
        category: "tooling",
        modelSource: "repo_owned",
        modelPath: "/tmp/tool-b-model.yaml",
        relevantCommitCount: 42,
        delta: 0.015,
      },
      {
        repoId: "tool-c",
        category: "tooling",
        modelSource: "repo_owned",
        modelPath: "/tmp/tool-c-model.yaml",
        relevantCommitCount: 43,
        delta: 0.02,
      },
    ]);

    const application = evaluation.categories.find((entry) => entry.category === "application");

    expect(application?.gate.rolloutDisposition).toBe("shadow_only");
    expect(application?.gate.reasons).toContain("missing_versioned_manifest_path");
  });

  test("falls back to arithmetic mean when all gate weights are zero", () => {
    const evaluation = evaluateShadowRolloutGate([
      {
        repoId: "alpha",
        category: "application",
        modelSource: "repo_owned",
        modelPath: "/tmp/alpha-model.yaml",
        relevantCommitCount: 0,
        delta: 0.2,
      },
      {
        repoId: "beta",
        category: "application",
        modelSource: "repo_owned",
        modelPath: "/tmp/beta-model.yaml",
        relevantCommitCount: 0,
        delta: 0.1,
      },
    ]);

    expect(evaluation.overall.averageDelta).toBeCloseTo(0.15, 12);
    expect(evaluation.overall.weightedAverageDelta).toBeCloseTo(0.15, 12);
    expect(evaluation.reasons).toContain("insufficient_real_repo_observations");
    expect(evaluation.reasons).toContain("real_repo_weighted_average_delta_above_threshold");
  });
}
