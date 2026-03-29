import type {
  ArchitecturePatternFamily,
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureTelemetryObservationSet,
} from "../core/contracts.js";
import { type PatternRuntimeSource, scorePatternRuntime } from "./architecture-pattern-runtime.js";

export interface OperationalAdequacyFinding {
  kind:
    | "missing_band_signal"
    | "weak_common_ops"
    | "missing_pattern_runtime"
    | "weak_pattern_runtime"
    | "pattern_runtime_signal_missing"
    | "pattern_runtime_family_mismatch"
    | "pattern_runtime_multiple_blocks"
    | "pattern_runtime_legacy_overridden"
    | "pattern_runtime_legacy_used"
    | "pattern_runtime_tis_bridge"
    | "pattern_runtime_neutral";
  confidence: number;
  note: string;
  bandId?: string;
  component?: "LatencyScore" | "ErrorScore" | "SaturationScore";
  patternFamily?: ArchitecturePatternFamily;
  signal?: string;
  source?: PatternRuntimeSource;
}

export interface OperationalAdequacyScore {
  CommonOps: number;
  PatternRuntime: number;
  bandCount: number;
  weightedBandCoverage: number;
  confidence: number;
  unknowns: string[];
  findings: OperationalAdequacyFinding[];
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

function weightedAverage(entries: Array<{ value: number | undefined; weight: number }>, fallback: number): number {
  const observed = entries.filter((entry) => entry.value !== undefined && Number.isFinite(entry.value));
  if (observed.length === 0) {
    return fallback;
  }
  const totalWeight = observed.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return fallback;
  }
  return observed.reduce((sum, entry) => sum + (entry.value ?? 0) * entry.weight, 0) / totalWeight;
}

function uniqueUnknowns(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function scoreOperationalAdequacy(input: {
  telemetry?: ArchitectureTelemetryObservationSet;
  patternRuntime?: ArchitecturePatternRuntimeObservationSet;
  topologyIsolationBridge?: number;
}): OperationalAdequacyScore {
  const findings: OperationalAdequacyFinding[] = [];
  const unknowns: string[] = [];

  const bands = input.telemetry?.bands ?? [];
  const totalTrafficWeight = bands.reduce((sum, band) => sum + Math.max(0, band.trafficWeight), 0);

  let weightedBandScore = 0;
  let weightedCoverage = 0;
  for (const band of bands) {
    const signalEntries = [
      {
        component: "LatencyScore" as const,
        weight: 0.45,
        value: band.LatencyScore,
      },
      {
        component: "ErrorScore" as const,
        weight: 0.35,
        value: band.ErrorScore,
      },
      {
        component: "SaturationScore" as const,
        weight: 0.2,
        value: band.SaturationScore,
      },
    ];
    const bandCoverage = signalEntries.reduce((sum, entry) => sum + (entry.value !== undefined ? entry.weight : 0), 0);
    const bandScore = weightedAverage(
      signalEntries.map((entry) => ({
        value: entry.value,
        weight: entry.weight,
      })),
      0.5,
    );
    const trafficWeight = Math.max(0, band.trafficWeight);

    weightedBandScore += bandScore * trafficWeight;
    weightedCoverage += bandCoverage * trafficWeight;

    for (const entry of signalEntries) {
      if (entry.value !== undefined) {
        continue;
      }
      unknowns.push(`${band.bandId} is missing ${entry.component}, so CommonOps is only a partial approximation.`);
      findings.push({
        kind: "missing_band_signal",
        bandId: band.bandId,
        component: entry.component,
        confidence: 0.66,
        note: `${band.bandId} is missing ${entry.component}.`,
      });
    }

    if (bandScore < 0.6) {
      findings.push({
        kind: "weak_common_ops",
        bandId: band.bandId,
        confidence: 0.8,
        note: `${band.bandId} has a low common-operations score (${bandScore.toFixed(3)}), so runtime behavior is unstable.`,
      });
    }
  }

  const CommonOps = totalTrafficWeight > 0 ? clamp01(weightedBandScore / totalTrafficWeight) : 0.5;
  const weightedBandCoverage = totalTrafficWeight > 0 ? clamp01(weightedCoverage / totalTrafficWeight) : 0;

  if (bands.length === 0) {
    unknowns.push("No telemetry observations were provided, so CommonOps is using the neutral value 0.5.");
  } else if (weightedBandCoverage < 1) {
    unknowns.push("Some traffic-band signals are missing, so CommonOps is only a partial approximation.");
  }

  const patternRuntimeScore = scorePatternRuntime({
    ...(input.patternRuntime ? { observations: input.patternRuntime } : {}),
    ...(input.topologyIsolationBridge !== undefined ? { topologyIsolationBridge: input.topologyIsolationBridge } : {}),
  });
  const patternRuntimeSourceConfidence = patternRuntimeScore.confidence;
  const PatternRuntime = patternRuntimeScore.value;
  unknowns.push(...patternRuntimeScore.unknowns);
  findings.push(
    ...patternRuntimeScore.findings.map((finding) => {
      const kind: OperationalAdequacyFinding["kind"] =
        finding.kind === "pattern_runtime_tis_bridge" || finding.kind === "pattern_runtime_neutral"
          ? "missing_pattern_runtime"
          : finding.kind;
      const mapped: OperationalAdequacyFinding = {
        kind,
        confidence: finding.confidence,
        note: finding.note,
      };
      if (finding.patternFamily) {
        mapped.patternFamily = finding.patternFamily;
      }
      if (finding.signal) {
        mapped.signal = finding.signal;
      }
      if (finding.source) {
        mapped.source = finding.source;
      }
      return mapped;
    }),
  );

  if (PatternRuntime < 0.6) {
    findings.push({
      kind: "weak_pattern_runtime",
      confidence: 0.78,
      note: `PatternRuntime is low at ${PatternRuntime.toFixed(3)}, so pattern-specific runtime adequacy is weak.`,
      ...(patternRuntimeScore.patternFamily ? { patternFamily: patternRuntimeScore.patternFamily } : {}),
      source: patternRuntimeScore.source,
    });
  }

  return {
    CommonOps,
    PatternRuntime,
    bandCount: bands.length,
    weightedBandCoverage,
    confidence: clamp01(
      average(
        [
          bands.length > 0 ? 0.82 : 0.35,
          bands.length > 0 ? 0.45 + weightedBandCoverage * 0.4 : 0.35,
          patternRuntimeSourceConfidence,
        ],
        0.35,
      ),
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings,
  };
}
