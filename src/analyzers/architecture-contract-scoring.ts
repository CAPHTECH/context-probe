import type { ArchitectureConstraints, ArchitectureContractBaseline, CodebaseAnalysis } from "../core/contracts.js";
import { compareAgainstBaseline } from "./architecture-contract-score-baseline.js";
import { buildCurrentStateScore } from "./architecture-contract-score-current.js";
import { average, clamp01 } from "./architecture-contract-score-shared.js";
import { collectContractFileStats, toContractBaselineEntry } from "./architecture-contract-stats.js";
import type { InterfaceProtocolStabilityScore } from "./architecture-contract-types.js";

export async function captureInterfaceProtocolBaseline(options: {
  root: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  capturedAt?: string;
  note?: string;
}): Promise<ArchitectureContractBaseline> {
  const stats = await collectContractFileStats(options);
  return {
    version: "1.0",
    ...(options.capturedAt || options.note
      ? {
          snapshot: {
            ...(options.capturedAt ? { sourceKind: "captured", capturedAt: options.capturedAt } : {}),
            ...(options.note ? { note: options.note } : {}),
          },
        }
      : {}),
    contracts: stats.map((entry) => toContractBaselineEntry(entry)),
  };
}

export async function scoreInterfaceProtocolStability(options: {
  root: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  baseline?: ArchitectureContractBaseline;
}): Promise<InterfaceProtocolStabilityScore> {
  const stats = await collectContractFileStats(options);
  const contractPaths = stats.map((entry) => entry.path);

  if (contractPaths.length === 0) {
    return {
      CBC: 0.5,
      BCR: 0.5,
      SLA: 0.5,
      confidence: 0.45,
      unknowns: ["There are too few contract files, so IPS is conservative."],
      findings: [],
    };
  }

  const currentState = buildCurrentStateScore(stats);
  const baselineComparison = options.baseline
    ? compareAgainstBaseline({
        baseline: options.baseline,
        currentStats: stats,
        constraints: options.constraints,
      })
    : undefined;

  const totalImports = stats.reduce((sum, entry) => sum + entry.totalImports, 0);
  const importAdherence =
    totalImports === 0
      ? 1
      : 1 - stats.reduce((sum, entry) => sum + entry.nonContractImports, 0) / Math.max(1, totalImports);
  const cleanContractFileRatio =
    stats.filter(
      (entry) =>
        entry.riskyExports === 0 &&
        entry.anyExports === 0 &&
        entry.nonContractImports === 0 &&
        entry.internalImports === 0,
    ).length / Math.max(1, stats.length);
  const SLA = clamp01(0.6 * importAdherence + 0.4 * cleanContractFileRatio);

  const mergedUnknowns = baselineComparison
    ? [
        ...baselineComparison.unknowns,
        ...(totalImports === 0 ? ["There are too few contract imports, so SLA evidence is limited."] : []),
      ]
    : currentState.unknowns;
  const mergedFindings = baselineComparison
    ? [...currentState.findings, ...baselineComparison.findings]
    : currentState.findings;
  const confidence = baselineComparison
    ? clamp01(average([currentState.confidence, baselineComparison.confidence], currentState.confidence))
    : currentState.confidence;

  return {
    CBC: baselineComparison?.CBC ?? currentState.CBC,
    BCR: baselineComparison?.BCR ?? currentState.BCR,
    SLA,
    confidence,
    unknowns: Array.from(new Set(mergedUnknowns)),
    findings: mergedFindings,
  };
}
