import path from "node:path";

import type { CommandResponse, GlossaryTerm, MetricScore } from "../src/core/contracts.js";

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const PARSER_REPO = path.resolve("fixtures/dart-support/parser-repo");
export const DART_DOMAIN_MODEL = path.resolve("fixtures/dart-support/domain-design/model.yaml");
export const DART_DOMAIN_GOOD_REPO = path.resolve("fixtures/dart-support/domain-design/good-repo");
export const DART_DOMAIN_BAD_REPO = path.resolve("fixtures/dart-support/domain-design/bad-repo");
export const DART_ARCHITECTURE_CONSTRAINTS = path.resolve("fixtures/dart-support/architecture-design/constraints.yaml");
export const DART_ARCHITECTURE_GOOD_REPO = path.resolve("fixtures/dart-support/architecture-design/good-repo");
export const DART_ARCHITECTURE_BAD_REPO = path.resolve("fixtures/dart-support/architecture-design/bad-repo");
export const FLUTTER_HEURISTIC_CONSTRAINTS = path.resolve("fixtures/dart-support/flutter-heuristics/constraints.yaml");
export const FLUTTER_HEURISTIC_REPO = path.resolve("fixtures/dart-support/flutter-heuristics/repo");

export function getMetric(response: CommandResponse<unknown>, metricId: string): MetricScore {
  const result = response.result as { metrics: MetricScore[] };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`metric ${metricId} not found`);
  }
  return metric;
}

export function createFlutterTraceTerms(): GlossaryTerm[] {
  return [
    {
      termId: "TERM-ORDER-CONTRACT",
      canonicalTerm: "OrderContract",
      aliases: [],
      count: 1,
      collision: false,
      confidence: 1,
      evidence: [],
      unknowns: [],
      fragmentIds: [],
    },
    {
      termId: "TERM-GENERATED-ONLY",
      canonicalTerm: "GeneratedOnly",
      aliases: [],
      count: 1,
      collision: false,
      confidence: 1,
      evidence: [],
      unknowns: [],
      fragmentIds: [],
    },
  ];
}
