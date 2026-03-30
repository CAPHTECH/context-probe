import { expect, test } from "vitest";

import {
  COLLECTOR_COMPLEXITY_GOOD,
  COLLECTOR_DELIVERY_GOOD,
  COLLECTOR_SCENARIO_GOOD,
  COLLECTOR_SCENARIO_THIN,
  COLLECTOR_TELEMETRY_GOOD,
  COMPLEXITY_COLLECTOR,
  DELIVERY_COLLECTOR,
  runCollector,
  SCENARIO_COLLECTOR,
  TELEMETRY_COLLECTOR,
} from "./architecture-collector-scripts.helpers.js";

export function registerArchitectureCollectorGoldenTests(): void {
  test("telemetry collector emits canonical OAS export bundles", async () => {
    const output = await runCollector(TELEMETRY_COLLECTOR, COLLECTOR_TELEMETRY_GOOD);

    expect(output.version).toBe("1.0");
    expect(output.bands).toHaveLength(3);
    expect(output.bands[0]).toMatchObject({
      bandId: "low",
      trafficWeight: 0.2,
      latencyP95: 210,
    });
    expect(output.patternRuntime).toMatchObject({
      patternFamily: "microservices",
      serviceBasedRuntime: {
        PartialFailureContainmentScore: 0.9,
      },
    });
  });

  test("delivery collector emits canonical EES export bundles", async () => {
    const output = await runCollector(DELIVERY_COLLECTOR, COLLECTOR_DELIVERY_GOOD);

    expect(output.version).toBe("1.0");
    expect(output.measurements).toMatchObject({
      leadTime: 3,
      deployFrequency: 18,
      recoveryTime: 1.5,
      changeFailRate: 0.08,
      reworkRate: 0.06,
    });
  });

  test("complexity collector emits canonical CTI export bundles and computes pipelineCount", async () => {
    const output = await runCollector(COMPLEXITY_COLLECTOR, COLLECTOR_COMPLEXITY_GOOD);

    expect(output.version).toBe("1.0");
    expect(output.metrics).toMatchObject({
      teamCount: 2,
      deployableCount: 2,
      pipelineCount: 2,
      onCallSurface: 2,
      runCostPerBusinessTransaction: 1,
    });
  });

  test("scenario collector emits canonical QSF observation sets for benchmark and incident summaries", async () => {
    const benchmarkOutput = await runCollector(SCENARIO_COLLECTOR, COLLECTOR_SCENARIO_GOOD);
    const incidentOutput = await runCollector(SCENARIO_COLLECTOR, COLLECTOR_SCENARIO_THIN);

    expect(benchmarkOutput.observations).toHaveLength(3);
    expect(benchmarkOutput.observations[0]).toMatchObject({
      scenarioId: "S-001",
      observed: 280,
      source: "benchmark_summary",
    });
    expect(incidentOutput.observations).toHaveLength(1);
    expect(incidentOutput.observations[0]).toMatchObject({
      scenarioId: "S-001",
      source: "incident_review_summary",
    });
  });
}
