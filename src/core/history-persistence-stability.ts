import type { CochangePairWeight, CochangeStabilityCluster } from "./contracts.js";
import { buildConnectedComponents, componentKey } from "./history-persistence-components.js";
import { clamp01, unique } from "./history-shared.js";

function computeNoiseRatio(stableChangeClusters: CochangeStabilityCluster[]): number {
  const stabilityMass = stableChangeClusters.reduce((sum, cluster) => sum + cluster.stability, 0);
  if (stabilityMass === 0) {
    return 0;
  }

  const topMass = stableChangeClusters
    .slice()
    .sort((left, right) => right.stability - left.stability)
    .slice(0, 3)
    .reduce((sum, cluster) => sum + cluster.stability, 0);
  return clamp01(1 - topMass / stabilityMass);
}

export function deriveStableClusters(
  contextsSeen: string[],
  pairWeights: CochangePairWeight[],
): {
  stableChangeClusters: CochangeStabilityCluster[];
  naturalSplitLevels: number[];
  noiseRatio: number;
  hasWeightRange: boolean;
} {
  if (contextsSeen.length < 2 || pairWeights.length === 0) {
    return {
      stableChangeClusters: [],
      naturalSplitLevels: [],
      noiseRatio: 0,
      hasWeightRange: true,
    };
  }

  const thresholds = unique(pairWeights.map((pair) => pair.jaccard)).sort((left, right) => right - left);
  const active = new Map<string, { contexts: string[]; birth: number }>();
  const completed: CochangeStabilityCluster[] = [];

  for (const threshold of thresholds) {
    const components = buildConnectedComponents(contextsSeen, pairWeights, threshold);
    const currentKeys = new Set(components.map((members) => componentKey(members)));

    for (const members of components) {
      const key = componentKey(members);
      if (!active.has(key)) {
        active.set(key, {
          contexts: members,
          birth: threshold,
        });
      }
    }

    for (const [key, entry] of Array.from(active.entries())) {
      if (currentKeys.has(key)) {
        continue;
      }
      completed.push({
        contexts: entry.contexts,
        birth: entry.birth,
        death: threshold,
        stability: clamp01(entry.birth - threshold),
      });
      active.delete(key);
    }
  }

  for (const entry of active.values()) {
    completed.push({
      contexts: entry.contexts,
      birth: entry.birth,
      death: 0,
      stability: clamp01(entry.birth),
    });
  }

  const stableChangeClusters = completed
    .sort(
      (left, right) =>
        right.stability - left.stability ||
        right.contexts.length - left.contexts.length ||
        componentKey(left.contexts).localeCompare(componentKey(right.contexts)),
    )
    .slice(0, 5);
  const naturalSplitLevels = unique(stableChangeClusters.map((cluster) => cluster.birth)).sort(
    (left, right) => right - left,
  );

  return {
    stableChangeClusters,
    naturalSplitLevels,
    noiseRatio: computeNoiseRatio(completed),
    hasWeightRange: thresholds.length > 1,
  };
}

export function computeClusterPenalty(strongestCluster: CochangeStabilityCluster | null, contextCount: number): number {
  if (!strongestCluster || contextCount < 2) {
    return 0;
  }
  const spanFactor = clamp01((strongestCluster.contexts.length - 1) / (contextCount - 1));
  return clamp01(strongestCluster.stability * spanFactor);
}
