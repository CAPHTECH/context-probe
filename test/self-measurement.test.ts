import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { parseCodebase } from "../src/analyzers/code.js";
import { classifyArchitectureLayer, collectContractFilePaths } from "../src/analyzers/contract-files.js";
import { COMMANDS } from "../src/commands.js";
import { loadArchitectureConstraints } from "../src/core/model.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const MODEL_ENTRY = "config/self-measurement/domain-model.yaml";
const CONSTRAINTS_ENTRY = "config/self-measurement/architecture-constraints.yaml";
const COMPLEXITY_EXPORT_ENTRY = "config/self-measurement/architecture-complexity-export.yaml";
const BOUNDARY_MAP_ENTRY = "config/self-measurement/architecture-boundary-map.yaml";
const CONTRACT_BASELINE_ENTRY = "config/self-measurement/architecture-contract-baseline.yaml";
const SCENARIO_CATALOG_ENTRY = "config/self-measurement/architecture-scenarios.yaml";
const SCENARIO_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-scenario-observations.yaml";
const TOPOLOGY_ENTRY = "config/self-measurement/architecture-topology.yaml";
const RUNTIME_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-runtime-observations.yaml";
const TELEMETRY_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-telemetry-observations.yaml";
const PATTERN_RUNTIME_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-pattern-runtime-observations.yaml";
const DELIVERY_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-delivery-observations.yaml";
const PROJECT_ENTRIES = ["src", "config/self-measurement"];

describe("self measurement", () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupTemporaryRepo(repoPath);
      repoPath = undefined;
    }
  });

  test("computes domain and architecture scores for a git-backed copy of the project", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
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
        constraints: path.join(repoPath, CONSTRAINTS_ENTRY),
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
    expect(architectureResponse.unknowns).toContain("PCS is a proxy composite of DDS, BPS, and IPS.");
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

  test("self-measurement architecture constraints classify all src files and isolate the explicit contract layer", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);

    const constraints = await loadArchitectureConstraints(path.join(repoPath, CONSTRAINTS_ENTRY));
    const codebase = await parseCodebase(repoPath);
    const unclassifiedSrc = codebase.scorableSourceFiles
      .filter((filePath) => filePath.startsWith("src/") && !classifyArchitectureLayer(filePath, constraints))
      .sort();
    const contractPaths = collectContractFilePaths({
      codebase,
      constraints,
      allowDartDomainFallback: true,
    }).sort();

    expect(unclassifiedSrc).toEqual([]);
    expect(contractPaths).toEqual(["src/core/contracts.ts"]);
  });

  test("degrades gracefully when git metadata is absent", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    expect(response.diagnostics.some((entry) => entry.includes("Skipped history analysis"))).toBe(true);
    expect(response.unknowns).toContain("Git information required for history analysis is missing.");
  });
});
