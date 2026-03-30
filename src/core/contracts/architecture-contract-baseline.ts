import type { ArchitectureCanonicalSourceConfig } from "./architecture-scenarios.js";

export interface ArchitectureContractBaselineSnapshot {
  sourceKind?: string;
  capturedAt?: string;
  note?: string;
}

export type ArchitectureContractBaselineSymbolKind =
  | "interface"
  | "type_alias"
  | "enum"
  | "class"
  | "function"
  | "value"
  | "default_export"
  | "unknown";

export type ArchitectureContractBaselineSymbolStability = "stable" | "risky";
export type ArchitectureContractBaselineSymbolLooseness = "strict" | "loose";

export interface ArchitectureContractBaselineSymbol {
  name: string;
  kind: ArchitectureContractBaselineSymbolKind;
  stability: ArchitectureContractBaselineSymbolStability;
  looseness: ArchitectureContractBaselineSymbolLooseness;
}

export interface ArchitectureContractBaselineImportStats {
  total: number;
  nonContract: number;
  internal: number;
}

export interface ArchitectureContractBaselineEntry {
  path: string;
  symbols: ArchitectureContractBaselineSymbol[];
  imports?: ArchitectureContractBaselineImportStats;
}

export interface ArchitectureContractBaseline {
  version: string;
  snapshot?: ArchitectureContractBaselineSnapshot;
  contracts: ArchitectureContractBaselineEntry[];
  note?: string;
}

export interface ArchitectureContractBaselineSourceConfig extends ArchitectureCanonicalSourceConfig {}
