export interface ObservationIngestFinding {
  kind:
    | "telemetry_export_band_mapped"
    | "telemetry_export_missing_signal"
    | "telemetry_export_pattern_runtime_embedded"
    | "delivery_export_signal_mapped"
    | "delivery_export_missing_signal";
  confidence: number;
  note: string;
  sourceSystem?: string;
  bandId?: string;
  component?: string;
  observed?: number;
  window?: string;
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

export function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
