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
    expect(architectureResponse.unknowns).toContain("No scenario catalog was provided, so QSF is unobserved.");
    expect(architectureResponse.unknowns).toContain("No topology model was provided, so TIS is close to unobserved.");
    expect(architectureResponse.unknowns).toContain(
      "No telemetry observations were provided, so CommonOps is using the neutral value 0.5.",
    );
    expect(architectureResponse.unknowns).toContain(
      "No pattern runtime observations were provided, so PatternRuntime is using the TIS bridge.",
    );
    expect(architectureResponse.unknowns).toContain(
      "No delivery observations were provided, so Delivery is using the neutral value 0.5.",
    );
    expect(architectureResponse.unknowns).toContain("PCS is a proxy composite of DDS, BPS, and IPS.");
    expect(
      architectureResponse.evidence.some((entry) =>
        entry.statement.includes("src/analyzers/architecture-contracts.ts"),
      ),
    ).toBe(false);
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
