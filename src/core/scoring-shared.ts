import type { BoundaryLeakFinding, MetricScore } from "./contracts.js";
import { average, clamp01 } from "./shared-utils.js";

export function computeLeakRatio(leaks: BoundaryLeakFinding[], applicableReferences: number): number {
  if (applicableReferences === 0) {
    return 0;
  }
  return leaks.length / applicableReferences;
}

export function toMetricScore(
  metricId: string,
  value: number,
  components: Record<string, number>,
  evidenceRefs: string[],
  confidence: number,
  unknowns: string[],
): MetricScore {
  return {
    metricId,
    value,
    components,
    confidence,
    evidenceRefs,
    unknowns,
  };
}

export { average, clamp01 };

export function weightedAverage(
  entries: Array<{ value: number | undefined; weight: number }>,
  fallback: number,
): number {
  const observed = entries.filter((entry) => entry.value !== undefined && Number.isFinite(entry.value));
  if (observed.length === 0) {
    return fallback;
  }
  const totalWeight = observed.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return fallback;
  }
  return observed.reduce((sum, entry) => sum + (entry.value ?? 0) * entry.weight, 0) / totalWeight;
}

export function dedupeEvidence<T extends { evidenceId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.evidenceId)) {
      return false;
    }
    seen.add(item.evidenceId);
    return true;
  });
}
