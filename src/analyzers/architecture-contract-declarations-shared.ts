import type { ArchitectureContractBaselineSymbol, ArchitectureContractBaselineSymbolKind } from "../core/contracts.js";

export function createContractSymbol(input: {
  name: string;
  kind: ArchitectureContractBaselineSymbolKind;
  stability: "stable" | "risky";
  loose: boolean;
}): ArchitectureContractBaselineSymbol {
  return {
    name: input.name,
    kind: input.kind,
    stability: input.stability,
    looseness: input.loose ? "loose" : "strict",
  };
}

export function uniqueSymbols(symbols: ArchitectureContractBaselineSymbol[]): ArchitectureContractBaselineSymbol[] {
  const seen = new Set<string>();
  const results: ArchitectureContractBaselineSymbol[] = [];

  for (const symbol of symbols) {
    const key = `${symbol.name}:${symbol.kind}:${symbol.stability}:${symbol.looseness}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(symbol);
  }

  return results;
}
