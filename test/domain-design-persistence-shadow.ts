import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { FIXTURE_ROOT, SHADOW_ROLLOUT_REGISTRY_PATH } from "./domain-design.helpers.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

export function registerDomainDesignPersistenceShadowTests(state: DomainDesignTestState): void {
  test("score.compute exposes persistence shadow data without changing ELS", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const baseline = await COMMANDS["score.compute"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const shadowed = await COMMANDS["score.compute"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "shadow-persistence": true,
      },
      { cwd: process.cwd() },
    );

    const baselineResult = baseline.result as {
      metrics: Array<{ metricId: string; value: number }>;
      shadow?: unknown;
    };
    const shadowedResult = shadowed.result as {
      metrics: Array<{ metricId: string; value: number }>;
      shadow?: {
        localityModels: {
          els: { score: number };
          persistenceCandidate: { localityScore: number };
        };
      };
    };

    expect(baselineResult.shadow).toBeUndefined();
    expect(shadowedResult.shadow?.localityModels.els.score).toBeGreaterThanOrEqual(0);
    expect(shadowedResult.shadow?.localityModels.persistenceCandidate.localityScore).toBeGreaterThanOrEqual(0);
    expect(shadowedResult.metrics.find((metric) => metric.metricId === "ELS")?.value).toBe(
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value,
    );
  }, 20000);

  test("score.compute rejects rollout-category without pilot-persistence", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    await expect(
      COMMANDS["score.compute"]!(
        {
          repo: state.repoPath,
          model: path.join(FIXTURE_ROOT, "model.yaml"),
          policy: path.resolve("fixtures/policies/default.yaml"),
          domain: "domain_design",
          "rollout-category": "application",
        },
        { cwd: process.cwd() },
      ),
    ).rejects.toThrow("`--rollout-category` requires `--pilot-persistence`");
  }, 20000);

  test("score.observe_shadow_rollout ignores pilot flags when computing shadow-only drift", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const baseline = await COMMANDS["score.observe_shadow_rollout"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      { cwd: process.cwd() },
    );
    const withPilotFlags = await COMMANDS["score.observe_shadow_rollout"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        "pilot-persistence": true,
        "rollout-category": "application",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH,
      },
      { cwd: process.cwd() },
    );

    const baselineResult = baseline.result as {
      observation: { policyDelta: number; modelDelta: number; driftCategory: string };
      elsMetric: { value: number };
    };
    const flaggedResult = withPilotFlags.result as {
      observation: { policyDelta: number; modelDelta: number; driftCategory: string };
      elsMetric: { value: number };
    };

    expect(flaggedResult.observation.policyDelta).toBeCloseTo(baselineResult.observation.policyDelta, 12);
    expect(flaggedResult.observation.modelDelta).toBeCloseTo(baselineResult.observation.modelDelta, 12);
    expect(flaggedResult.observation.driftCategory).toBe(baselineResult.observation.driftCategory);
    expect(flaggedResult.elsMetric.value).toBeCloseTo(baselineResult.elsMetric.value, 12);
  }, 20000);
}
