import type { MetricScore } from "./contracts.js";

export function formatMetric(metric: MetricScore): string {
  const components = Object.entries(metric.components)
    .map(([key, value]) => `${key}=${value.toFixed(3)}`)
    .join(", ");
  return `- ${metric.metricId}: ${metric.value.toFixed(3)} [confidence=${metric.confidence.toFixed(3)}] (${components})`;
}
