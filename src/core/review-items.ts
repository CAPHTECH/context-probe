import type {
  AiChangeReviewScoreResult,
  CommandResponse,
  GlossaryTerm,
  InvariantCandidate,
  ReviewItem,
  RuleCandidate,
} from "./contracts.js";
import { classifyReviewItemKind, sortReviewItems } from "./measurement-metadata.js";

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
        kind: "low_confidence",
        summary: `${summary} has low confidence`,
        confidence: entity.confidence,
        evidenceRefs,
        targetEntityId,
      });
    }
    entity.unknowns.forEach((unknown, unknownIndex) => {
      reviewItems.push({
        reviewItemId: `RV-UNK-${index + 1}-${unknownIndex + 1}`,
        reason: "unknown",
        kind: classifyReviewItemKind(unknown, "unknown"),
        summary: unknown,
        confidence: entity.confidence,
        evidenceRefs,
        targetEntityId,
      });
    });
    if (isGlossaryTerm(entity) && entity.collision) {
      reviewItems.push({
        reviewItemId: `RV-COLL-${index + 1}`,
        reason: "collision",
        kind: "collision",
        summary: `${entity.canonicalTerm} may have a collision`,
        confidence: entity.confidence,
        evidenceRefs,
        targetEntityId,
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
      kind: classifyReviewItemKind(unknown, "unknown"),
      summary: unknown,
      confidence: response.confidence,
      evidenceRefs,
    });
  });

  if (typeof response.result !== "object" || response.result === null) {
    return reviewItems;
  }
  const result = response.result as Record<string, unknown>;
  if ((result as { domainId?: string }).domainId === "ai_change_review" && Array.isArray(result.reviewTargets)) {
    const aiChangeResult = response.result as AiChangeReviewScoreResult;
    return sortReviewItems([
      ...aiChangeResult.reviewTargets.map((target) => ({
        reviewItemId: target.targetId,
        reason: target.reasons[0] ?? "unknown",
        kind: classifyReviewItemKind(target.summary, target.reasons[0] ?? "unknown"),
        priority: target.priority,
        summary: target.summary,
        confidence: target.confidence,
        evidenceRefs: target.evidenceRefs,
        provenance: [{ path: target.path, line: target.line, note: target.changeType }],
      })),
      ...reviewItems,
    ]);
  }
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
          kind: "low_confidence",
          summary: `${metric.metricId} has low confidence`,
          confidence: metric.confidence,
          evidenceRefs,
        });
      }
    }
  }

  if (Array.isArray(result.localityWatchlist)) {
    for (const [index, item] of (
      result.localityWatchlist as Array<{ boundaries: string[]; count: number; sampleCommitHashes?: string[] }>
    ).entries()) {
      reviewItems.push({
        reviewItemId: `RV-HOTSPOT-${index + 1}`,
        reason: "history_hotspot",
        kind: "history_hotspot",
        summary: `Recurring cross-boundary hotspot ${item.boundaries.join(" <-> ")} appears in ${item.count} commits${
          item.sampleCommitHashes && item.sampleCommitHashes.length > 0
            ? ` (${item.sampleCommitHashes.join(", ")})`
            : ""
        }.`,
        confidence: response.confidence,
        evidenceRefs,
      });
    }
  }

  return sortReviewItems(reviewItems);
}
