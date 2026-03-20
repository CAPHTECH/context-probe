import type { CommandResponse, MetricScore, PolicyConfig } from "./contracts.js";
import { getDomainPolicy } from "./policy.js";

function formatMetric(metric: MetricScore): string {
  const components = Object.entries(metric.components)
    .map(([key, value]) => `${key}=${value.toFixed(3)}`)
    .join(", ");
  return `- ${metric.metricId}: ${metric.value.toFixed(3)} [confidence=${metric.confidence.toFixed(3)}] (${components})`;
}

function isArchitectureDomain(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
  }>
): boolean {
  return response.result.domainId === "architecture_design";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function architectureMetricMap(metrics: MetricScore[]): Map<string, MetricScore> {
  return new Map(metrics.map((metric) => [metric.metricId, metric]));
}

function proxyOrPartialUnknowns(metric: MetricScore): string[] {
  return metric.unknowns.filter((entry) => /(proxy|partial|bridge|中立値|未観測|近似)/iu.test(entry));
}

function renderArchitectureReport(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
    leakFindings?: unknown[];
    violations?: unknown[];
  }>
): string {
  const lines = ["# Measurement Report", ""];
  const metrics = architectureMetricMap(response.result.metrics);
  const summaryMetric = metrics.get("APSI");
  const supportingMetricIds = ["QSF", "DDS", "BPS", "IPS", "OAS", "EES", "CTI"];
  const bridgeMetricIds = ["TIS", "AELS"];
  const supportingMetrics = supportingMetricIds
    .map((metricId) => metrics.get(metricId))
    .filter((metric): metric is MetricScore => Boolean(metric));
  const bridgeMetrics = bridgeMetricIds
    .map((metricId) => metrics.get(metricId))
    .filter((metric): metric is MetricScore => Boolean(metric));
  const proxySignals = dedupe(
    response.result.metrics.flatMap((metric) =>
      proxyOrPartialUnknowns(metric).map((entry) => `${metric.metricId}: ${entry}`)
    )
  );

  lines.push(`- Domain: ${response.result.domainId}`);
  lines.push(`- Status: ${response.status}`);
  lines.push(`- Confidence: ${response.confidence.toFixed(3)}`);
  lines.push("");
  lines.push("## Architecture Summary");
  if (summaryMetric) {
    lines.push(formatMetric(summaryMetric));
    lines.push("- APSI is a summary-only metric. Always read the supporting metrics below.");
  } else {
    lines.push("- APSI is not available for this run.");
  }

  lines.push("", "## Supporting Metrics");
  lines.push(...supportingMetrics.map(formatMetric));

  if (bridgeMetrics.length > 0) {
    lines.push("", "## Bridge Metrics");
    lines.push(...bridgeMetrics.map(formatMetric));
  }

  if (proxySignals.length > 0) {
    lines.push("", "## Proxy / Partial Signals", ...proxySignals.map((item) => `- ${item}`));
  }

  if (response.unknowns.length > 0) {
    lines.push("", "## Unknowns", ...response.unknowns.map((item) => `- ${item}`));
  }
  if (response.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", ...response.diagnostics.map((item) => `- ${item}`));
  }
  if (response.result.violations && response.result.violations.length > 0) {
    lines.push("", "## Direction Violations", `- Count: ${response.result.violations.length}`);
  }

  return `${lines.join("\n")}\n`;
}

export function renderMarkdownReport(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
    leakFindings?: unknown[];
    violations?: unknown[];
  }>
): string {
  if (isArchitectureDomain(response)) {
    return renderArchitectureReport(response);
  }

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
  const architectureSummaryMetricIds = new Set(["APSI"]);
  const isArchitecture = response.result.domainId === "architecture_design";

  for (const metric of response.result.metrics) {
    const thresholds = policy.metrics[metric.metricId]?.thresholds;
    if (!thresholds) {
      continue;
    }
    if (isArchitecture && architectureSummaryMetricIds.has(metric.metricId)) {
      if (thresholds.fail !== undefined && metric.value < thresholds.fail) {
        warnings.push(`${metric.metricId}=${metric.value.toFixed(3)} < summary_fail(${thresholds.fail})`);
        continue;
      }
      if (thresholds.warn !== undefined && metric.value < thresholds.warn) {
        warnings.push(`${metric.metricId}=${metric.value.toFixed(3)} < summary_warn(${thresholds.warn})`);
      }
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

  if (isArchitecture) {
    const partialMetrics = response.result.metrics
      .filter((metric) => proxyOrPartialUnknowns(metric).length > 0)
      .map((metric) => metric.metricId);
    if (partialMetrics.length > 0) {
      warnings.push(
        `architecture metrics に proxy/partial な判定材料が含まれます: ${dedupe(partialMetrics).join(", ")}`
      );
    }
  }

  return {
    status: failures.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    failures,
    warnings
  } as const;
}
