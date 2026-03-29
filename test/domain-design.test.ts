import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../src/analyzers/code.js";
import { loadDomainModel } from "../src/core/model.js";
import { cleanupTemporaryRepo, createTemporaryGitRepoFromFixture } from "./helpers.js";

const FIXTURE_ROOT = path.resolve("fixtures/domain-design");
const SHADOW_ROLLOUT_REGISTRY_PATH = path.resolve("fixtures/validation/shadow-rollout/registry.yaml");

describe("domain design analysis", () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupTemporaryRepo(repoPath);
      repoPath = undefined;
    }
  });

  test("detects contract usage and boundary leaks", async () => {
    const model = await loadDomainModel(path.join(FIXTURE_ROOT, "model.yaml"));
    const codebase = await parseCodebase(path.join(FIXTURE_ROOT, "sample-repo"));
    const contractUsage = detectContractUsage(codebase, model);
    const leaks = detectBoundaryLeaks(codebase, model);

    expect(contractUsage.applicableReferences).toBe(2);
    expect(contractUsage.adherence).toBe(0.5);
    expect(leaks).toHaveLength(1);
  });

  test("computes MCCS and ELS through the command interface", async () => {
    repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );

    expect(response.status).toBe("ok");
    const metrics = (response.result as {
      metrics: Array<{ metricId: string; value: number }>;
    }).metrics;
    expect(metrics.find((metric) => metric.metricId === "MCCS")?.value).toBeLessThan(1);
    expect(metrics.find((metric) => metric.metricId === "ELS")?.value).toBeGreaterThanOrEqual(0);
  }, 20000);

  test("score.compute exposes persistence shadow data without changing ELS", async () => {
    repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const baseline = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );
    const shadowed = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "shadow-persistence": true
      },
      { cwd: process.cwd() }
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
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value
    );
  }, 20000);

  test("score.compute application pilot replaces ELS with persistence candidate", async () => {
    repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const baseline = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );
    const pilot = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "pilot-persistence": true,
        "rollout-category": "application",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH
      },
      { cwd: process.cwd() }
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
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value
    );
    expect(pilotResult.pilot?.persistenceCandidateValue).toBe(
      pilotResult.shadow?.localityModels.persistenceCandidate.localityScore
    );
    expect(pilotResult.pilot?.effectiveElsValue).toBe(pilotResult.pilot?.persistenceCandidateValue);
    expect(pilotResult.metrics.find((metric) => metric.metricId === "ELS")?.value).toBe(
      pilotResult.pilot?.persistenceCandidateValue
    );
  }, 20000);

  test("score.compute tooling pilot keeps ELS as the source of truth", async () => {
    repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const baseline = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );
    const pilot = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        "pilot-persistence": true,
        "rollout-category": "tooling",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH
      },
      { cwd: process.cwd() }
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
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value
    );
    expect(pilotResult.pilot?.effectiveElsValue).toBe(pilotResult.pilot?.baselineElsValue);
    expect(pilotResult.metrics.find((metric) => metric.metricId === "ELS")?.value).toBe(
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value
    );
  }, 20000);

  test("history.score_evolution_locality returns explicit confidence and unknowns for thin history", async () => {
    repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["history.score_evolution_locality"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml")
      },
      { cwd: process.cwd() }
    );

    expect(response.confidence).toBeLessThan(1);
    expect(response.unknowns.some((entry) => entry.includes("thin"))).toBe(true);
  }, 20000);

  test("history.analyze_persistence returns co-change topology summary", async () => {
    repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["history.analyze_persistence"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml")
      },
      { cwd: process.cwd() }
    );

    expect(response.status).toBe("ok");
    expect(response.confidence).toBeLessThan(1);

    const result = response.result as {
      relevantCommitCount: number;
      contextsSeen: string[];
      pairWeights: Array<{ rawCount: number; jaccard: number }>;
      stableChangeClusters: Array<{ contexts: string[]; stability: number }>;
      naturalSplitLevels: number[];
      noiseRatio: number;
    };

    expect(result.relevantCommitCount).toBeGreaterThan(0);
    expect(result.contextsSeen).toHaveLength(2);
    expect(result.pairWeights[0]?.rawCount).toBeGreaterThan(0);
    expect(result.pairWeights[0]?.jaccard).toBeGreaterThan(0);
    expect(result.stableChangeClusters[0]?.contexts).toEqual(expect.arrayContaining(["Billing", "Fulfillment"]));
    expect(result.naturalSplitLevels[0]).toBeGreaterThan(0);
    expect(result.noiseRatio).toBeGreaterThanOrEqual(0);
  }, 20000);

  test("history.compare_locality_models returns ELS and persistence candidate side by side", async () => {
    repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["history.compare_locality_models"]!(
      {
        repo: repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml")
      },
      { cwd: process.cwd() }
    );

    expect(response.status).toBe("ok");
    expect(response.confidence).toBeLessThan(1);

    const result = response.result as {
      els: {
        score: number;
        components: { CCL: number; FS: number; SCR: number };
      };
      persistenceCandidate: {
        localityScore: number;
        persistentCouplingPenalty: number;
      };
      persistenceAnalysis: {
        pairWeights: Array<{ rawCount: number; jaccard: number }>;
      };
      delta: number;
    };

    expect(result.els.score).toBeGreaterThanOrEqual(0);
    expect(result.persistenceCandidate.localityScore).toBeGreaterThanOrEqual(0);
    expect(result.persistenceCandidate.persistentCouplingPenalty).toBeGreaterThanOrEqual(0);
    expect(result.persistenceAnalysis.pairWeights[0]?.jaccard).toBeGreaterThan(0);
    expect(Number.isFinite(result.delta)).toBe(true);
  }, 20000);
});
