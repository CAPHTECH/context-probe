import type { CommandResponse, MetricScore, PolicyConfig } from "./contracts.js";
import { getDomainPolicy } from "./policy.js";

function formatMetric(metric: MetricScore): string {
  const components = Object.entries(metric.components)
    .map(([key, value]) => `${key}=${value.toFixed(3)}`)
    .join(", ");
  return `- ${metric.metricId}: ${metric.value.toFixed(3)} (${components})`;
}

export function renderMarkdownReport(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
    leakFindings?: unknown[];
    violations?: unknown[];
  }>
): string {
  const lines = ["# Measurement Report", ""];
  lines.push(`- Domain: ${response.result.domainId}`);
  lines.push(`- Status: ${response.status}`);
  lines.push(`- Confidence: ${response.confidence.toFixed(3)}`);
  lines.push("");
  lines.push("## Metrics");
  lines.push(...response.result.metrics.map(formatMetric));

  if (response.unknowns.length > 0) {
    lines.push("", "## Unknowns", ...response.unknowns.map((item) => `- ${item}`));
  }
  if (response.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", ...response.diagnostics.map((item) => `- ${item}`));
  }
  if (response.result.leakFindings && response.result.leakFindings.length > 0) {
    lines.push("", "## Boundary Leaks", `- Count: ${response.result.leakFindings.length}`);
  }
  if (response.result.violations && response.result.violations.length > 0) {
    lines.push("", "## Direction Violations", `- Count: ${response.result.violations.length}`);
  }

  return `${lines.join("\n")}\n`;
}

export function evaluateGate(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
  }>,
  policyConfig: PolicyConfig,
  profileName: string
) {
  const policy = getDomainPolicy(policyConfig, profileName, response.result.domainId);
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const metric of response.result.metrics) {
    const thresholds = policy.metrics[metric.metricId]?.thresholds;
    if (!thresholds) {
      continue;
    }
    if (thresholds.fail !== undefined && metric.value < thresholds.fail) {
      failures.push(`${metric.metricId}=${metric.value.toFixed(3)} < fail(${thresholds.fail})`);
      continue;
    }
    if (thresholds.warn !== undefined && metric.value < thresholds.warn) {
      warnings.push(`${metric.metricId}=${metric.value.toFixed(3)} < warn(${thresholds.warn})`);
    }
  }

  return {
    status: failures.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    failures,
    warnings
  } as const;
}
