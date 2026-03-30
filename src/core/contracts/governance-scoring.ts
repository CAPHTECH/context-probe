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

export interface MetricScore {
  metricId: string;
  value: number;
  components: Record<string, number>;
  confidence: number;
  evidenceRefs: string[];
  unknowns: string[];
}
