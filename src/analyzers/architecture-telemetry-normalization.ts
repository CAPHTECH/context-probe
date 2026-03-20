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
      unknowns: ["telemetry raw observations が指定されていないため raw normalization は未観測です"],
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
      unknowns: ["telemetry normalization profile が指定されていないため raw telemetry を score 化できません"],
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
        unknowns.push(`${band.bandId} の ${mapping.component} 用 normalization rule が不足しています`);
        findings.push({
          kind: "missing_normalization_rule",
          bandId: band.bandId,
          component: mapping.component,
          confidence: 0.58,
          note: `${band.bandId} の ${mapping.component} を正規化する rule がありません`
        });
        continue;
      }
      if (mapping.observed === undefined) {
        unknowns.push(`${band.bandId} の raw ${mapping.component} signal が不足しています`);
        findings.push({
          kind: "missing_raw_signal",
          bandId: band.bandId,
          component: mapping.component,
          confidence: 0.62,
          note: `${band.bandId} の raw ${mapping.component} signal が不足しています`
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
        note: `${band.bandId} の ${mapping.component} を raw telemetry から ${normalized.toFixed(3)} に正規化しました`
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
