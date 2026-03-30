import type { detectBoundaryLeaks, detectContractUsage } from "../analyzers/code.js";
import type { DomainModel, Evidence, MetricScore, TermTraceLink } from "./contracts.js";
import type { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";

export type GlossaryExtractionResult = Awaited<ReturnType<typeof extractGlossary>>;
export type RulesExtractionResult = Awaited<ReturnType<typeof extractRules>>;
export type InvariantsExtractionResult = Awaited<ReturnType<typeof extractInvariants>>;

export interface DomainDocsMetricOptionsBase {
  docsRoot: string | undefined;
  model: DomainModel;
  codeFiles: string[];
  contractUsage: ReturnType<typeof detectContractUsage>;
  leakFindings: ReturnType<typeof detectBoundaryLeaks>;
  getGlossaryResult: () => Promise<GlossaryExtractionResult>;
  getRulesResult: () => Promise<RulesExtractionResult>;
  getInvariantsResult: () => Promise<InvariantsExtractionResult>;
  getTermTraceLinks: () => Promise<TermTraceLink[]>;
}

export interface DomainDocsMetricContribution {
  scores: MetricScore[];
  evidence: Evidence[];
  diagnostics: string[];
  unknowns: string[];
}
