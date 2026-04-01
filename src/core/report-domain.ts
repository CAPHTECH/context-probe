import type { DomainDesignPilotAnalysis } from "./contracts.js";
import {
  renderActionQueueSection,
  renderMeasurementQualitySection,
  renderSuggestedNextEvidenceSection,
} from "./report-actionability.js";
import { formatMetric, type ReportResponse, renderMetricGuidanceSection } from "./report-shared.js";

function renderPilotRolloutSection(pilot: DomainDesignPilotAnalysis | undefined): string[] {
  if (!pilot) {
    return [];
  }

  const overallReasons = pilot.overallGate.reasons.length > 0 ? pilot.overallGate.reasons.join(", ") : "none";
  const categoryReasons = pilot.categoryGate.reasons.length > 0 ? pilot.categoryGate.reasons.join(", ") : "none";

  return [
    "",
    "## Pilot Rollout",
    `- Category: ${pilot.category}`,
    `- Applied: ${pilot.applied ? "yes" : "no"}`,
    `- Locality Source: ${pilot.localitySource}`,
    `- Baseline ELS: ${pilot.baselineElsValue.toFixed(3)}`,
    `- Persistence Candidate: ${pilot.persistenceCandidateValue.toFixed(3)}`,
    `- Effective ELS: ${pilot.effectiveElsValue.toFixed(3)}`,
    `- Overall Gate: ${pilot.overallGate.rolloutDisposition} (${pilot.overallGate.replacementVerdict})`,
    `- Overall Reasons: ${overallReasons}`,
    `- Category Gate: ${pilot.categoryGate.rolloutDisposition} (${pilot.categoryGate.replacementVerdict})`,
    `- Category Reasons: ${categoryReasons}`,
  ];
}

export function renderDomainMarkdownReport(response: ReportResponse): string {
  const lines = ["# Measurement Report", ""];
  lines.push(`- Domain: ${response.result.domainId}`);
  lines.push(`- Status: ${response.status}`);
  lines.push(`- Confidence: ${response.confidence.toFixed(3)}`);
  lines.push("");
  lines.push(...renderMeasurementQualitySection(response));
  lines.push("## Metrics");
  lines.push(...response.result.metrics.map(formatMetric));
  lines.push(...renderPilotRolloutSection(response.result.pilot));
  lines.push(...renderMetricGuidanceSection(response.result.metrics));
  lines.push(...renderSuggestedNextEvidenceSection(response));
  lines.push(...renderActionQueueSection(response));

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
