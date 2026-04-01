import { buildSuggestedNextEvidence, isApproximationNote, isMissingInputNote } from "./measurement-metadata.js";
import type { ReportResponse } from "./report-shared-predicates.js";

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function renderMeasurementQualitySection(response: ReportResponse): string[] {
  const measurementQuality = response.meta?.measurementQuality;
  if (!measurementQuality) {
    return [];
  }
  const lines = ["", "## Measurement Quality"];
  lines.push(`- Decision Risk: ${measurementQuality.decisionRisk}`);
  lines.push(`- Unknown Count: ${measurementQuality.unknownsCount}`);
  lines.push(
    `- Proxy Metrics: ${measurementQuality.proxyMetrics.length > 0 ? measurementQuality.proxyMetrics.join(", ") : "none"}`,
  );
  lines.push(`- Proxy Rate: ${measurementQuality.proxyRate.toFixed(3)}`);
  if (measurementQuality.approximationNotes.length > 0) {
    lines.push(...measurementQuality.approximationNotes.map((entry) => `- Approximation: ${entry}`));
  }
  return lines;
}

export function renderSuggestedNextEvidenceSection(response: ReportResponse): string[] {
  const suggestions = buildSuggestedNextEvidence(response);
  if (suggestions.length === 0) {
    return [];
  }
  return ["", "## Suggested Next Evidence", ...suggestions.map((entry) => `- ${entry}`)];
}

function buildActionQueue(response: ReportResponse): string[] {
  const actions: string[] = [];
  if (response.result.scenarioQuality?.missingTopPriorityObservationIds.length) {
    actions.push(
      `Add observations for top-priority scenarios: ${response.result.scenarioQuality.missingTopPriorityObservationIds.join(", ")}`,
    );
  }
  if (response.result.localityWatchlist && response.result.localityWatchlist.length > 0) {
    const hotspot = response.result.localityWatchlist[0];
    if (hotspot) {
      actions.push(
        `Review recurring co-change hotspot: ${hotspot.boundaries.join(" <-> ")} (${hotspot.count} commits)`,
      );
    }
  }
  if (response.meta?.measurementQuality?.proxyMetrics.length) {
    actions.push(
      `Reduce proxy dependence in ${response.meta.measurementQuality.proxyMetrics.join(", ")} by adding stronger evidence inputs`,
    );
  }
  const missingInputUnknown = response.unknowns.find(isMissingInputNote);
  if (missingInputUnknown) {
    actions.push(`Resolve missing or thin evidence: ${missingInputUnknown}`);
  }
  const approximationUnknown = response.unknowns.find(isApproximationNote);
  if (approximationUnknown) {
    actions.push(`Replace approximation with observed evidence: ${approximationUnknown}`);
  }
  return uniq(actions).slice(0, 5);
}

export function renderActionQueueSection(response: ReportResponse): string[] {
  const actions = buildActionQueue(response);
  if (actions.length === 0) {
    return [];
  }
  return ["", "## Action Queue", ...actions.map((entry) => `- ${entry}`)];
}
