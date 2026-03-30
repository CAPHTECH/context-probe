import type { ArchitectureContractBaseline } from "../core/contracts.js";

import type { ContractFileStats } from "./architecture-contract-stats.js";
import type { ContractStabilityFinding } from "./architecture-contract-types.js";

export function compareBaselineEntry(options: {
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
