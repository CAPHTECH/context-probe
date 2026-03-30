import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

import { FIXTURE_ROOT, SHADOW_ROLLOUT_REGISTRY_PATH } from "./domain-design.helpers.js";

export function registerDomainDesignPersistencePilotFallbackTests(): void {
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
}
