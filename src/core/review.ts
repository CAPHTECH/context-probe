import type {
  CommandResponse,
  GlossaryTerm,
  InvariantCandidate,
  ResolvedReviewItem,
  ReviewItem,
  ReviewResolution,
  ReviewResolutionLog,
  RuleCandidate
} from "./contracts.js";

type ReviewableEntity = GlossaryTerm | RuleCandidate | InvariantCandidate;

function isGlossaryTerm(entity: ReviewableEntity): entity is GlossaryTerm {
  return "termId" in entity;
}

function getEntityId(entity: ReviewableEntity): string {
  if ("termId" in entity) {
    return entity.termId;
  }
  if ("ruleId" in entity) {
    return entity.ruleId;
  }
  return entity.invariantId;
}

function getEntitySummary(entity: ReviewableEntity): string {
  if (isGlossaryTerm(entity)) {
    return entity.canonicalTerm;
  }
  return entity.statement;
}

function getReviewItemsFromEntities(entities: ReviewableEntity[], evidenceRefs: string[]): ReviewItem[] {
  const reviewItems: ReviewItem[] = [];

  entities.forEach((entity, index) => {
    const targetEntityId = getEntityId(entity);
    const summary = getEntitySummary(entity);
    if (entity.confidence < 0.75) {
      reviewItems.push({
        reviewItemId: `RV-LOW-${index + 1}`,
        reason: "low_confidence",
        summary: `${summary} の confidence が低い`,
        confidence: entity.confidence,
        evidenceRefs,
        targetEntityId
      });
    }
    entity.unknowns.forEach((unknown, unknownIndex) => {
      reviewItems.push({
        reviewItemId: `RV-UNK-${index + 1}-${unknownIndex + 1}`,
        reason: "unknown",
        summary: unknown,
        confidence: entity.confidence,
        evidenceRefs,
        targetEntityId
      });
    });
    if (isGlossaryTerm(entity) && entity.collision) {
      reviewItems.push({
        reviewItemId: `RV-COLL-${index + 1}`,
        reason: "collision",
        summary: `${entity.canonicalTerm} に collision の可能性があります`,
        confidence: entity.confidence,
        evidenceRefs,
        targetEntityId
      });
    }
  });

  return reviewItems;
}

export function listReviewItems(response: CommandResponse<unknown>): ReviewItem[] {
  const reviewItems: ReviewItem[] = [];
  const evidenceRefs = response.evidence.map((entry) => entry.evidenceId);
  response.unknowns.forEach((unknown, index) => {
    reviewItems.push({
      reviewItemId: `RV-RSP-${index + 1}`,
      reason: "unknown",
      summary: unknown,
      confidence: response.confidence,
      evidenceRefs
    });
  });

  if (typeof response.result !== "object" || response.result === null) {
    return reviewItems;
  }
  const result = response.result as Record<string, unknown>;
  if (Array.isArray(result.terms)) {
    reviewItems.push(...getReviewItemsFromEntities(result.terms as GlossaryTerm[], evidenceRefs));
  }
  if (Array.isArray(result.rules)) {
    reviewItems.push(...getReviewItemsFromEntities(result.rules as RuleCandidate[], evidenceRefs));
  }
  if (Array.isArray(result.invariants)) {
    reviewItems.push(...getReviewItemsFromEntities(result.invariants as InvariantCandidate[], evidenceRefs));
  }
  if (Array.isArray(result.metrics)) {
    for (const [index, metric] of (result.metrics as Array<{ metricId: string; confidence: number }>).entries()) {
      if (metric.confidence < 0.75) {
        reviewItems.push({
          reviewItemId: `RV-METRIC-${index + 1}`,
          reason: "low_confidence",
          summary: `${metric.metricId} の confidence が低い`,
          confidence: metric.confidence,
          evidenceRefs
        });
      }
    }
  }

  return reviewItems;
}

export function resolveReviewItems(
  reviewItems: ReviewItem[],
  resolutions: ReviewResolution[]
): ReviewResolutionLog {
  const resolvedItems: ResolvedReviewItem[] = reviewItems.map((reviewItem) => ({
    ...reviewItem,
    resolution: resolutions.find((resolution) => resolution.reviewItemId === reviewItem.reviewItemId) ?? null
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
        reason: reviewItem.reason
      }
    ];
  });

  return {
    reviewItems: resolvedItems,
    overrides
  };
}

export function applyReviewOverrides<T extends object>(
  items: T[],
  log: ReviewResolutionLog | undefined,
  idKey: keyof T
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
      ...patch
    } as T;
  });
}
