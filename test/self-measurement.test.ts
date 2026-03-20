import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  cleanupTemporaryRepo,
  createTemporaryWorkspace,
  initializeTemporaryGitRepo
} from "./helpers.js";

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
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );

    expect(domainResponse.status).not.toBe("error");
    const domainResult = domainResponse.result as {
      metrics: Array<{ metricId: string }>;
      crossContextReferences: number;
      history: unknown;
    };
    expect(domainResult.metrics.map((metric) => metric.metricId)).toEqual(
      expect.arrayContaining(["MCCS", "ELS"])
    );
    expect(domainResult.crossContextReferences).toBeGreaterThan(0);
    expect(domainResult.history).not.toBeNull();
    expect(domainResponse.unknowns).toContain("Git履歴がまだ少ないため ELS は暫定値です");

    const architectureResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        constraints: path.join(repoPath, CONSTRAINTS_ENTRY),
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    expect(architectureResponse.status).not.toBe("error");
    const architectureResult = architectureResponse.result as {
      metrics: Array<{ metricId: string }>;
      violations: unknown[];
    };
    expect(architectureResult.metrics.map((metric) => metric.metricId)).toEqual(
      expect.arrayContaining(["QSF", "DDS", "BPS", "IPS", "CTI"])
    );
    expect(Array.isArray(architectureResult.violations)).toBe(true);
    expect(architectureResponse.unknowns).toContain("scenario catalog が指定されていないため QSF は未観測です");
  }, 20000);

  test("degrades gracefully when git metadata is absent", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );

    expect(response.status).toBe("warning");
    expect(response.diagnostics.some((entry) => entry.includes("履歴解析をスキップしました"))).toBe(true);
    expect(response.unknowns).toContain("履歴解析に必要なGit情報が不足しています");
  });
});
