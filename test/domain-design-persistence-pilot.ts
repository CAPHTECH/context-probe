import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { FIXTURE_ROOT, SHADOW_ROLLOUT_REGISTRY_PATH } from "./domain-design.helpers.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

export function registerDomainDesignPersistencePilotTests(state: DomainDesignTestState): void {
  test("score.compute application pilot replaces ELS with persistence candidate", async () => {
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
    const pilot = await COMMANDS["score.compute"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "pilot-persistence": true,
        "rollout-category": "application",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH,
      },
      { cwd: process.cwd() },
    );

    const baselineResult = baseline.result as {
      metrics: Array<{ metricId: string; value: number }>;
    };
    const pilotResult = pilot.result as {
      metrics: Array<{ metricId: string; value: number }>;
      shadow?: {
        localityModels: {
          persistenceCandidate: { localityScore: number };
        };
      };
      pilot?: {
        applied: boolean;
        localitySource: "els" | "persistence_candidate";
        baselineElsValue: number;
        persistenceCandidateValue: number;
        effectiveElsValue: number;
        overallGate: { rolloutDisposition: "replace" | "shadow_only" };
        categoryGate: { rolloutDisposition: "replace" | "shadow_only" };
      };
    };

    expect(pilotResult.shadow?.localityModels.persistenceCandidate.localityScore).toBeGreaterThanOrEqual(0);
    expect(pilotResult.pilot?.applied).toBe(true);
    expect(pilotResult.pilot?.localitySource).toBe("persistence_candidate");
    expect(pilotResult.pilot?.overallGate.rolloutDisposition).toBe("shadow_only");
    expect(pilotResult.pilot?.categoryGate.rolloutDisposition).toBe("replace");
    expect(pilotResult.pilot?.baselineElsValue).toBe(
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value,
    );
    expect(pilotResult.pilot?.persistenceCandidateValue).toBe(
      pilotResult.shadow?.localityModels.persistenceCandidate.localityScore,
    );
    expect(pilotResult.pilot?.effectiveElsValue).toBe(pilotResult.pilot?.persistenceCandidateValue);
    expect(pilotResult.metrics.find((metric) => metric.metricId === "ELS")?.value).toBe(
      pilotResult.pilot?.persistenceCandidateValue,
    );
  }, 20000);

  test("score.compute tooling pilot keeps ELS as the source of truth", async () => {
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
    const pilot = await COMMANDS["score.compute"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "pilot-persistence": true,
        "rollout-category": "tooling",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH,
      },
      { cwd: process.cwd() },
    );

    const baselineResult = baseline.result as {
      metrics: Array<{ metricId: string; value: number }>;
    };
    const pilotResult = pilot.result as {
      metrics: Array<{ metricId: string; value: number }>;
      shadow?: {
        localityModels: {
          persistenceCandidate: { localityScore: number };
        };
      };
      pilot?: {
        applied: boolean;
        localitySource: "els" | "persistence_candidate";
        baselineElsValue: number;
        persistenceCandidateValue: number;
        effectiveElsValue: number;
        categoryGate: { rolloutDisposition: "replace" | "shadow_only" };
      };
    };

    expect(pilotResult.shadow?.localityModels.persistenceCandidate.localityScore).toBeGreaterThanOrEqual(0);
    expect(pilotResult.pilot?.applied).toBe(false);
    expect(pilotResult.pilot?.localitySource).toBe("els");
    expect(pilotResult.pilot?.categoryGate.rolloutDisposition).toBe("shadow_only");
    expect(pilotResult.pilot?.baselineElsValue).toBe(
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value,
    );
    expect(pilotResult.pilot?.effectiveElsValue).toBe(pilotResult.pilot?.baselineElsValue);
    expect(pilotResult.metrics.find((metric) => metric.metricId === "ELS")?.value).toBe(
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value,
    );
  }, 20000);

  test("score.compute falls back to baseline ELS when pilot history comparison is unavailable", async () => {
    const nongitRepoPath = path.join(FIXTURE_ROOT, "sample-repo");

    const baseline = await COMMANDS["score.compute"]!(
      {
        repo: nongitRepoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const pilot = await COMMANDS["score.compute"]!(
      {
        repo: nongitRepoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "pilot-persistence": true,
        "rollout-category": "application",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH,
      },
      { cwd: process.cwd() },
    );

    const baselineResult = baseline.result as {
      metrics: Array<{ metricId: string; value: number }>;
    };
    const pilotResult = pilot.result as {
      metrics: Array<{ metricId: string; value: number; components: Record<string, number>; unknowns: string[] }>;
      pilot?: {
        applied: boolean;
        localitySource: "els" | "persistence_candidate";
        baselineElsValue: number;
        persistenceCandidateValue: number;
        effectiveElsValue: number;
      };
    };

    expect(pilotResult.pilot?.applied).toBe(false);
    expect(pilotResult.pilot?.localitySource).toBe("els");
    expect(pilotResult.pilot?.effectiveElsValue).toBe(pilotResult.pilot?.baselineElsValue);
    expect(pilotResult.pilot?.persistenceCandidateValue).toBe(pilotResult.pilot?.baselineElsValue);
    expect(pilotResult.metrics.find((metric) => metric.metricId === "ELS")?.value).toBe(
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value,
    );
    expect(
      pilotResult.metrics
        .find((metric) => metric.metricId === "ELS")
        ?.unknowns.some((entry) => entry.includes("fell back to baseline ELS")),
    ).toBe(true);
    expect(pilot.diagnostics).toContain(
      "Persistence pilot fell back to baseline ELS because locality comparison data is unavailable.",
    );
  }, 20000);

  test("score.compute rewrites ELS metric components when the persistence pilot is applied", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const pilot = await COMMANDS["score.compute"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "pilot-persistence": true,
        "rollout-category": "application",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH,
      },
      { cwd: process.cwd() },
    );

    const pilotResult = pilot.result as {
      metrics: Array<{
        metricId: string;
        components: Record<string, number>;
        confidence: number;
        evidenceRefs: string[];
        unknowns: string[];
      }>;
      shadow?: {
        localityModels: {
          persistenceCandidate: {
            persistentCouplingPenalty: number;
            clusterPenalty: number;
            pairPenalty: number;
            coherencePenalty: number;
          };
        };
      };
      pilot?: {
        localitySource: "els" | "persistence_candidate";
      };
    };
    const elsMetric = pilotResult.metrics.find((metric) => metric.metricId === "ELS");

    expect(elsMetric?.components).toEqual({
      persistentCouplingPenalty: pilotResult.shadow?.localityModels.persistenceCandidate.persistentCouplingPenalty,
      clusterPenalty: pilotResult.shadow?.localityModels.persistenceCandidate.clusterPenalty,
      pairPenalty: pilotResult.shadow?.localityModels.persistenceCandidate.pairPenalty,
      coherencePenalty: pilotResult.shadow?.localityModels.persistenceCandidate.coherencePenalty,
    });
    expect(pilotResult.pilot?.localitySource).toBe("persistence_candidate");
    expect(elsMetric?.confidence).toBeLessThan(1);
    expect(elsMetric?.evidenceRefs).toEqual([]);
    expect(elsMetric?.unknowns.some((entry) => entry.includes("persistence-derived locality metadata"))).toBe(true);
  }, 20000);
}
