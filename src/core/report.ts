import type {
  CommandResponse,
  DomainDesignPilotAnalysis,
  MetricGateDecision,
  MetricScore,
  PolicyConfig,
} from "./contracts.js";
import { getDomainPolicy } from "./policy.js";

interface MetricGuidance {
  ideal: string;
  watch: string;
  action: string;
}

function formatMetric(metric: MetricScore): string {
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

function renderMetricGuidanceSection(metrics: MetricScore[]): string[] {
  const guidanceLines = metrics
    .map((metric) => formatMetricGuidance(metric))
    .filter((line): line is string => Boolean(line));
  if (guidanceLines.length === 0) {
    return [];
  }
  return ["", "## Metric Guidance", ...guidanceLines];
}

function renderPilotRolloutSection(pilot: DomainDesignPilotAnalysis | undefined): string[] {
  if (!pilot) {
    return [];
  }

  const overallReasons = pilot.overallGate.reasons.length > 0 ? pilot.overallGate.reasons.join(", ") : "none";
  const categoryReasons = pilot.categoryGate.reasons.length > 0 ? pilot.categoryGate.reasons.join(", ") : "none";

  return [
    "",
    "## Pilot Rollout",
    `- Category: ${pilot.category}`,
    `- Applied: ${pilot.applied ? "yes" : "no"}`,
    `- Locality Source: ${pilot.localitySource}`,
    `- Baseline ELS: ${pilot.baselineElsValue.toFixed(3)}`,
    `- Persistence Candidate: ${pilot.persistenceCandidateValue.toFixed(3)}`,
    `- Effective ELS: ${pilot.effectiveElsValue.toFixed(3)}`,
    `- Overall Gate: ${pilot.overallGate.rolloutDisposition} (${pilot.overallGate.replacementVerdict})`,
    `- Overall Reasons: ${overallReasons}`,
    `- Category Gate: ${pilot.categoryGate.rolloutDisposition} (${pilot.categoryGate.replacementVerdict})`,
    `- Category Reasons: ${categoryReasons}`,
  ];
}

function isArchitectureDomain(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
  }>,
): boolean {
  return response.result.domainId === "architecture_design";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function architectureMetricMap(metrics: MetricScore[]): Map<string, MetricScore> {
  return new Map(metrics.map((metric) => [metric.metricId, metric]));
}

function proxyOrPartialUnknowns(metric: MetricScore): string[] {
  return metric.unknowns.filter((entry) => /(proxy|partial|bridge|neutral|unobserved|approx)/iu.test(entry));
}

function detectPolicyProfile(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
  }>,
  explicitProfileName?: string,
): string | undefined {
  if (explicitProfileName) {
    return explicitProfileName;
  }
  const profileEntry = response.provenance.find((entry) => entry.note?.startsWith("profile="));
  return profileEntry?.note?.slice("profile=".length);
}

function renderArchitectureReport(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
    leakFindings?: unknown[];
    violations?: unknown[];
  }>,
  profileName?: string,
): string {
  const lines = ["# Measurement Report", ""];
  const metrics = architectureMetricMap(response.result.metrics);
  const summaryMetric = metrics.get("APSI");
  const supportingMetricIds = ["QSF", "DDS", "BPS", "IPS", "OAS", "EES", "CTI"];
  const bridgeMetricIds = ["TIS", "AELS"];
  const supportingMetrics = supportingMetricIds
    .map((metricId) => metrics.get(metricId))
    .filter((metric): metric is MetricScore => Boolean(metric));
  const bridgeMetrics = bridgeMetricIds
    .map((metricId) => metrics.get(metricId))
    .filter((metric): metric is MetricScore => Boolean(metric));
  const proxySignals = dedupe(
    response.result.metrics.flatMap((metric) =>
      proxyOrPartialUnknowns(metric).map((entry) => `${metric.metricId}: ${entry}`),
    ),
  );
  const activeProfile = detectPolicyProfile(response, profileName);

  lines.push(`- Domain: ${response.result.domainId}`);
  lines.push(`- Status: ${response.status}`);
  lines.push(`- Confidence: ${response.confidence.toFixed(3)}`);
  if (activeProfile) {
    lines.push(`- Policy Profile: ${activeProfile}`);
  }
  lines.push("");
  lines.push("## Architecture Summary");
  if (summaryMetric) {
    lines.push(formatMetric(summaryMetric));
    lines.push("- APSI is a summary-only metric. Always read the supporting metrics below.");
  } else {
    lines.push("- APSI is not available for this run.");
  }

  lines.push("", "## Supporting Metrics");
  lines.push(...supportingMetrics.map(formatMetric));

  if (bridgeMetrics.length > 0) {
    lines.push("", "## Bridge Metrics");
    lines.push(...bridgeMetrics.map(formatMetric));
  }

  lines.push(
    ...renderMetricGuidanceSection([...(summaryMetric ? [summaryMetric] : []), ...supportingMetrics, ...bridgeMetrics]),
  );

  if (proxySignals.length > 0) {
    lines.push("", "## Proxy / Partial Signals", ...proxySignals.map((item) => `- ${item}`));
  }

  if (response.unknowns.length > 0) {
    lines.push("", "## Unknowns", ...response.unknowns.map((item) => `- ${item}`));
  }
  if (response.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", ...response.diagnostics.map((item) => `- ${item}`));
  }
  if (response.result.violations && response.result.violations.length > 0) {
    lines.push("", "## Direction Violations", `- Count: ${response.result.violations.length}`);
  }

  return `${lines.join("\n")}\n`;
}

