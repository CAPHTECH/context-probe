import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { FIXTURE_ROOT, SHADOW_ROLLOUT_REGISTRY_PATH } from "./domain-design.helpers.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

export function registerDomainDesignPersistencePilotMetricTests(state: DomainDesignTestState): void {
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
