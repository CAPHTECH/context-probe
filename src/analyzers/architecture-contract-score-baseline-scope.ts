import type { ArchitectureConstraints, ArchitectureContractBaseline } from "../core/contracts.js";

import { isMeasuredContractFilePath } from "./contract-files.js";

export function collectScopedBaselineEntries(options: {
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

  return {
    entries: inScopeBaselineEntries,
    unknowns:
      ignoredBaselineEntries > 0
        ? [
            `${ignoredBaselineEntries} contract baseline entries are outside the current architecture scope and were ignored.`,
          ]
        : [],
  };
}
