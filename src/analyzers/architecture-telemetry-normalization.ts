import type {
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  ScenarioDirection
} from "../core/contracts.js";

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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeObservedValue(input: {
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

function uniqueUnknowns(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function normalizeTelemetryObservations(input: {
  raw?: ArchitectureTelemetryRawObservationSet;
  profile?: ArchitectureTelemetryNormalizationProfile;
}): NormalizedTelemetryResult {
  const findings: TelemetryNormalizationFinding[] = [];
  const unknowns: string[] = [];
  const rawBands = input.raw?.bands ?? [];
  const profile = input.profile;

  if (rawBands.length === 0) {
    return {
      telemetry: {
        version: "1.0",
        bands: []
      },
      confidence: 0.25,
      unknowns: ["No telemetry raw observations were provided, so raw normalization is unobserved."],
      findings
    };
  }

  if (!profile) {
    return {
      telemetry: {
        version: "1.0",
        bands: rawBands.map((band) => ({
          bandId: band.bandId,
          trafficWeight: band.trafficWeight
        }))
      },
      confidence: 0.3,
      unknowns: ["No telemetry normalization profile was provided, so raw telemetry cannot be scored."],
      findings
    };
  }

  let observedSignals = 0;
  const normalizedBands = rawBands.map((band) => {
    const normalizedBand: ArchitectureTelemetryObservationSet["bands"][number] = {
      bandId: band.bandId,
      trafficWeight: band.trafficWeight
    };
    const mappings = [
      {
        component: "LatencyScore" as const,
        observed: band.latencyP95,
        rule: profile.signals.LatencyScore
      },
      {
        component: "ErrorScore" as const,
        observed: band.errorRate,
        rule: profile.signals.ErrorScore
      },
      {
        component: "SaturationScore" as const,
        observed: band.saturationRatio,
        rule: profile.signals.SaturationScore
      }
    ];

    for (const mapping of mappings) {
      if (!mapping.rule) {
        unknowns.push(`${band.bandId} is missing a normalization rule for ${mapping.component}.`);
        findings.push({
          kind: "missing_normalization_rule",
          bandId: band.bandId,
          component: mapping.component,
          confidence: 0.58,
          note: `${band.bandId} has no rule to normalize ${mapping.component}.`
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
          note: `${band.bandId} is missing the raw ${mapping.component} signal.`
        });
        continue;
      }

      const normalized = normalizeObservedValue({
        direction: mapping.rule.direction,
        observed: mapping.observed,
        target: mapping.rule.target,
        worstAcceptable: mapping.rule.worstAcceptable
      });
      normalizedBand[mapping.component] = normalized;
      observedSignals += 1;
      findings.push({
        kind: "normalized_signal",
        bandId: band.bandId,
        component: mapping.component,
        observed: mapping.observed,
        normalized,
        confidence: 0.86,
        note: `${band.bandId} normalized ${mapping.component} from raw telemetry to ${normalized.toFixed(3)}.`
      });
    }

    return normalizedBand;
  });

  const totalPossibleSignals = Math.max(1, rawBands.length * 3);

  return {
    telemetry: {
      version: "1.0",
      bands: normalizedBands
    },
    confidence: clamp01(
      average(
        [
          rawBands.length > 0 ? 0.82 : 0.25,
          Object.keys(profile.signals).length > 0 ? 0.84 : 0.35,
          observedSignals / totalPossibleSignals
        ],
        0.35
      )
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings
  };
}
