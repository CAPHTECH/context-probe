import path from "node:path";

import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { CommandResponse, MetricScore } from "../src/core/contracts.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const IPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ips/constraints.yaml");
const IPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/ips/good-repo");
const IPS_BASELINE_PATH = path.resolve("fixtures/examples/architecture-sources/contract-baseline.yaml");
const CTI_GOOD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-good-complexity.yaml");

function getMetric(response: CommandResponse<unknown>, metricId: string): MetricScore {
  const result = response.result as { metrics: MetricScore[] };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}

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

describe("architecture command integration", () => {
  test("report.generate preserves baseline-backed IPS and explicit complexity export inputs", async () => {
    const scoreResponse = await COMMANDS["score.compute"]!(architectureArgs(), { cwd: process.cwd() });
    const reportResponse = await COMMANDS["report.generate"]!(
      {
        ...architectureArgs(),
        format: "md",
      },
      { cwd: process.cwd() },
    );

    expect(reportResponse.status).toBe(scoreResponse.status);
    expect(reportResponse.unknowns).toEqual(scoreResponse.unknowns);
    expect(reportResponse.result).toEqual(
      expect.objectContaining({
        format: "md",
      }),
    );

    const report = (reportResponse.result as { report: string }).report;
    expect(report).toContain("## Architecture Summary");
    expect(report).toContain("- IPS:");
    expect(report).toContain("- CTI:");
    expect(report).not.toContain("CBC/BCR are current-state contract-stability proxies, not baseline deltas.");
    expect(report).not.toContain("RunCostPerBusinessTransaction cannot be approximated from code");
  });

  test("gate.evaluate uses the same IPS and CTI inputs as score.compute", async () => {
    const scoreResponse = await COMMANDS["score.compute"]!(architectureArgs(), { cwd: process.cwd() });
    const gateResponse = await COMMANDS["gate.evaluate"]!(architectureArgs(), { cwd: process.cwd() });

    const gateResult = gateResponse.result as {
      gate: { status: "ok" | "warning" | "error"; failures: string[]; warnings: string[] };
      metrics: MetricScore[];
    };

    expect(gateResponse.status).toBe(gateResult.gate.status);
    expect(gateResponse.unknowns).toEqual(scoreResponse.unknowns);

    const scoreIps = getMetric(scoreResponse, "IPS");
    const gateIps = getMetric(gateResponse, "IPS");
    const scoreCti = getMetric(scoreResponse, "CTI");
    const gateCti = getMetric(gateResponse, "CTI");

    expect(gateIps.value).toBeCloseTo(scoreIps.value, 10);
    expect(gateIps.components).toEqual(scoreIps.components);
    expect(gateCti.value).toBeCloseTo(scoreCti.value, 10);
    expect(gateCti.components).toEqual(scoreCti.components);
    expect(gateResult.gate.failures.length + gateResult.gate.warnings.length).toBeGreaterThan(0);
  });

  test("review.list_unknowns reflects that baseline and complexity inputs removed their specific unknowns", async () => {
    const response = await COMMANDS["review.list_unknowns"]!(architectureArgs(), { cwd: process.cwd() });
    const reviewItems = (response.result as { reviewItems: Array<{ summary: string }> }).reviewItems;
    const summaries = reviewItems.map((item) => item.summary);

    expect(response.status).toBe("warning");
    expect(summaries).not.toContain("CBC/BCR are current-state contract-stability proxies, not baseline deltas.");
    expect(summaries.some((entry) => entry.includes("RunCostPerBusinessTransaction cannot be approximated"))).toBe(
      false,
    );
    expect(summaries.some((entry) => entry.includes("QSF has low confidence"))).toBe(true);
  });
});
