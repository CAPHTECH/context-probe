import { describe, expect, test } from "vitest";

import { summarizeArchitectureScenarioQuality } from "../src/core/architecture-scenario-quality.js";

describe("architecture scenario quality", () => {
  test("summarizes missing top-priority observations and duplicate intent", () => {
    const summary = summarizeArchitectureScenarioQuality({
      catalog: {
        version: "1.0",
        scenarios: [
          {
            scenarioId: "S-001",
            name: "Score latency",
            direction: "lower_is_better",
            priority: 5,
            target: 1,
            worstAcceptable: 5,
            responseMeasure: { metric: "score.compute duration" },
          },
          {
            scenarioId: "S-002",
            name: "Score latency",
            direction: "lower_is_better",
            priority: 4,
            target: 1,
            worstAcceptable: 5,
            responseMeasure: { metric: "score.compute duration" },
          },
        ],
      },
      observations: {
        version: "1.0",
        observations: [],
      },
    });

    expect(summary?.missingTopPriorityObservationIds).toEqual(["S-001", "S-002"]);
    expect(summary?.duplicateScenarioIds).toEqual(["S-001", "S-002"]);
    expect(summary?.findings.join("\n")).toContain("Top-priority scenarios are missing observations");
  });
});
