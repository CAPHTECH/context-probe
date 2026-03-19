import path from "node:path";

import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

describe("architecture direction scoring", () => {
  test("detects inward dependency violations and scores DDS", async () => {
    const response = await COMMANDS["score.compute"]!(
      {
        repo: path.resolve("fixtures/architecture/sample-repo"),
        constraints: path.resolve("fixtures/architecture/constraints.yaml"),
        policy: path.resolve("fixtures/policies/default.yaml"),
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    expect(response.status).toBe("ok");
    const result = response.result as {
      metrics: Array<{ metricId: string; value: number }>;
      violations: unknown[];
    };
    expect(result.violations).toHaveLength(1);
    expect(result.metrics[0]?.metricId).toBe("DDS");
    expect(result.metrics[0]?.value).toBeLessThan(1);
  });
});
