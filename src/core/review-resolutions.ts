import type { ResolvedReviewItem, ReviewItem, ReviewResolution, ReviewResolutionLog } from "./contracts.js";

export function resolveReviewItems(reviewItems: ReviewItem[], resolutions: ReviewResolution[]): ReviewResolutionLog {
  const resolvedItems: ResolvedReviewItem[] = reviewItems.map((reviewItem) => ({
    ...reviewItem,
    resolution: resolutions.find((resolution) => resolution.reviewItemId === reviewItem.reviewItemId) ?? null,
  }));

  const overrides = resolvedItems.flatMap((reviewItem) => {
    const patch = reviewItem.resolution?.decision?.patch;
    if (!reviewItem.targetEntityId || !patch || Object.keys(patch).length === 0) {
      return [];
    }
    return [
      {
        targetEntityId: reviewItem.targetEntityId,
        patch,
        reason: reviewItem.reason,
      },
    ];
  });

  return {
    reviewItems: resolvedItems,
    overrides,
  };
}

export function applyReviewOverrides<T extends object>(
  items: T[],
  log: ReviewResolutionLog | undefined,
  idKey: keyof T,
): T[] {
  if (!log) {
    return items;
  }
  const overrideMap = new Map(log.overrides.map((override) => [override.targetEntityId, override.patch]));
  return items.map((item) => {
    const id = item[idKey];
    if (typeof id !== "string") {
      return item;
    }
    const patch = overrideMap.get(id);
    if (!patch) {
      return item;
    }
    return {
      ...(item as object),
      ...patch,
    } as T;
  });
}
