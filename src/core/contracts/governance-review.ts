import type { ProvenanceRef } from "./common.js";

export type ReviewPriority = "high" | "medium" | "low";

export type ReviewItemKind =
  | "proxy"
  | "missing_input"
  | "low_confidence"
  | "collision"
  | "history_hotspot"
  | "wide_blast_radius"
  | "test_gap"
  | "large_change"
  | "unknown";

export interface ReviewItem {
  reviewItemId: string;
  reason: string;
  kind?: ReviewItemKind;
  priority?: ReviewPriority;
  summary: string;
  confidence: number;
  evidenceRefs: string[];
  targetEntityId?: string;
  suggestedPatch?: Record<string, unknown>;
  provenance?: ProvenanceRef[];
}

export interface ReviewResolution {
  reviewItemId: string;
  status: string;
  decision?: {
    patch?: Record<string, unknown>;
  };
  note?: string;
  reviewedAt?: string;
}

export interface ResolvedReviewItem extends ReviewItem {
  resolution?: ReviewResolution | null;
}

export interface ReviewResolutionLog {
  reviewItems: ResolvedReviewItem[];
  overrides: Array<{
    targetEntityId: string;
    patch: Record<string, unknown>;
    reason: string;
  }>;
}
