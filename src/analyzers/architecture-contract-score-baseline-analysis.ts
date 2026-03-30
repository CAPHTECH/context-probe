import type { ArchitectureConstraints, ArchitectureContractBaseline } from "../core/contracts.js";
import type { BaselineComparisonSummary } from "./architecture-contract-score-shared.js";
import { average, clamp01 } from "./architecture-contract-score-shared.js";
import type { ContractFileStats } from "./architecture-contract-stats.js";
import type { ContractStabilityFinding } from "./architecture-contract-types.js";
import { isMeasuredContractFilePath } from "./contract-files.js";

function collectScopedBaselineEntries(options: {
  baseline: ArchitectureContractBaseline;
  constraints: ArchitectureConstraints;
}): { entries: ArchitectureContractBaseline["contracts"]; unknowns: string[] } {
  const baselineContracts = Array.isArray(options.baseline.contracts) ? options.baseline.contracts : [];
  const inScopeBaselineEntries = baselineContracts.filter((entry) =>
    isMeasuredContractFilePath({
      filePath: entry.path,
      constraints: options.constraints,
      allowDartDomainFallback: true,
    }),
  );
  const ignoredBaselineEntries = baselineContracts.length - inScopeBaselineEntries.length;
  const unknowns =
    ignoredBaselineEntries > 0
      ? [
          `${ignoredBaselineEntries} contract baseline entries are outside the current architecture scope and were ignored.`,
        ]
      : [];

  return {
    entries: inScopeBaselineEntries,
    unknowns,
  };
}

function compareBaselineEntry(options: {
  baselineEntry: ArchitectureContractBaseline["contracts"][number];
  currentByPath: Map<string, ContractFileStats>;
}): {
  baselineSymbolCount: number;
  comparedFiles: number;
  baselineEntriesWithoutImportStats: number;
  removedSymbols: number;
  regressedSymbols: number;
  loosenedSymbols: number;
  newRiskySymbols: number;
  importRiskDeltas: number;
  baselineImportTotal: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
} {
  const unknowns: string[] = [];
  const findings: ContractStabilityFinding[] = [];
  const baselineSymbols = options.baselineEntry.symbols ?? [];
  const currentEntry = options.currentByPath.get(options.baselineEntry.path);

  if (!currentEntry) {
    return {
      baselineSymbolCount: Math.max(1, baselineSymbols.length),
      comparedFiles: 0,
      baselineEntriesWithoutImportStats: 0,
      removedSymbols: Math.max(1, baselineSymbols.length),
      regressedSymbols: 0,
      loosenedSymbols: 0,
      newRiskySymbols: 0,
      importRiskDeltas: 0,
      baselineImportTotal: 0,
      unknowns,
      findings: [
        {
          kind: "contract_backward_compatibility_risk",
          path: options.baselineEntry.path,
          confidence: 0.94,
          note: `${options.baselineEntry.path} existed in the contract baseline but is no longer present in the current contract surface.`,
        },
      ],
    };
  }

  let removedSymbols = 0;
  let regressedSymbols = 0;
  let loosenedSymbols = 0;
  let newRiskySymbols = 0;
  let importRiskDeltas = 0;
  let baselineImportTotal = 0;

  const currentSymbolsByName = new Map(currentEntry.symbols.map((symbol) => [symbol.name, symbol]));
  for (const baselineSymbol of baselineSymbols) {
    const currentSymbol = currentSymbolsByName.get(baselineSymbol.name);
    if (!currentSymbol) {
      removedSymbols += 1;
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: options.baselineEntry.path,
        confidence: 0.94,
        note: `${options.baselineEntry.path} removed public contract symbol ${baselineSymbol.name} since the baseline snapshot.`,
        symbol: baselineSymbol.name,
      });
      continue;
    }
    if (baselineSymbol.stability === "stable" && currentSymbol.stability === "risky") {
      regressedSymbols += 1;
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: options.baselineEntry.path,
        confidence: 0.93,
        note: `${options.baselineEntry.path} regressed ${baselineSymbol.name} from a stable contract declaration to an implementation-coupled export.`,
        symbol: baselineSymbol.name,
      });
    }
    if (baselineSymbol.looseness === "strict" && currentSymbol.looseness === "loose") {
      loosenedSymbols += 1;
      findings.push({
        kind: "breaking_change_risk",
        path: options.baselineEntry.path,
        confidence: 0.92,
        note: `${options.baselineEntry.path} loosened ${baselineSymbol.name} since the baseline snapshot.`,
        symbol: baselineSymbol.name,
      });
    }
  }

  const baselineSymbolNames = new Set(baselineSymbols.map((symbol) => symbol.name));
  newRiskySymbols += currentEntry.symbols.filter(
    (symbol) => !baselineSymbolNames.has(symbol.name) && (symbol.stability === "risky" || symbol.looseness === "loose"),
  ).length;

  if (options.baselineEntry.imports) {
    baselineImportTotal += options.baselineEntry.imports.total;
    importRiskDeltas += Math.max(0, currentEntry.nonContractImports - options.baselineEntry.imports.nonContract);
    importRiskDeltas += Math.max(0, currentEntry.internalImports - options.baselineEntry.imports.internal);
  }

  return {
    baselineSymbolCount: baselineSymbols.length,
    comparedFiles: 1,
    baselineEntriesWithoutImportStats: options.baselineEntry.imports ? 0 : 1,
    removedSymbols,
    regressedSymbols,
    loosenedSymbols,
    newRiskySymbols,
    importRiskDeltas,
    baselineImportTotal,
    unknowns,
    findings,
  };
}

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
