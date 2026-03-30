import type { TelemetryNormalizationRule } from "./architecture-normalization.js";
import type { ArchitecturePatternRuntimeObservationSet } from "./architecture-pattern-runtime.js";
import type { ArchitectureCanonicalSourceConfig } from "./architecture-scenarios.js";

export interface ArchitectureTelemetryBandObservation {
  bandId: string;
  trafficWeight: number;
  LatencyScore?: number;
  ErrorScore?: number;
  SaturationScore?: number;
}

export interface ArchitectureTelemetryObservationSet {
  version: string;
  bands: ArchitectureTelemetryBandObservation[];
}

export interface ArchitectureTelemetryRawBandObservation {
  bandId: string;
  trafficWeight: number;
  latencyP95?: number;
  errorRate?: number;
  saturationRatio?: number;
}

export interface ArchitectureTelemetryRawObservationSet {
  version: string;
  bands: ArchitectureTelemetryRawBandObservation[];
}

export interface ArchitectureTelemetryExportBand {
  bandId: string;
  trafficWeight: number;
  latencyP95?: number;
  errorRate?: number;
  saturationRatio?: number;
  source?: string;
  window?: string;
}

export interface ArchitectureTelemetryExportBundle {
  version: string;
  sourceSystem?: string;
  bands: ArchitectureTelemetryExportBand[];
  patternRuntime?: ArchitecturePatternRuntimeObservationSet;
  note?: string;
}

export interface ArchitectureTelemetrySourceConfig extends ArchitectureCanonicalSourceConfig {}

export interface ArchitectureTelemetryNormalizationProfile {
  version: string;
  signals: Partial<Record<"LatencyScore" | "ErrorScore" | "SaturationScore", TelemetryNormalizationRule>>;
}
