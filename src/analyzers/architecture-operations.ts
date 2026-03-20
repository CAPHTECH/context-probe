import type {
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureTelemetryObservationSet
} from "../core/contracts.js";

export interface OperationalAdequacyFinding {
  kind:
    | "missing_band_signal"
    | "weak_common_ops"
    | "missing_pattern_runtime"
    | "weak_pattern_runtime";
  confidence: number;
  note: string;
  bandId?: string;
  component?: "LatencyScore" | "ErrorScore" | "SaturationScore";
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

function weightedAverage(
  entries: Array<{ value: number | undefined; weight: number }>,
  fallback: number
): number {
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
        value: band.LatencyScore
      },
      {
        component: "ErrorScore" as const,
        weight: 0.35,
        value: band.ErrorScore
      },
      {
        component: "SaturationScore" as const,
        weight: 0.2,
        value: band.SaturationScore
      }
    ];
    const bandCoverage = signalEntries.reduce((sum, entry) => sum + (entry.value !== undefined ? entry.weight : 0), 0);
    const bandScore = weightedAverage(
      signalEntries.map((entry) => ({
        value: entry.value,
        weight: entry.weight
      })),
      0.5
    );
    const trafficWeight = Math.max(0, band.trafficWeight);

    weightedBandScore += bandScore * trafficWeight;
    weightedCoverage += bandCoverage * trafficWeight;

    for (const entry of signalEntries) {
      if (entry.value !== undefined) {
        continue;
      }
      unknowns.push(`${band.bandId} の ${entry.component} が不足しており CommonOps は部分的な近似です`);
      findings.push({
        kind: "missing_band_signal",
        bandId: band.bandId,
        component: entry.component,
        confidence: 0.66,
        note: `${band.bandId} の ${entry.component} が不足しています`
      });
    }

    if (bandScore < 0.6) {
      findings.push({
        kind: "weak_common_ops",
        bandId: band.bandId,
        confidence: 0.8,
        note: `${band.bandId} の common operations score が ${bandScore.toFixed(3)} と低く、運用時挙動が不安定です`
      });
    }
  }

  const CommonOps = totalTrafficWeight > 0 ? clamp01(weightedBandScore / totalTrafficWeight) : 0.5;
  const weightedBandCoverage = totalTrafficWeight > 0 ? clamp01(weightedCoverage / totalTrafficWeight) : 0;

  if (bands.length === 0) {
    unknowns.push("telemetry observations が指定されていないため CommonOps は中立値 0.5 を使っています");
  } else if (weightedBandCoverage < 1) {
    unknowns.push("traffic band の一部 signal が欠けており CommonOps は部分的な近似です");
  }

  let patternRuntimeSourceConfidence = 0.35;
  let PatternRuntime = 0.5;
  if (input.patternRuntime?.score !== undefined) {
    PatternRuntime = clamp01(input.patternRuntime.score);
    patternRuntimeSourceConfidence = 0.86;
  } else if (input.topologyIsolationBridge !== undefined) {
    PatternRuntime = clamp01(input.topologyIsolationBridge);
    patternRuntimeSourceConfidence = 0.62;
    unknowns.push("pattern runtime observations が指定されていないため PatternRuntime は TIS bridge を使っています");
    findings.push({
      kind: "missing_pattern_runtime",
      confidence: 0.68,
      note: "pattern runtime observation が不足しているため TIS bridge を PatternRuntime に利用しています"
    });
  } else {
    unknowns.push("pattern runtime observations が指定されていないため PatternRuntime は中立値 0.5 を使っています");
    findings.push({
      kind: "missing_pattern_runtime",
      confidence: 0.62,
      note: "pattern runtime observation が不足しているため PatternRuntime は未観測に近い状態です"
    });
  }

  if (PatternRuntime < 0.6) {
    findings.push({
      kind: "weak_pattern_runtime",
      confidence: 0.78,
      note: `PatternRuntime score が ${PatternRuntime.toFixed(3)} と低く、pattern-specific runtime adequacy が弱い状態です`
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
          patternRuntimeSourceConfidence
        ],
        0.35
      )
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings
  };
}
