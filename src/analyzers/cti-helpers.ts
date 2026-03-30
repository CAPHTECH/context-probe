import type { ArchitectureConstraints, ComplexityTaxBaseline, ComplexityTaxComponentName } from "../core/contracts.js";

const DEFAULT_BASELINES: Record<ComplexityTaxComponentName, Required<ComplexityTaxBaseline>> = {
  DeployablesPerTeam: { target: 1, worst: 8 },
  PipelinesPerDeployable: { target: 1, worst: 6 },
  ContractsOrSchemasPerService: { target: 2, worst: 20 },
  DatastoresPerServiceGroup: { target: 1, worst: 5 },
  OnCallSurface: { target: 2, worst: 20 },
  SyncDepthOverhead: { target: 1, worst: 6 },
  RunCostPerBusinessTransaction: { target: 1, worst: 10 },
};

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getBaseline(
  constraints: ArchitectureConstraints,
  component: ComplexityTaxComponentName,
): Required<ComplexityTaxBaseline> {
  const override = constraints.complexity?.normalization?.[component];
  return {
    target: override?.target ?? DEFAULT_BASELINES[component].target,
    worst: override?.worst ?? DEFAULT_BASELINES[component].worst,
  };
}

export function normalizeTax(value: number, baseline: Required<ComplexityTaxBaseline>): number {
  if (value <= baseline.target) {
    return 0;
  }
  if (value >= baseline.worst) {
    return 1;
  }
  return clamp01((value - baseline.target) / Math.max(0.0001, baseline.worst - baseline.target));
}

export function uniqueUnknowns(entries: string[]): string[] {
  return Array.from(new Set(entries));
}

export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
