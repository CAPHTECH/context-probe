import type { ArchitectureConstraints, ArchitectureContractBaseline, CodebaseAnalysis } from "../core/contracts.js";
import {
  type ContractFileStats,
  collectContractFileStats,
  toContractBaselineEntry,
} from "./architecture-contract-stats.js";
import type { ContractStabilityFinding, InterfaceProtocolStabilityScore } from "./architecture-contract-types.js";
import { isMeasuredContractFilePath } from "./contract-files.js";

interface BaselineComparisonSummary {
  CBC: number;
  BCR: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildCurrentStateScore(stats: ContractFileStats[]): {
  CBC: number;
  BCR: number;
  SLA: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
} {
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

function compareAgainstBaseline(options: {
  baseline: ArchitectureContractBaseline;
  currentStats: ContractFileStats[];
  constraints: ArchitectureConstraints;
}): BaselineComparisonSummary | undefined {
  const unknowns: string[] = [];
  const findings: ContractStabilityFinding[] = [];
  const currentByPath = new Map(options.currentStats.map((entry) => [entry.path, entry]));
  const baselineContracts = Array.isArray(options.baseline.contracts) ? options.baseline.contracts : [];
  const inScopeBaselineEntries = baselineContracts.filter((entry) =>
    isMeasuredContractFilePath({
      filePath: entry.path,
      constraints: options.constraints,
      allowDartDomainFallback: true,
    }),
  );
  const ignoredBaselineEntries = baselineContracts.length - inScopeBaselineEntries.length;

  if (ignoredBaselineEntries > 0) {
    unknowns.push(
      `${ignoredBaselineEntries} contract baseline entries are outside the current architecture scope and were ignored.`,
    );
  }

  if (inScopeBaselineEntries.length === 0) {
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

  for (const baselineEntry of inScopeBaselineEntries) {
    const baselineSymbols = baselineEntry.symbols ?? [];
    baselineSymbolCount += baselineSymbols.length;
    const currentEntry = currentByPath.get(baselineEntry.path);
    if (!currentEntry) {
      const removedCount = Math.max(1, baselineSymbols.length);
      removedSymbols += removedCount;
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: baselineEntry.path,
        confidence: 0.94,
        note: `${baselineEntry.path} existed in the contract baseline but is no longer present in the current contract surface.`,
      });
      continue;
    }

    comparedFiles += 1;
    const currentSymbolsByName = new Map(currentEntry.symbols.map((symbol) => [symbol.name, symbol]));
    for (const baselineSymbol of baselineSymbols) {
      const currentSymbol = currentSymbolsByName.get(baselineSymbol.name);
      if (!currentSymbol) {
        removedSymbols += 1;
        findings.push({
          kind: "contract_backward_compatibility_risk",
          path: baselineEntry.path,
          confidence: 0.94,
          note: `${baselineEntry.path} removed public contract symbol ${baselineSymbol.name} since the baseline snapshot.`,
          symbol: baselineSymbol.name,
        });
        continue;
      }
      if (baselineSymbol.stability === "stable" && currentSymbol.stability === "risky") {
        regressedSymbols += 1;
        findings.push({
          kind: "contract_backward_compatibility_risk",
          path: baselineEntry.path,
          confidence: 0.93,
          note: `${baselineEntry.path} regressed ${baselineSymbol.name} from a stable contract declaration to an implementation-coupled export.`,
          symbol: baselineSymbol.name,
        });
      }
      if (baselineSymbol.looseness === "strict" && currentSymbol.looseness === "loose") {
        loosenedSymbols += 1;
        findings.push({
          kind: "breaking_change_risk",
          path: baselineEntry.path,
          confidence: 0.92,
          note: `${baselineEntry.path} loosened ${baselineSymbol.name} since the baseline snapshot.`,
          symbol: baselineSymbol.name,
        });
      }
    }

    const baselineSymbolNames = new Set(baselineSymbols.map((symbol) => symbol.name));
    newRiskySymbols += currentEntry.symbols.filter(
      (symbol) =>
        !baselineSymbolNames.has(symbol.name) && (symbol.stability === "risky" || symbol.looseness === "loose"),
    ).length;

    if (baselineEntry.imports) {
      baselineImportTotal += baselineEntry.imports.total;
      importRiskDeltas += Math.max(0, currentEntry.nonContractImports - baselineEntry.imports.nonContract);
      importRiskDeltas += Math.max(0, currentEntry.internalImports - baselineEntry.imports.internal);
    } else {
      baselineEntriesWithoutImportStats += 1;
    }
  }

  if (baselineEntriesWithoutImportStats > 0) {
    unknowns.push(
      `${baselineEntriesWithoutImportStats} contract baseline entries do not include import statistics, so BCR import deltas are partial.`,
    );
  }

  if (comparedFiles < inScopeBaselineEntries.length) {
    unknowns.push(
      `The contract baseline covered ${comparedFiles}/${inScopeBaselineEntries.length} in-scope baseline files in the current repo.`,
    );
  }

  const currentContractFileCount = options.currentStats.length;
  const currentPaths = new Set(options.currentStats.map((entry) => entry.path));
  const baselinePaths = new Set(inScopeBaselineEntries.map((entry) => entry.path));
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
          comparedFiles > 0 ? comparedFiles / Math.max(1, inScopeBaselineEntries.length) : 0.4,
          baselineSymbolCount > 0 ? 0.88 : 0.55,
          baselineEntriesWithoutImportStats === 0 ? 0.86 : 0.7,
        ],
        0.65,
      ),
    ),
    unknowns,
    findings,
  };
}

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
