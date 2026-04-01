import type {
  ArchitectureScenarioQualitySummary,
  CommandResponse,
  DomainDesignPilotAnalysis,
  LocalityWatchlistItem,
  MetricScore,
} from "./contracts.js";

export type ReportResponse = CommandResponse<{
  domainId: string;
  metrics: MetricScore[];
  leakFindings?: unknown[];
  violations?: unknown[];
  pilot?: DomainDesignPilotAnalysis;
  scenarioQuality?: ArchitectureScenarioQualitySummary;
  localityWatchlist?: LocalityWatchlistItem[];
}>;

export type GateResponse = CommandResponse<{
  domainId: string;
  metrics: MetricScore[];
}>;

export function isArchitectureDomain(response: ReportResponse | GateResponse): boolean {
  return response.result.domainId === "architecture_design";
}

export function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function proxyOrPartialUnknowns(metric: MetricScore): string[] {
  return metric.unknowns.filter((entry) => /(proxy|partial|bridge|neutral|unobserved|approx)/iu.test(entry));
}
