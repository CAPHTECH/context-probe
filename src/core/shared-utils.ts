export function clamp01Finite(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
