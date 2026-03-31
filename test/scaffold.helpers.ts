import path from "node:path";

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const AFS_GOOD_ENTRY = "fixtures/validation/scoring/afs/good";
export const SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY = "fixtures/validation/scaffold/generic-role-split";
export const SCAFFOLD_AUTODISCOVERY_DOCS_ROOT = path.resolve(
  "fixtures/validation/scaffold/docs-root-autodiscovery/docs",
);

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
