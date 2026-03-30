import type { ContractStabilityFinding } from "./architecture-contract-types.js";

export interface ContractCurrentStateSummary {
  CBC: number;
  BCR: number;
  SLA: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
}

export interface BaselineComparisonSummary {
  CBC: number;
  BCR: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
