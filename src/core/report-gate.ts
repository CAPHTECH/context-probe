import type { MetricGateDecision, PolicyConfig } from "./contracts.js";
import { getDomainPolicy } from "./policy.js";
import { dedupe, type GateResponse, proxyOrPartialUnknowns } from "./report-shared.js";

export function evaluateGate(
  response: GateResponse,
  policyConfig: PolicyConfig,
  profileName: string,
): MetricGateDecision {
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
        `architecture metrics include proxy/partial decision material: ${dedupe(partialMetrics).join(", ")}`,
      );
    }
  }

  const measurementQuality = response.meta?.measurementQuality;
  if (measurementQuality) {
    if (measurementQuality.unknownsCount > 0) {
      warnings.push(`measurement quality includes ${measurementQuality.unknownsCount} unknown signal(s)`);
    }
    if (measurementQuality.proxyMetrics.length > 0) {
      warnings.push(`measurement quality depends on proxy material in ${measurementQuality.proxyMetrics.join(", ")}`);
    }
  }

  return {
    status: failures.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    failures,
    warnings,
  };
}
