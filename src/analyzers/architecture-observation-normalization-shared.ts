import type { ScenarioDirection } from "../core/contracts.js";

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function uniqueUnknowns(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function normalizeObservedValue(input: {
  direction: ScenarioDirection;
  observed: number;
  target: number;
  worstAcceptable: number;
}): number {
  const { direction, observed, target, worstAcceptable } = input;
  if (direction === "lower_is_better") {
    return clamp01((worstAcceptable - observed) / Math.max(0.0001, worstAcceptable - target));
  }
  return clamp01((observed - worstAcceptable) / Math.max(0.0001, target - worstAcceptable));
}
