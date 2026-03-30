import type { Evidence, ExtractionProviderName } from "./common.js";

export interface DomainDesignPilotAnalysis {
  category: string;
  applied: boolean;
  localitySource: "els" | "persistence_candidate";
  baselineElsValue: number;
  persistenceCandidateValue: number;
  effectiveElsValue: number;
  overallGate: {
    reasons: string[];
    replacementVerdict: "go" | "no_go";
    rolloutDisposition: "replace" | "shadow_only";
  };
  categoryGate: {
    reasons: string[];
    replacementVerdict: "go" | "no_go";
    rolloutDisposition: "replace" | "shadow_only";
  };
}

export interface MarkdownReportResult {
  format: "md";
  report: string;
}

export interface MetricGateDecision {
  status: "ok" | "warning" | "error";
  failures: string[];
  warnings: string[];
}

export interface MeasurementGateResult {
  domainId: "domain_design" | "architecture_design";
  gate: MetricGateDecision;
  metrics: MetricScore[];
  pilot?: DomainDesignPilotAnalysis;
}

export interface MetricThresholds {
  warn?: number;
  fail?: number;
}

export interface MetricPolicy {
  formula: string;
  thresholds?: MetricThresholds;
}

export interface DomainPolicy {
  metrics: Record<string, MetricPolicy>;
  review?: {
    require_human_if?: string[];
  };
}

export interface PolicyConfig {
  profiles: Record<
    string,
    {
      domains: Record<string, DomainPolicy>;
      history_filters?: {
        ignore_commit_patterns?: string[];
        ignore_paths?: string[];
      };
    }
  >;
}

export interface GlossaryTerm {
  termId: string;
  canonicalTerm: string;
  aliases: string[];
  count: number;
  collision: boolean;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
}

export interface RuleCandidate {
  ruleId: string;
  type: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
  relatedTerms?: string[];
}

export interface InvariantCandidate {
  invariantId: string;
  type: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
  relatedTerms?: string[];
}

export interface ExtractionProviderResult<T> {
  items: T[];
  confidence: number;
  unknowns: string[];
  diagnostics: string[];
  provider: ExtractionProviderName;
}

export interface TraceLinkOccurrence {
  kind: "document" | "code";
  path: string;
  fragmentId?: string;
  matchCount: number;
}

export interface TermTraceLink {
  termId: string;
  canonicalTerm: string;
  occurrences: TraceLinkOccurrence[];
  coverage: {
    documentHits: number;
    codeHits: number;
  };
  confidence: number;
}

export interface ModelCodeLink {
  context: string;
  files: string[];
  counts: {
    contract: number;
    internal: number;
    unclassified: number;
  };
  coverage: number;
}

export interface MetricScore {
  metricId: string;
  value: number;
  components: Record<string, number>;
  confidence: number;
  evidenceRefs: string[];
  unknowns: string[];
}

export interface ReviewItem {
  reviewItemId: string;
  reason: string;
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

export interface DomainPack {
  id: string;
  version: string;
  commands: string[];
  metrics: string[];
  reviewRules: string[];
}

export interface CommandContext {
  cwd: string;
}
