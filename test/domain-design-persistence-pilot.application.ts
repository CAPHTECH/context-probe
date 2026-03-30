import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { FIXTURE_ROOT, SHADOW_ROLLOUT_REGISTRY_PATH } from "./domain-design.helpers.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

export function registerDomainDesignPersistencePilotApplicationTests(state: DomainDesignTestState): void {
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
}
