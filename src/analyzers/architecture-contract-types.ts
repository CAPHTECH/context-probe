import type { ArchitectureContractBaselineSymbol } from "../core/contracts.js";

export interface ContractStabilityFinding {
  kind: "contract_backward_compatibility_risk" | "breaking_change_risk" | "schema_language_violation";
  path: string;
  symbol?: string;
  confidence: number;
  note: string;
}

export interface InterfaceProtocolStabilityScore {
  CBC: number;
  BCR: number;
  SLA: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
}

export interface ContractDeclarationStats {
  exportCount: number;
  stableExports: number;
  riskyExports: number;
  anyExports: number;
  symbols: ArchitectureContractBaselineSymbol[];
  findings: ContractStabilityFinding[];
}
