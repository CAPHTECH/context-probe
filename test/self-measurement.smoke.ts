import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import {
  BOUNDARY_MAP_ENTRY,
  COMPLEXITY_EXPORT_ENTRY,
  CONTRACT_BASELINE_ENTRY,
  DELIVERY_OBSERVATIONS_ENTRY,
  MODEL_ENTRY,
  PATTERN_RUNTIME_OBSERVATIONS_ENTRY,
  POLICY_PATH,
  PROJECT_ENTRIES,
  RUNTIME_OBSERVATIONS_ENTRY,
  SCENARIO_CATALOG_ENTRY,
  SCENARIO_OBSERVATIONS_ENTRY,
  TELEMETRY_OBSERVATIONS_ENTRY,
  TOPOLOGY_ENTRY,
} from "./self-measurement.shared.js";

export function registerSelfMeasurementSmokeTests(state: { repoPath?: string }): void {
  test("computes domain and architecture scores for a git-backed copy of the project", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;
    await initializeTemporaryGitRepo(repoPath, "feat: bootstrap self measurement");

    const domainResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    expect(domainResponse.status).not.toBe("error");
    const domainResult = domainResponse.result as {
      metrics: Array<{ metricId: string }>;
      crossContextReferences: number;
      history: unknown;
    };
    expect(domainResult.metrics.map((metric) => metric.metricId)).toEqual(expect.arrayContaining(["MCCS", "ELS"]));
    expect(domainResult.crossContextReferences).toBeGreaterThan(0);
    expect(domainResult.history).not.toBeNull();
    expect(domainResponse.unknowns).toContain("Git history is still thin, so ELS is provisional.");

    const architectureResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        constraints: path.join(repoPath, "config/self-measurement/architecture-constraints.yaml"),
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": path.join(repoPath, COMPLEXITY_EXPORT_ENTRY),
        "boundary-map": path.join(repoPath, BOUNDARY_MAP_ENTRY),
        "contract-baseline": path.join(repoPath, CONTRACT_BASELINE_ENTRY),
        "scenario-catalog": path.join(repoPath, SCENARIO_CATALOG_ENTRY),
        "scenario-observations": path.join(repoPath, SCENARIO_OBSERVATIONS_ENTRY),
        "topology-model": path.join(repoPath, TOPOLOGY_ENTRY),
        "runtime-observations": path.join(repoPath, RUNTIME_OBSERVATIONS_ENTRY),
        "telemetry-observations": path.join(repoPath, TELEMETRY_OBSERVATIONS_ENTRY),
        "pattern-runtime-observations": path.join(repoPath, PATTERN_RUNTIME_OBSERVATIONS_ENTRY),
        "delivery-observations": path.join(repoPath, DELIVERY_OBSERVATIONS_ENTRY),
      },
      { cwd: process.cwd() },
    );

    expect(architectureResponse.status).not.toBe("error");
    const architectureResult = architectureResponse.result as {
      metrics: Array<{ metricId: string }>;
      violations: unknown[];
    };
    expect(architectureResult.metrics.map((metric) => metric.metricId)).toEqual(
      expect.arrayContaining(["QSF", "DDS", "BPS", "IPS", "TIS", "OAS", "CTI", "AELS", "EES", "APSI"]),
    );
    expect(Array.isArray(architectureResult.violations)).toBe(true);
    expect(architectureResponse.confidence).toBeGreaterThan(0.7);
    expect(architectureResponse.unknowns).not.toContain("No scenario catalog was provided, so QSF is unobserved.");
    expect(architectureResponse.unknowns).not.toContain(
      "No topology model was provided, so TIS is close to unobserved.",
    );
    expect(architectureResponse.unknowns).not.toContain(
      "No telemetry observations were provided, so CommonOps is using the neutral value 0.5.",
    );
    expect(architectureResponse.unknowns).not.toContain(
      "No pattern runtime observations were provided, so PatternRuntime is using the TIS bridge.",
    );
    expect(architectureResponse.unknowns).not.toContain(
      "No delivery observations were provided, so Delivery is using the neutral value 0.5.",
    );
    expect(architectureResponse.unknowns).not.toContain(
      "No boundary map was provided, so AELS is using constraint layers as a boundary proxy.",
    );
    expect(architectureResponse.unknowns).not.toContain(
      "RunCostPerBusinessTransaction cannot be approximated because runCostPerBusinessTransaction is missing.",
    );
    expect(architectureResponse.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
    expect(architectureResponse.unknowns).not.toContain("PCS is a proxy composite of DDS, BPS, and IPS.");
    expect(
      architectureResponse.evidence.some((entry) =>
        entry.statement.includes("src/analyzers/architecture-contracts.ts"),
      ),
    ).toBe(false);
    expect(architectureResponse.provenance.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        path.join(repoPath, COMPLEXITY_EXPORT_ENTRY),
        path.join(repoPath, BOUNDARY_MAP_ENTRY),
        path.join(repoPath, CONTRACT_BASELINE_ENTRY),
        path.join(repoPath, SCENARIO_CATALOG_ENTRY),
        path.join(repoPath, SCENARIO_OBSERVATIONS_ENTRY),
        path.join(repoPath, TOPOLOGY_ENTRY),
        path.join(repoPath, RUNTIME_OBSERVATIONS_ENTRY),
        path.join(repoPath, TELEMETRY_OBSERVATIONS_ENTRY),
        path.join(repoPath, PATTERN_RUNTIME_OBSERVATIONS_ENTRY),
        path.join(repoPath, DELIVERY_OBSERVATIONS_ENTRY),
      ]),
    );
  }, 20000);
}
