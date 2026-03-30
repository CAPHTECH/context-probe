import type { CochangePairWeight } from "./contracts.js";

type ContextualizedCommit = {
  contexts: string[];
};

export function componentKey(contexts: string[]): string {
  return contexts.join("::");
}

export function buildConnectedComponents(
  contextsSeen: string[],
  pairWeights: CochangePairWeight[],
  threshold: number,
): string[][] {
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
        jaccard: denominator === 0 ? 0 : Math.max(0, Math.min(1, rawCount / denominator)),
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
