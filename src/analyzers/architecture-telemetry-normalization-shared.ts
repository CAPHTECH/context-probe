import type { ArchitectureTelemetryObservationSet } from "../core/contracts.js";

export interface TelemetryNormalizationFinding {
  kind: "normalized_signal" | "missing_raw_signal" | "missing_normalization_rule";
  confidence: number;
  note: string;
  bandId: string;
  component: "LatencyScore" | "ErrorScore" | "SaturationScore";
  observed?: number;
  normalized?: number;
}

export interface NormalizedTelemetryResult {
  telemetry: ArchitectureTelemetryObservationSet;
  confidence: number;
  unknowns: string[];
  findings: TelemetryNormalizationFinding[];
}
