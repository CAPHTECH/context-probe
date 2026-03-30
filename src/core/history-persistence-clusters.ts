import type { CochangePairWeight, CochangeStabilityCluster } from "./contracts.js";
import { clamp01, unique } from "./history-shared.js";

type ContextualizedCommit = {
  contexts: string[];
};

function componentKey(contexts: string[]): string {
  return contexts.join("::");
}

export function buildPairWeights(relevant: ContextualizedCommit[]): CochangePairWeight[] {
  const contextTouchCount = new Map<string, number>();
  const pairCount = new Map<string, number>();

  for (const commit of relevant) {
    for (const context of commit.contexts) {
      contextTouchCount.set(context, (contextTouchCount.get(context) ?? 0) + 1);
    }

    for (let index = 0; index < commit.contexts.length; index += 1) {
      for (let next = index + 1; next < commit.contexts.length; next += 1) {
        const left = commit.contexts[index];
        const right = commit.contexts[next];
        if (!left || !right) {
          continue;
        }
        const key = `${left}::${right}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(pairCount.entries())
    .map(([key, rawCount]) => {
      const [left = "", right = ""] = key.split("::");
      const leftTouches = contextTouchCount.get(left) ?? 0;
      const rightTouches = contextTouchCount.get(right) ?? 0;
      const denominator = leftTouches + rightTouches - rawCount;
      return {
        left,
        right,
        rawCount,
        jaccard: denominator === 0 ? 0 : clamp01(rawCount / denominator),
      };
    })
    .sort(
      (left, right) =>
        right.jaccard - left.jaccard ||
        right.rawCount - left.rawCount ||
        left.left.localeCompare(right.left) ||
        left.right.localeCompare(right.right),
    );
}

function connectedComponents(contextsSeen: string[], pairWeights: CochangePairWeight[], threshold: number): string[][] {
  if (contextsSeen.length === 0) {
    return [];
  }

  const parent = new Map<string, string>(contextsSeen.map((context) => [context, context]));
  const size = new Map<string, number>(contextsSeen.map((context) => [context, 1]));

  const find = (value: string): string => {
    let current = value;
    while (true) {
      const parentValue = parent.get(current);
      if (!parentValue || parentValue === current) {
        break;
      }
      current = parentValue;
    }

    let compress = value;
    while (true) {
      const parentValue = parent.get(compress);
      if (!parentValue || parentValue === current) {
        break;
      }
      const next = parentValue;
      parent.set(compress, current);
      compress = next;
    }

    return current;
  };

  const union = (left: string, right: string) => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) {
      return;
    }
    const leftSize = size.get(leftRoot) ?? 1;
    const rightSize = size.get(rightRoot) ?? 1;
    if (leftSize < rightSize || (leftSize === rightSize && leftRoot.localeCompare(rightRoot) > 0)) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    parent.set(rightRoot, leftRoot);
    size.set(leftRoot, leftSize + rightSize);
  };

  for (const pair of pairWeights) {
    if (pair.jaccard < threshold) {
      continue;
    }
    union(pair.left, pair.right);
  }

  const groups = new Map<string, string[]>();
  for (const context of contextsSeen) {
    const root = find(context);
    const members = groups.get(root) ?? [];
    members.push(context);
    groups.set(root, members);
  }

  return Array.from(groups.values())
    .map((members) => members.sort())
    .filter((members) => members.length > 1)
    .sort((left, right) => right.length - left.length || componentKey(left).localeCompare(componentKey(right)));
}

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
    const components = connectedComponents(contextsSeen, pairWeights, threshold);
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
