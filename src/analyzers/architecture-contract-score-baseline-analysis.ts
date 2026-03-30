import type { ArchitectureConstraints, ArchitectureContractBaseline } from "../core/contracts.js";
import { compareBaselineEntry } from "./architecture-contract-score-baseline-entry.js";
import { collectScopedBaselineEntries } from "./architecture-contract-score-baseline-scope.js";
import type { BaselineComparisonSummary } from "./architecture-contract-score-shared.js";
import { average, clamp01 } from "./architecture-contract-score-shared.js";
import type { ContractFileStats } from "./architecture-contract-stats.js";
import type { ContractStabilityFinding } from "./architecture-contract-types.js";

export function analyzeBaselineComparison(options: {
  baseline: ArchitectureContractBaseline;
  currentStats: ContractFileStats[];
  constraints: ArchitectureConstraints;
}): BaselineComparisonSummary | undefined {
  const currentByPath = new Map(options.currentStats.map((entry) => [entry.path, entry]));
  const scopedBaseline = collectScopedBaselineEntries({
    baseline: options.baseline,
    constraints: options.constraints,
  });

  if (scopedBaseline.entries.length === 0) {
    return undefined;
  }

  let baselineSymbolCount = 0;
  let comparedFiles = 0;
  let baselineEntriesWithoutImportStats = 0;
  let removedSymbols = 0;
  let regressedSymbols = 0;
  let loosenedSymbols = 0;
  let newRiskySymbols = 0;
  let importRiskDeltas = 0;
  let baselineImportTotal = 0;
  const findings: ContractStabilityFinding[] = [];
  const unknowns = [...scopedBaseline.unknowns];

  for (const baselineEntry of scopedBaseline.entries) {
    const result = compareBaselineEntry({
      baselineEntry,
      currentByPath,
    });
    baselineSymbolCount += result.baselineSymbolCount;
    comparedFiles += result.comparedFiles;
    baselineEntriesWithoutImportStats += result.baselineEntriesWithoutImportStats;
    removedSymbols += result.removedSymbols;
    regressedSymbols += result.regressedSymbols;
    loosenedSymbols += result.loosenedSymbols;
    newRiskySymbols += result.newRiskySymbols;
    importRiskDeltas += result.importRiskDeltas;
    baselineImportTotal += result.baselineImportTotal;
    unknowns.push(...result.unknowns);
    findings.push(...result.findings);
  }

  if (baselineEntriesWithoutImportStats > 0) {
    unknowns.push(
      `${baselineEntriesWithoutImportStats} contract baseline entries do not include import statistics, so BCR import deltas are partial.`,
    );
  }

  if (comparedFiles < scopedBaseline.entries.length) {
    unknowns.push(
      `The contract baseline covered ${comparedFiles}/${scopedBaseline.entries.length} in-scope baseline files in the current repo.`,
    );
  }

  const currentContractFileCount = options.currentStats.length;
  const currentPaths = new Set(options.currentStats.map((entry) => entry.path));
  const baselinePaths = new Set(scopedBaseline.entries.map((entry) => entry.path));
  const currentFilesOutsideBaseline =
    currentContractFileCount - Array.from(currentPaths).filter((pathValue) => baselinePaths.has(pathValue)).length;
  if (currentFilesOutsideBaseline > 0) {
    unknowns.push(
      `The contract baseline does not cover ${currentFilesOutsideBaseline} current contract files, so CBC/BCR are partial.`,
    );
  }

  const compatibilityFailures = removedSymbols + regressedSymbols + loosenedSymbols;
  const deltaRiskSignals = compatibilityFailures + newRiskySymbols + importRiskDeltas;
  const cbcDenominator = Math.max(1, baselineSymbolCount);
  const bcrDenominator = Math.max(1, baselineSymbolCount + baselineImportTotal + currentFilesOutsideBaseline);

  return {
    CBC: clamp01(1 - compatibilityFailures / cbcDenominator),
    BCR: clamp01(deltaRiskSignals / bcrDenominator),
    confidence: clamp01(
      average(
        [
          0.84,
          comparedFiles > 0 ? comparedFiles / Math.max(1, scopedBaseline.entries.length) : 0.4,
          baselineSymbolCount > 0 ? 0.88 : 0.55,
          baselineEntriesWithoutImportStats === 0 ? 0.86 : 0.7,
        ],
        0.65,
      ),
    ),
    unknowns: Array.from(new Set(unknowns)),
    findings,
  };
}
