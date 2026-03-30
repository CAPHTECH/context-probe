import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { FIXTURE_ROOT, SHADOW_ROLLOUT_REGISTRY_PATH } from "./domain-design.helpers.js";
import { createTemporaryGitRepoFromFixture } from "./helpers.js";

export function registerDomainDesignPersistenceReportingTests(state: DomainDesignTestState): void {
  test("report.generate surfaces application pilot rollout details in markdown", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["report.generate"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
        format: "md",
        "pilot-persistence": true,
        "rollout-category": "application",
        "shadow-rollout-registry": SHADOW_ROLLOUT_REGISTRY_PATH,
      },
      { cwd: process.cwd() },
    );

    const result = response.result as {
      format: string;
      report: string;
    };

    expect(result.format).toBe("md");
    expect(result.report).toContain("## Pilot Rollout");
    expect(result.report).toContain("- Category: application");
    expect(result.report).toContain("- Applied: yes");
    expect(result.report).toContain("- Locality Source: persistence_candidate");
    expect(result.report).toContain("- Overall Gate: shadow_only (no_go)");
    expect(result.report).toContain("- Category Gate: replace (go)");
  }, 20000);

  test("gate.evaluate returns application pilot metadata and diagnostics", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const response = await COMMANDS["gate.evaluate"]!(
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

    const result = response.result as {
      gate: { status: "ok" | "warning" | "error" };
      pilot?: {
        applied: boolean;
        localitySource: "els" | "persistence_candidate";
        baselineElsValue: number;
        persistenceCandidateValue: number;
        effectiveElsValue: number;
      };
    };

    expect(result.pilot?.applied).toBe(true);
    expect(result.pilot?.localitySource).toBe("persistence_candidate");
    expect(result.pilot?.effectiveElsValue).toBe(result.pilot?.persistenceCandidateValue);
    expect(response.diagnostics).toContain("Pilot locality source: persistence_candidate for category application.");
  }, 20000);

  test("gate.evaluate keeps tooling pilot status aligned with the baseline threshold result", async () => {
    state.repoPath = await createTemporaryGitRepoFromFixture(path.join(FIXTURE_ROOT, "sample-repo"));

    const baseline = await COMMANDS["gate.evaluate"]!(
      {
        repo: state.repoPath,
        model: path.join(FIXTURE_ROOT, "model.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const toolingPilot = await COMMANDS["gate.evaluate"]!(
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
      gate: { status: "ok" | "warning" | "error" };
      metrics: Array<{ metricId: string; value: number }>;
    };
    const toolingPilotResult = toolingPilot.result as {
      gate: { status: "ok" | "warning" | "error" };
      metrics: Array<{ metricId: string; value: number }>;
      pilot?: {
        applied: boolean;
        localitySource: "els" | "persistence_candidate";
        baselineElsValue: number;
        effectiveElsValue: number;
      };
    };

    expect(toolingPilotResult.pilot?.applied).toBe(false);
    expect(toolingPilotResult.pilot?.localitySource).toBe("els");
    expect(toolingPilotResult.pilot?.effectiveElsValue).toBe(toolingPilotResult.pilot?.baselineElsValue);
    expect(toolingPilotResult.gate.status).toBe(baselineResult.gate.status);
    expect(toolingPilotResult.metrics.find((metric) => metric.metricId === "ELS")?.value).toBe(
      baselineResult.metrics.find((metric) => metric.metricId === "ELS")?.value,
    );
    expect(toolingPilot.diagnostics).toContain("Pilot locality source: els for category tooling.");
  }, 20000);
}
