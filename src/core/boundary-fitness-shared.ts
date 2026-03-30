const SEPARATION_SIGNALS = [
  /ownership/u,
  /security/u,
  /team境界/u,
  /セキュリティ/u,
  /分離/u,
  /独立/u,
  /別(?:責務|所有|境界)/u,
  /\bseparate\b/i,
  /\bseparation\b/i,
  /\boundary\b/i,
];

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function hasSeparationSignal(text: string): boolean {
  return SEPARATION_SIGNALS.some((pattern) => pattern.test(text));
}
