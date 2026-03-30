import type { ArchitectureConstraints, ArchitectureContractBaseline } from "../core/contracts.js";
import { analyzeBaselineComparison } from "./architecture-contract-score-baseline-analysis.js";
import type { BaselineComparisonSummary } from "./architecture-contract-score-shared.js";
import type { ContractFileStats } from "./architecture-contract-stats.js";

export function compareAgainstBaseline(options: {
  baseline: ArchitectureContractBaseline;
  currentStats: ContractFileStats[];
  constraints: ArchitectureConstraints;
}): BaselineComparisonSummary | undefined {
  return analyzeBaselineComparison(options);
}
