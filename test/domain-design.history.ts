import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { FIXTURE_ROOT } from "./domain-design.helpers.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

export function registerDomainDesignHistoryTests(state: DomainDesignTestState): void {
  test("history.score_evolution_locality returns explicit confidence and unknowns for thin history", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["history.score_evolution_locality"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      { cwd: process.cwd() },
    );

    expect(response.confidence).toBeLessThan(1);
    expect(response.unknowns.some((entry) => entry.includes("thin"))).toBe(true);
  }, 20000);

  test("history.analyze_persistence returns co-change topology summary", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["history.analyze_persistence"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      { cwd: process.cwd() },
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
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["history.compare_locality_models"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      { cwd: process.cwd() },
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
}
