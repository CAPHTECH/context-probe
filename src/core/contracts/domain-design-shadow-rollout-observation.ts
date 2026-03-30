import type { CochangeAnalysis } from "./analysis.js";
import type { DomainDesignShadowAnalysis } from "./domain-design-score.js";
import type { MetricScore } from "./governance.js";

export interface DomainDesignShadowRolloutObservation {
  domainId: "domain_design";
  metricId: "ELS";
  elsMetric: MetricScore;
  shadow: DomainDesignShadowAnalysis;
  observation: {
    policyDelta: number;
    modelDelta: number;
    driftCategory: "aligned" | "candidate_higher" | "candidate_lower";
    tieTolerance: number;
  };
  history: CochangeAnalysis | null;
  crossContextReferences: number;
}
