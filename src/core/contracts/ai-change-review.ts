import type { ReviewPriority } from "./governance-review.js";
import type { MetricScore } from "./governance-scoring.js";

export type AiChangeReviewReason = "wide_blast_radius" | "history_hotspot" | "test_gap" | "large_change";

export type AiChangeReviewChangeType = "added" | "modified" | "deleted" | "renamed";

export interface AiChangeReviewDiffSummary {
  baseBranch: string;
  headBranch: string;
  mergeBase: string;
  changedFileCount: number;
  changedHunkCount: number;
  analyzedFileCount: number;
}

export interface AiChangeReviewTarget {
  targetId: string;
  path: string;
  line: number;
  priority: ReviewPriority;
  reasons: AiChangeReviewReason[];
  summary: string;
  confidence: number;
  evidenceRefs: string[];
  changeType: AiChangeReviewChangeType;
}

export interface AiChangeReviewScoreResult {
  domainId: "ai_change_review";
  metrics: MetricScore[];
  diffSummary: AiChangeReviewDiffSummary;
  reviewTargets: AiChangeReviewTarget[];
}
