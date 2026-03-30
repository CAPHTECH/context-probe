import type { BoundaryLeakFinding, CochangeAnalysis, EvolutionLocalityModelComparison } from "./analysis.js";
import type { DomainDesignPilotAnalysis, MetricScore } from "./governance.js";

export interface DomainDesignShadowAnalysis {
  localityModels: EvolutionLocalityModelComparison;
}

export interface DomainDesignScoreResult {
  domainId: "domain_design";
  metrics: MetricScore[];
  leakFindings: BoundaryLeakFinding[];
  history: CochangeAnalysis | null;
  crossContextReferences: number;
  shadow?: DomainDesignShadowAnalysis;
  pilot?: DomainDesignPilotAnalysis;
}
