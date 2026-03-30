import type { ArchitectureTelemetryObservationSet } from "../core/contracts.js";

export interface CommonOpsFinding {
  kind: "missing_band_signal" | "weak_common_ops";
  confidence: number;
  note: string;
  bandId?: string;
  component?: "LatencyScore" | "ErrorScore" | "SaturationScore";
}

export interface CommonOpsScoreResult {
  CommonOps: number;
  bandCount: number;
  weightedBandCoverage: number;
  unknowns: string[];
  findings: CommonOpsFinding[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
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

export function scoreCommonOperations(
  telemetry: ArchitectureTelemetryObservationSet | undefined,
): CommonOpsScoreResult {
  const findings: CommonOpsFinding[] = [];
  const unknowns: string[] = [];
  const bands = telemetry?.bands ?? [];
  const totalTrafficWeight = bands.reduce((sum, band) => sum + Math.max(0, band.trafficWeight), 0);

  let weightedBandScore = 0;
  let weightedCoverage = 0;
  for (const band of bands) {
    const signalEntries = [
      { component: "LatencyScore" as const, weight: 0.45, value: band.LatencyScore },
      { component: "ErrorScore" as const, weight: 0.35, value: band.ErrorScore },
      { component: "SaturationScore" as const, weight: 0.2, value: band.SaturationScore },
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

  return {
    CommonOps,
    bandCount: bands.length,
    weightedBandCoverage,
    unknowns: uniqueUnknowns(unknowns),
    findings,
  };
}
