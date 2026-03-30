import type { CommandResponse, DomainDesignPilotAnalysis, MetricScore } from "./contracts.js";

interface MetricGuidance {
  ideal: string;
  watch: string;
  action: string;
}

export type ReportResponse = CommandResponse<{
  domainId: string;
  metrics: MetricScore[];
  leakFindings?: unknown[];
  violations?: unknown[];
  pilot?: DomainDesignPilotAnalysis;
}>;

export type GateResponse = CommandResponse<{
  domainId: string;
  metrics: MetricScore[];
}>;

export function formatMetric(metric: MetricScore): string {
  const components = Object.entries(metric.components)
    .map(([key, value]) => `${key}=${value.toFixed(3)}`)
    .join(", ");
  return `- ${metric.metricId}: ${metric.value.toFixed(3)} [confidence=${metric.confidence.toFixed(3)}] (${components})`;
}

const METRIC_GUIDANCE: Record<string, MetricGuidance> = {
  DRF: {
    ideal: "Major use cases, business rules, and invariants should be traceable to model elements.",
    watch: "Low values often indicate weak modeling, ambiguous documents, or review disagreement.",
    action: "List the core use cases and rules, then map them explicitly to model elements.",
  },
  ULI: {
    ideal: "Canonical terms should stay stable inside each context and remain traceable across docs and code.",
    watch: "Low values often indicate alias sprawl, term collision, or weak traceability.",
    action: "Organize the glossary per context and align Published Language and DTO naming.",
  },
  BFS: {
    ideal: "Boundaries should reflect both reasons to keep elements together and reasons to separate them.",
    watch: "Low values often mean the split follows feature lists rather than ownership, security, or invariants.",
    action: "Review attraction and separation signals and document the boundary rationale.",
  },
  AFS: {
    ideal: "Strong invariants should close within a single aggregate and avoid multi-aggregate atomic writes.",
    watch: "Low values often mean synchronous consistency responsibilities are spread across boundaries.",
    action: "List strong invariants and revisit which aggregate owns each synchronous responsibility.",
  },
  MCCS: {
    ideal: "Cross-context communication should go through public contracts without leaking internal types.",
    watch: "Low values often indicate boundary leaks or direct use of internal models instead of contract DTOs.",
    action: "Detect cross-context imports in CI and move integrations behind ACLs or contract DTOs.",
  },
  ELS: {
    ideal: "Feature-level changes should stay inside a small number of contexts and co-change should remain local.",
    watch: "Low values often indicate hidden dependencies or a mismatch between design boundaries and evolution units.",
    action: "Inspect the highest co-change context pairs and consider contract separation or reintegration.",
  },
  QSF: {
    ideal:
      "Important scenarios should have explicit priority, target, and worst-acceptable values backed by observations.",
    watch: "Low values often mean the discussion is pattern-first instead of scenario-first.",
    action: "Narrow to the top scenarios and normalize benchmark or incident data into scenario observations.",
  },
  DDS: {
    ideal: "Dependency direction should align with the constraints model and forbidden edges should be observable.",
    watch: "Low values often indicate layer bypasses or reversed dependency direction.",
    action: "Strengthen static rules around the layers with the most direction violations.",
  },
  BPS: {
    ideal: "Internal boundaries should stay free from framework contamination and shared internal components.",
    watch: "Low values often indicate adapter leaks or growing internal sharing across boundaries.",
    action: "Separate framework-heavy code and reduce shared internal components.",
  },
  IPS: {
    ideal: "Public contracts should stay stable and keep breaking-change risk low.",
    watch: "Low values often indicate risky exports, internal imports, or schema-language issues.",
    action: "Make contract files explicit and move public APIs toward interfaces, types, and DTOs.",
  },
  TIS: {
    ideal: "Failure isolation and runtime containment should be explainable in both topology and runtime evidence.",
    watch: "Low values often indicate shared resources or sync dependencies that cross boundaries.",
    action: "Add explicit isolation boundaries to the topology model and reduce shared dependencies.",
  },
  OAS: {
    ideal: "Latency, error, saturation, and pattern-runtime signals should be observable by traffic band.",
    watch: "Low values often mean runtime behavior does not deliver the promise of the selected pattern.",
    action: "Normalize telemetry by traffic band and add the minimum pattern-runtime observation set.",
  },
  AELS: {
    ideal: "Co-change should stay localized at the architecture-boundary level and propagation cost should remain low.",
    watch: "Low values often mean the boundary map does not match the real evolution unit.",
    action: "Define the boundary map explicitly and review the highest cross-boundary co-change pairs.",
  },
  EES: {
    ideal: "Delivery and locality should both improve so that speed and change locality coexist.",
    watch:
      "Low values often indicate either missing delivery evidence or wide coordinated changes hidden behind speed.",
    action: "Read lead time and co-change together to decide whether delivery or locality is the real bottleneck.",
  },
  CTI: {
    ideal: "Deployable, pipeline, schema, and on-call tax should stay proportional to the gain being claimed.",
    watch: "High values often mean the design is overpaying distributed-systems or async complexity tax.",
    action: "Start by measuring deployables per team and on-call surface, then reduce the most expensive tax sources.",
  },
  APSI: {
    ideal: "Use APSI only as a summary after reading the supporting metrics.",
    watch: "Using it alone makes it easy to misread proxy values, neutral fallbacks, and partial evidence.",
    action: "Check QSF, PCS proxy, OAS, EES, and CTI before using APSI in a decision.",
  },
};

function formatMetricGuidance(metric: MetricScore): string | null {
  const guidance = METRIC_GUIDANCE[metric.metricId];
  if (!guidance) {
    return null;
  }
  return `- ${metric.metricId}: ideal=${guidance.ideal} watch=${guidance.watch} next=${guidance.action}`;
}

export function renderMetricGuidanceSection(metrics: MetricScore[]): string[] {
  const guidanceLines = metrics
    .map((metric) => formatMetricGuidance(metric))
    .filter((line): line is string => Boolean(line));
  if (guidanceLines.length === 0) {
    return [];
  }
  return ["", "## Metric Guidance", ...guidanceLines];
}

export function isArchitectureDomain(response: ReportResponse | GateResponse): boolean {
  return response.result.domainId === "architecture_design";
}

export function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function proxyOrPartialUnknowns(metric: MetricScore): string[] {
  return metric.unknowns.filter((entry) => /(proxy|partial|bridge|neutral|unobserved|approx)/iu.test(entry));
}
