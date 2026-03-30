import type {
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
} from "../core/contracts.js";
import {
  average,
  clamp01,
  normalizeObservedValue,
  uniqueUnknowns,
} from "./architecture-observation-normalization-shared.js";
import type {
  NormalizedTelemetryResult,
  TelemetryNormalizationFinding,
} from "./architecture-telemetry-normalization-shared.js";
import { buildTelemetryBandMappings } from "./architecture-telemetry-normalization-spec.js";

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

  let observedSignals = 0;
  const normalizedBands = rawBands.map((band) =>
    normalizeTelemetryBand({ band, profile, findings, unknowns, observedSignalsRef: { value: observedSignals } }),
  );
  observedSignals = normalizedBands.reduce((total, band) => total + countNormalizedTelemetryBand(band), 0);
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

function buildEmptyTelemetryNormalizationResult(
  unknown: string,
  confidence: number,
  findings: TelemetryNormalizationFinding[],
  rawBands: ArchitectureTelemetryRawObservationSet["bands"] = [],
): NormalizedTelemetryResult {
  return {
    telemetry: {
      version: "1.0",
      bands: rawBands.map((band) => ({
        bandId: band.bandId,
        trafficWeight: band.trafficWeight,
      })),
    },
    confidence,
    unknowns: [unknown],
    findings,
  };
}

function normalizeTelemetryBand(input: {
  band: ArchitectureTelemetryRawObservationSet["bands"][number];
  profile: ArchitectureTelemetryNormalizationProfile;
  findings: TelemetryNormalizationFinding[];
  unknowns: string[];
  observedSignalsRef: { value: number };
}): ArchitectureTelemetryObservationSet["bands"][number] {
  const { band, profile, findings, unknowns, observedSignalsRef } = input;
  const normalizedBand: ArchitectureTelemetryObservationSet["bands"][number] = {
    bandId: band.bandId,
    trafficWeight: band.trafficWeight,
  };
  const mappings = buildTelemetryBandMappings({ band, profile });

  for (const mapping of mappings) {
    if (!mapping.rule) {
      unknowns.push(`${band.bandId} is missing a normalization rule for ${mapping.component}.`);
      findings.push({
        kind: "missing_normalization_rule",
        bandId: band.bandId,
        component: mapping.component,
        confidence: 0.58,
        note: `${band.bandId} has no rule to normalize ${mapping.component}.`,
      });
      continue;
    }
    if (mapping.observed === undefined) {
      unknowns.push(`${band.bandId} is missing the raw ${mapping.component} signal.`);
      findings.push({
        kind: "missing_raw_signal",
        bandId: band.bandId,
        component: mapping.component,
        confidence: 0.62,
        note: `${band.bandId} is missing the raw ${mapping.component} signal.`,
      });
      continue;
    }

    const normalized = normalizeObservedValue({
      direction: mapping.rule.direction,
      observed: mapping.observed,
      target: mapping.rule.target,
      worstAcceptable: mapping.rule.worstAcceptable,
    });
    normalizedBand[mapping.component] = normalized;
    observedSignalsRef.value += 1;
    findings.push({
      kind: "normalized_signal",
      bandId: band.bandId,
      component: mapping.component,
      observed: mapping.observed,
      normalized,
      confidence: 0.86,
      note: `${band.bandId} normalized ${mapping.component} from raw telemetry to ${normalized.toFixed(3)}.`,
    });
  }

  return normalizedBand;
}

function countNormalizedTelemetryBand(band: ArchitectureTelemetryObservationSet["bands"][number]): number {
  let count = 0;
  if (band.LatencyScore !== undefined) {
    count += 1;
  }
  if (band.ErrorScore !== undefined) {
    count += 1;
  }
  if (band.SaturationScore !== undefined) {
    count += 1;
  }
  return count;
}
