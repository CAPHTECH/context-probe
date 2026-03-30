import type {
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryRawObservationSet,
} from "../core/contracts.js";
import { average, clamp01, uniqueUnknowns } from "./architecture-observation-normalization-shared.js";
import {
  buildEmptyTelemetryNormalizationResult,
  countNormalizedTelemetryBand,
  normalizeTelemetryBand,
} from "./architecture-telemetry-normalization-band.js";
import type {
  NormalizedTelemetryResult,
  TelemetryNormalizationFinding,
} from "./architecture-telemetry-normalization-shared.js";

export function normalizeTelemetryObservationsCore(input: {
  raw?: ArchitectureTelemetryRawObservationSet;
  profile?: ArchitectureTelemetryNormalizationProfile;
}): NormalizedTelemetryResult {
  const findings: TelemetryNormalizationFinding[] = [];
  const unknowns: string[] = [];
  const rawBands = input.raw?.bands ?? [];
  const profile = input.profile;

  if (rawBands.length === 0) {
    return buildEmptyTelemetryNormalizationResult(
      "No telemetry raw observations were provided, so raw normalization is unobserved.",
      0.25,
      findings,
    );
  }

  if (!profile) {
    return buildEmptyTelemetryNormalizationResult(
      "No telemetry normalization profile was provided, so raw telemetry cannot be scored.",
      0.3,
      findings,
      rawBands,
    );
  }

  const normalizedBands = rawBands.map((band) => normalizeTelemetryBand({ band, profile, findings, unknowns }));
  const observedSignals = normalizedBands.reduce((total, band) => total + countNormalizedTelemetryBand(band), 0);
  const totalPossibleSignals = Math.max(1, rawBands.length * 3);

  return {
    telemetry: {
      version: "1.0",
      bands: normalizedBands,
    },
    confidence: clamp01(
      average(
        [
          rawBands.length > 0 ? 0.82 : 0.25,
          Object.keys(profile.signals).length > 0 ? 0.84 : 0.35,
          observedSignals / totalPossibleSignals,
        ],
        0.35,
      ),
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings,
  };
}
