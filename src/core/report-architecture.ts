import type { MetricScore } from "./contracts.js";
import {
  renderActionQueueSection,
  renderMeasurementQualitySection,
  renderSuggestedNextEvidenceSection,
} from "./report-actionability.js";
import {
  dedupe,
  formatMetric,
  proxyOrPartialUnknowns,
  type ReportResponse,
  renderMetricGuidanceSection,
} from "./report-shared.js";

function architectureMetricMap(metrics: MetricScore[]): Map<string, MetricScore> {
  return new Map(metrics.map((metric) => [metric.metricId, metric]));
}

function detectPolicyProfile(response: ReportResponse, explicitProfileName?: string): string | undefined {
  if (explicitProfileName) {
    return explicitProfileName;
  }
  const profileEntry = response.provenance.find((entry) => entry.note?.startsWith("profile="));
  return profileEntry?.note?.slice("profile=".length);
}

export function renderArchitectureMarkdownReport(response: ReportResponse, profileName?: string): string {
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
      proxyOrPartialUnknowns(metric).map((entry) => `${metric.metricId}: ${entry}`),
    ),
  );
  const activeProfile = detectPolicyProfile(response, profileName);

  lines.push(`- Domain: ${response.result.domainId}`);
  lines.push(`- Status: ${response.status}`);
  lines.push(`- Confidence: ${response.confidence.toFixed(3)}`);
  if (activeProfile) {
    lines.push(`- Policy Profile: ${activeProfile}`);
  }
  lines.push("");
  lines.push(...renderMeasurementQualitySection(response));
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

  lines.push(
    ...renderMetricGuidanceSection([...(summaryMetric ? [summaryMetric] : []), ...supportingMetrics, ...bridgeMetrics]),
  );

  if (response.result.scenarioQuality) {
    lines.push("", "## Scenario Quality");
    lines.push(
      `- Observed Scenarios: ${response.result.scenarioQuality.observedScenarios}/${response.result.scenarioQuality.totalScenarios}`,
    );
    if (response.result.scenarioQuality.missingTopPriorityObservationIds.length > 0) {
      lines.push(
        `- Missing Top-Priority Observations: ${response.result.scenarioQuality.missingTopPriorityObservationIds.join(", ")}`,
      );
    }
    if (response.result.scenarioQuality.duplicateScenarioIds.length > 0) {
      lines.push(`- Duplicate Scenario Intent: ${response.result.scenarioQuality.duplicateScenarioIds.join(", ")}`);
    }
    lines.push(...response.result.scenarioQuality.findings.map((item) => `- ${item}`));
  }

  if (response.result.localityWatchlist && response.result.localityWatchlist.length > 0) {
    lines.push("", "## Locality Watchlist");
    lines.push(
      ...response.result.localityWatchlist.map(
        (item) =>
          `- ${item.boundaries.join(" <-> ")}: ${item.count} commits${item.sampleCommitHashes.length > 0 ? ` (${item.sampleCommitHashes.join(", ")})` : ""}`,
      ),
    );
  }

  if (proxySignals.length > 0) {
    lines.push("", "## Proxy / Partial Signals", ...proxySignals.map((item) => `- ${item}`));
  }

  lines.push(...renderSuggestedNextEvidenceSection(response));
  lines.push(...renderActionQueueSection(response));

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
