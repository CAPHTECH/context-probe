import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../src/analyzers/code.js";
import { loadDomainModel } from "../src/core/model.js";
import { cleanupTemporaryRepo, createTemporaryGitRepoFromFixture } from "./helpers.js";

const FIXTURE_ROOT = path.resolve("fixtures/domain-design");

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
});
