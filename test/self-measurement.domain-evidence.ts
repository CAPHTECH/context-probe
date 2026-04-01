import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import { getMetric, POLICY_PATH } from "./scaffold.helpers.js";
import { MODEL_ENTRY, PROJECT_ENTRIES } from "./self-measurement.shared.js";

const PROJECT_ENTRIES_WITH_DOCS = [...PROJECT_ENTRIES, "docs"];
const AGGREGATE_PROXY_UNKNOWN = "No aggregate definitions were found, so context is being used as an aggregate proxy.";
const DRF_BASELINE = 0.2739763239875389;
const AFS_BASELINE = 0.5700000000000001;

export function registerSelfMeasurementDomainEvidenceTests(state: { repoPath?: string }): void {
  test("self-measurement domain scoring uses explicit aggregates and keeps the proxy unknown out", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES_WITH_DOCS);
    state.repoPath = repoPath;
    await initializeTemporaryGitRepo(repoPath, "feat: bootstrap self measurement domain evidence");

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": path.join(repoPath, "docs"),
      },
      { cwd: process.cwd() },
    );

    expect(response.status).not.toBe("error");
    const result = response.result as {
      metrics: Array<{ metricId: string }>;
    };
    expect(result.metrics.map((metric) => metric.metricId)).toEqual(expect.arrayContaining(["DRF", "AFS"]));

    const drf = getMetric(response, "DRF");
    const afs = getMetric(response, "AFS");

    expect(drf.confidence).toBeGreaterThan(0.5);
    expect(afs.confidence).toBeGreaterThan(0.5);
    expect(drf.value).toBeGreaterThan(DRF_BASELINE);
    expect(afs.value).toBeGreaterThan(AFS_BASELINE);
    expect(response.unknowns).not.toContain(AGGREGATE_PROXY_UNKNOWN);
    expect(drf.unknowns).not.toContain(AGGREGATE_PROXY_UNKNOWN);
    expect(afs.unknowns).not.toContain(AGGREGATE_PROXY_UNKNOWN);
  }, 20000);
}
