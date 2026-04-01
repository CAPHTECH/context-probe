import type {
  CommandResponse,
  DecisionRiskLevel,
  MeasurementQualitySummary,
  MetricScore,
  ReviewItem,
  ReviewItemKind,
  RuntimeSummary,
} from "./contracts.js";

const APPROXIMATION_PATTERN = /(proxy|partial|bridge|neutral|unobserved|approx)/iu;
const MISSING_INPUT_PATTERN =
  /\b(no |missing|not provided|did not complete|cannot be approximated|cannot be mapped|too few)\b/iu;
const HISTORY_HOTSPOT_PATTERN = /\b(cross-boundary|co-change|history hotspot|wide review|locality)\b/iu;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function isApproximationNote(entry: string): boolean {
  return APPROXIMATION_PATTERN.test(entry);
}

export function isMissingInputNote(entry: string): boolean {
  return MISSING_INPUT_PATTERN.test(entry);
}

function isHistoryHotspotNote(entry: string): boolean {
  return HISTORY_HOTSPOT_PATTERN.test(entry);
}

function inferDecisionRisk(input: { confidence: number; unknownsCount: number; proxyRate: number }): DecisionRiskLevel {
  const { confidence, unknownsCount, proxyRate } = input;
  if (confidence < 0.65 || unknownsCount >= 4 || proxyRate >= 0.4) {
    return "high";
  }
  if (confidence < 0.8 || unknownsCount > 0 || proxyRate > 0) {
    return "medium";
  }
  return "low";
}

export function buildMeasurementQualitySummary(input: {
  metrics: MetricScore[];
  unknowns: string[];
  confidence: number;
}): MeasurementQualitySummary {
  const metricUnknownCounts = Object.fromEntries(
    input.metrics.map((metric) => [metric.metricId, metric.unknowns.length]),
  );
  const proxyMetrics = dedupe(
    input.metrics.filter((metric) => metric.unknowns.some(isApproximationNote)).map((metric) => metric.metricId),
  );
  const approximationNotes = dedupe([
    ...input.unknowns.filter(isApproximationNote),
    ...input.metrics.flatMap((metric) => metric.unknowns.filter(isApproximationNote)),
  ]);
  const proxyRate = input.metrics.length === 0 ? 0 : proxyMetrics.length / input.metrics.length;
  const unknownsCount = input.unknowns.length + input.metrics.reduce((sum, metric) => sum + metric.unknowns.length, 0);

  return {
    unknownsCount,
    metricUnknownCounts,
    proxyMetrics,
    proxyRate,
    approximationNotes,
    decisionRisk: inferDecisionRisk({
      confidence: input.confidence,
      unknownsCount,
      proxyRate,
    }),
  };
}

export function maybeBuildMeasurementQualitySummary(
  result: unknown,
  unknowns: string[],
  confidence: number,
): MeasurementQualitySummary | undefined {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }
  const metrics = (result as { metrics?: unknown }).metrics;
  if (!Array.isArray(metrics)) {
    return undefined;
  }
  return buildMeasurementQualitySummary({
    metrics: metrics as MetricScore[],
    unknowns,
    confidence,
  });
}

export function mergeRuntimeSummary(
  base: RuntimeSummary | undefined,
  additions: Partial<RuntimeSummary>,
): RuntimeSummary {
  const stages = {
    ...(base?.stages ?? {}),
    ...(additions.stages ?? {}),
  };
  const totalMs =
    additions.totalMs ?? base?.totalMs ?? Object.values(stages).reduce((sum, value) => sum + (value ?? 0), 0);
  return {
    totalMs,
    stages,
  };
}

export function classifyReviewItemKind(summary: string, reason: string): ReviewItemKind {
  if (reason === "low_confidence") {
    return "low_confidence";
  }
  if (reason === "collision") {
    return "collision";
  }
  if (isApproximationNote(summary)) {
    return "proxy";
  }
  if (isMissingInputNote(summary)) {
    return "missing_input";
  }
  if (isHistoryHotspotNote(summary)) {
    return "history_hotspot";
  }
  return "unknown";
}

function reviewItemPriority(kind: ReviewItemKind): number {
  switch (kind) {
    case "missing_input":
      return 0;
    case "proxy":
      return 1;
    case "low_confidence":
      return 2;
    case "collision":
      return 3;
    case "history_hotspot":
      return 4;
    default:
      return 5;
  }
}

export function sortReviewItems(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort((left, right) => {
    const leftKind = left.kind ?? classifyReviewItemKind(left.summary, left.reason);
    const rightKind = right.kind ?? classifyReviewItemKind(right.summary, right.reason);
    const byKind = reviewItemPriority(leftKind) - reviewItemPriority(rightKind);
    if (byKind !== 0) {
      return byKind;
    }
    const byConfidence = left.confidence - right.confidence;
    if (byConfidence !== 0) {
      return byConfidence;
    }
    return left.summary.localeCompare(right.summary);
  });
}

export function buildSuggestedNextEvidence(response: CommandResponse<unknown>): string[] {
  const suggestions: string[] = [];
  const measurementQuality = response.meta?.measurementQuality;
  if (measurementQuality?.proxyMetrics.includes("QSF")) {
    suggestions.push("Add or tighten scenario observations for the highest-priority architecture scenarios.");
  }
  if (measurementQuality?.proxyMetrics.includes("OAS")) {
    suggestions.push("Add telemetry or pattern-runtime observations so OAS stops relying on proxy signals.");
  }
  if (response.unknowns.some(isMissingInputNote)) {
    suggestions.push("Resolve the highest-impact missing input or thin-evidence unknowns first.");
  }
  if (
    typeof response.result === "object" &&
    response.result !== null &&
    "domainId" in response.result &&
    (response.result as { domainId: string }).domainId === "domain_design" &&
    response.unknowns.some((entry) => entry.includes("aggregate"))
  ) {
    suggestions.push("Add explicit aggregates or invariant ownership so AFS stops relying on context proxies.");
  }
  return dedupe(suggestions).slice(0, 5);
}
