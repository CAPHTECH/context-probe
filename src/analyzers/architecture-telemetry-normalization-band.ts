import type {
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
} from "../core/contracts.js";

import { normalizeObservedValue } from "./architecture-observation-normalization-shared.js";
import type {
  NormalizedTelemetryResult,
  TelemetryNormalizationFinding,
} from "./architecture-telemetry-normalization-shared.js";
import { buildTelemetryBandMappings } from "./architecture-telemetry-normalization-spec.js";

export function buildEmptyTelemetryNormalizationResult(
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

export function normalizeTelemetryBand(input: {
  band: ArchitectureTelemetryRawObservationSet["bands"][number];
  profile: ArchitectureTelemetryNormalizationProfile;
  findings: TelemetryNormalizationFinding[];
  unknowns: string[];
}): ArchitectureTelemetryObservationSet["bands"][number] {
  const { band, profile, findings, unknowns } = input;
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

export function countNormalizedTelemetryBand(band: ArchitectureTelemetryObservationSet["bands"][number]): number {
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
