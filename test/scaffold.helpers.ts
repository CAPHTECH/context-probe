import path from "node:path";

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const AFS_GOOD_ENTRY = "fixtures/validation/scoring/afs/good";

type ScoreComputeCommand = typeof import("../src/commands.js").COMMANDS["score.compute"];

export function getMetric(response: Awaited<ReturnType<NonNullable<ScoreComputeCommand>>>, metricId: string) {
  const result = response.result as {
    metrics: Array<{
      metricId: string;
      value: number;
      components: Record<string, number>;
      confidence: number;
      unknowns: string[];
    }>;
  };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}
