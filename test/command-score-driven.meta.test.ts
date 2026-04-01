import path from "node:path";

import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const IPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ips/constraints.yaml");
const IPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/ips/good-repo");
const IPS_BASELINE_PATH = path.resolve("fixtures/examples/architecture-sources/contract-baseline.yaml");
const CTI_GOOD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-good-complexity.yaml");

function architectureArgs() {
  return {
    repo: IPS_GOOD_REPO,
    constraints: IPS_CONSTRAINTS_PATH,
    policy: POLICY_PATH,
    domain: "architecture_design",
    "contract-baseline": IPS_BASELINE_PATH,
    "complexity-export": CTI_GOOD_EXPORT_PATH,
  } as const;
}

describe("score-driven metadata", () => {
  test("reuses measurement-quality metadata across score/report/gate/review flows", async () => {
    const scoreResponse = await COMMANDS["score.compute"]!(architectureArgs(), { cwd: process.cwd() });
    const reportResponse = await COMMANDS["report.generate"]!(
      {
        ...architectureArgs(),
        format: "md",
      },
      { cwd: process.cwd() },
    );
    const gateResponse = await COMMANDS["gate.evaluate"]!(architectureArgs(), { cwd: process.cwd() });
    const reviewResponse = await COMMANDS["review.list_unknowns"]!(architectureArgs(), { cwd: process.cwd() });

    expect(reportResponse.meta?.measurementQuality).toEqual(scoreResponse.meta?.measurementQuality);
    expect(gateResponse.meta?.measurementQuality).toEqual(scoreResponse.meta?.measurementQuality);
    expect(reviewResponse.meta?.measurementQuality).toEqual(scoreResponse.meta?.measurementQuality);
    expect(scoreResponse.meta?.runtime?.stages.inputLoadMs).toBeGreaterThanOrEqual(0);
    expect(reportResponse.meta?.runtime?.stages.renderMs).toBeGreaterThanOrEqual(0);
    expect(gateResponse.meta?.runtime?.stages.gateMs).toBeGreaterThanOrEqual(0);
    expect(reviewResponse.meta?.runtime?.stages.reviewMs).toBeGreaterThanOrEqual(0);
  });
});
