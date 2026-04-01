export type ReviewItemKind = "proxy" | "missing_input" | "low_confidence" | "collision" | "history_hotspot" | "unknown";

export interface ReviewItem {
  reviewItemId: string;
  reason: string;
  kind?: ReviewItemKind;
  summary: string;
  confidence: number;
  evidenceRefs: string[];
  targetEntityId?: string;
  suggestedPatch?: Record<string, unknown>;
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