export function renderMarkdownReport(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
    leakFindings?: unknown[];
    violations?: unknown[];
    pilot?: DomainDesignPilotAnalysis;
  }>,
  profileName?: string,
): string {
  if (isArchitectureDomain(response)) {
    return renderArchitectureReport(response, profileName);
  }

  const lines = ["# Measurement Report", ""];
  lines.push(`- Domain: ${response.result.domainId}`);
  lines.push(`- Status: ${response.status}`);
  lines.push(`- Confidence: ${response.confidence.toFixed(3)}`);
  lines.push("");
  lines.push("## Metrics");
  lines.push(...response.result.metrics.map(formatMetric));
  lines.push(...renderPilotRolloutSection(response.result.pilot));
  lines.push(...renderMetricGuidanceSection(response.result.metrics));

  if (response.unknowns.length > 0) {
    lines.push("", "## Unknowns", ...response.unknowns.map((item) => `- ${item}`));
  }
  if (response.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", ...response.diagnostics.map((item) => `- ${item}`));
  }
  if (response.result.leakFindings && response.result.leakFindings.length > 0) {
    lines.push("", "## Boundary Leaks", `- Count: ${response.result.leakFindings.length}`);
  }
  if (response.result.violations && response.result.violations.length > 0) {
    lines.push("", "## Direction Violations", `- Count: ${response.result.violations.length}`);
  }

  return `${lines.join("\n")}\n`;
}

export function evaluateGate(
  response: CommandResponse<{
    domainId: string;
    metrics: MetricScore[];
  }>,
  policyConfig: PolicyConfig,
  profileName: string,
): MetricGateDecision {
  const policy = getDomainPolicy(policyConfig, profileName, response.result.domainId);
  const failures: string[] = [];
  const warnings: string[] = [];
  const architectureSummaryMetricIds = new Set(["APSI"]);
  const isArchitecture = response.result.domainId === "architecture_design";

  for (const metric of response.result.metrics) {
    const thresholds = policy.metrics[metric.metricId]?.thresholds;
    if (!thresholds) {
      continue;
    }
    if (isArchitecture && architectureSummaryMetricIds.has(metric.metricId)) {
      if (thresholds.fail !== undefined && metric.value < thresholds.fail) {
        warnings.push(`${metric.metricId}=${metric.value.toFixed(3)} < summary_fail(${thresholds.fail})`);
        continue;
      }
      if (thresholds.warn !== undefined && metric.value < thresholds.warn) {
        warnings.push(`${metric.metricId}=${metric.value.toFixed(3)} < summary_warn(${thresholds.warn})`);
      }
      continue;
    }
    if (thresholds.fail !== undefined && metric.value < thresholds.fail) {
      failures.push(`${metric.metricId}=${metric.value.toFixed(3)} < fail(${thresholds.fail})`);
      continue;
    }
    if (thresholds.warn !== undefined && metric.value < thresholds.warn) {
      warnings.push(`${metric.metricId}=${metric.value.toFixed(3)} < warn(${thresholds.warn})`);
    }
  }

  if (isArchitecture) {
    const partialMetrics = response.result.metrics
      .filter((metric) => proxyOrPartialUnknowns(metric).length > 0)
      .map((metric) => metric.metricId);
    if (partialMetrics.length > 0) {
      warnings.push(
        `architecture metrics include proxy/partial decision material: ${dedupe(partialMetrics).join(", ")}`,
      );
    }
  }

  return {
    status: failures.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    failures,
    warnings,
  };
}
