import type { ContractCurrentStateSummary } from "./architecture-contract-score-shared.js";
import { average, clamp01 } from "./architecture-contract-score-shared.js";
import type { ContractFileStats } from "./architecture-contract-stats.js";

export function buildCurrentStateScore(stats: ContractFileStats[]): ContractCurrentStateSummary {
  const totalExports = stats.reduce((sum, entry) => sum + entry.exportCount, 0);
  const stableExports = stats.reduce((sum, entry) => sum + entry.stableExports, 0);
  const totalImports = stats.reduce((sum, entry) => sum + entry.totalImports, 0);
  const nonContractImports = stats.reduce((sum, entry) => sum + entry.nonContractImports, 0);
  const internalImports = stats.reduce((sum, entry) => sum + entry.internalImports, 0);
  const riskyExports = stats.reduce((sum, entry) => sum + entry.riskyExports + entry.anyExports, 0);
  const riskSignals = riskyExports + nonContractImports + internalImports;
  const unknowns: string[] = ["CBC/BCR are current-state contract-stability proxies, not baseline deltas."];

  const stableExportRatio = totalExports === 0 ? 0.5 : stableExports / totalExports;
  const importAdherence = totalImports === 0 ? 1 : 1 - nonContractImports / Math.max(1, totalImports);
  const cleanContractFileRatio =
    stats.filter(
      (entry) =>
        entry.riskyExports === 0 &&
        entry.anyExports === 0 &&
        entry.nonContractImports === 0 &&
        entry.internalImports === 0,
    ).length / Math.max(1, stats.length);

  const CBC = clamp01(
    stableExportRatio * (1 - Math.min(1, riskSignals / Math.max(1, totalExports + totalImports)) * 0.35),
  );
  const BCR = clamp01(riskSignals / Math.max(1, totalExports + totalImports + stats.length));
  const SLA = clamp01(0.6 * importAdherence + 0.4 * cleanContractFileRatio);

  if (totalImports === 0) {
    unknowns.push("There are too few contract imports, so SLA evidence is limited.");
  }
  if (totalExports === 0) {
    unknowns.push("There are too few public contract exports, so CBC evidence is limited.");
  }

  return {
    CBC,
    BCR,
    SLA,
    confidence: clamp01(
      average(
        [
          stats.length > 0 ? 0.8 : 0.45,
          totalExports > 0 ? 0.82 : 0.55,
          totalImports > 0 ? 0.75 : 0.6,
          riskSignals > 0 ? 0.85 : 0.72,
        ],
        0.6,
      ),
    ),
    unknowns: Array.from(new Set(unknowns)),
    findings: stats.flatMap((entry) => entry.findings),
  };
}
