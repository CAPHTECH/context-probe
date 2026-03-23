import type {
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryRawObservationSet
} from "../core/contracts.js";

export interface ObservationIngestFinding {
  kind:
    | "telemetry_export_band_mapped"
    | "telemetry_export_missing_signal"
    | "telemetry_export_pattern_runtime_embedded"
    | "delivery_export_signal_mapped"
    | "delivery_export_missing_signal";
  confidence: number;
  note: string;
  sourceSystem?: string;
  bandId?: string;
  component?: string;
  observed?: number;
  window?: string;
}

export interface IngestedTelemetryExport {
  telemetryRawObservations: ArchitectureTelemetryRawObservationSet;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet;
  confidence: number;
  unknowns: string[];
  findings: ObservationIngestFinding[];
}

export interface IngestedDeliveryExport {
  deliveryRawObservations: ArchitectureDeliveryRawObservationSet;
  confidence: number;
  unknowns: string[];
  findings: ObservationIngestFinding[];
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

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function ingestTelemetryExportBundle(bundle: ArchitectureTelemetryExportBundle): IngestedTelemetryExport {
  const findings: ObservationIngestFinding[] = [];
  const unknowns: string[] = [];
  const confidenceSignals: number[] = [];

  const bands = bundle.bands.map((band) => {
    const rawBand: ArchitectureTelemetryRawObservationSet["bands"][number] = {
      bandId: band.bandId,
      trafficWeight: band.trafficWeight,
      ...(band.latencyP95 !== undefined ? { latencyP95: band.latencyP95 } : {}),
      ...(band.errorRate !== undefined ? { errorRate: band.errorRate } : {}),
      ...(band.saturationRatio !== undefined ? { saturationRatio: band.saturationRatio } : {})
    };

    const mappings = [
      { component: "latencyP95", observed: band.latencyP95 },
      { component: "errorRate", observed: band.errorRate },
      { component: "saturationRatio", observed: band.saturationRatio }
    ] as const;

    for (const mapping of mappings) {
      if (mapping.observed === undefined) {
        unknowns.push(`The telemetry export for ${band.bandId} is missing ${mapping.component}.`);
        findings.push({
          kind: "telemetry_export_missing_signal",
          confidence: 0.62,
          note: `The telemetry export for ${band.bandId} is missing ${mapping.component}.`,
          bandId: band.bandId,
          component: mapping.component,
          ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {}),
          ...(band.window ? { window: band.window } : {})
        });
        confidenceSignals.push(0.55);
        continue;
      }
      findings.push({
        kind: "telemetry_export_band_mapped",
        confidence: 0.84,
        note: `Imported ${mapping.component} for ${band.bandId} from the telemetry export into raw telemetry input.`,
        bandId: band.bandId,
        component: mapping.component,
        observed: mapping.observed,
        ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {}),
        ...(band.window ? { window: band.window } : {})
      });
      confidenceSignals.push(0.84);
    }

    return rawBand;
  });

  if (bands.length === 0) {
    unknowns.push("The telemetry export bundle has no traffic bands, so CommonOps for OAS is close to unobserved.");
    confidenceSignals.push(0.3);
  }

  if (bundle.patternRuntime) {
    findings.push({
      kind: "telemetry_export_pattern_runtime_embedded",
      confidence: 0.8,
      note: "Pattern runtime observations included in the telemetry export bundle are available.",
      ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {})
    });
    confidenceSignals.push(0.8);
  }

  return {
    telemetryRawObservations: {
      version: bundle.version,
      bands
    },
    ...(bundle.patternRuntime ? { patternRuntimeObservations: bundle.patternRuntime } : {}),
    confidence: clamp01(average(confidenceSignals, 0.6)),
    unknowns: unique(unknowns),
    findings
  };
}

export function ingestDeliveryExportBundle(bundle: ArchitectureDeliveryExportBundle): IngestedDeliveryExport {
  const findings: ObservationIngestFinding[] = [];
  const unknowns: string[] = [];
  const confidenceSignals: number[] = [];
  const measurements = bundle.measurements;

  const mappings = [
    { component: "leadTime", scoreComponent: "LeadTime" as const, observed: measurements.leadTime },
    {
      component: "deployFrequency",
      scoreComponent: "DeployFrequency" as const,
      observed: measurements.deployFrequency
    },
    { component: "recoveryTime", scoreComponent: "RecoveryTime" as const, observed: measurements.recoveryTime },
    {
      component: "changeFailRate",
      scoreComponent: "ChangeFailRate" as const,
      observed: measurements.changeFailRate
    },
    { component: "reworkRate", scoreComponent: "ReworkRate" as const, observed: measurements.reworkRate }
  ] as const;

  for (const mapping of mappings) {
    if (mapping.observed === undefined) {
      unknowns.push(`The delivery export is missing ${mapping.component}.`);
      findings.push({
        kind: "delivery_export_missing_signal",
        confidence: 0.62,
        note: `The delivery export is missing ${mapping.component}.`,
        component: mapping.component,
        ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {})
      });
      confidenceSignals.push(0.55);
      continue;
    }
    findings.push({
      kind: "delivery_export_signal_mapped",
      confidence: 0.84,
      note: `Imported ${mapping.component} from the delivery export into raw delivery input.`,
      component: mapping.component,
      observed: mapping.observed,
      ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {})
    });
    confidenceSignals.push(0.84);
  }

  return {
    deliveryRawObservations: {
      version: bundle.version,
      values: {
        ...(measurements.leadTime !== undefined ? { LeadTime: measurements.leadTime } : {}),
        ...(measurements.deployFrequency !== undefined ? { DeployFrequency: measurements.deployFrequency } : {}),
        ...(measurements.recoveryTime !== undefined ? { RecoveryTime: measurements.recoveryTime } : {}),
        ...(measurements.changeFailRate !== undefined ? { ChangeFailRate: measurements.changeFailRate } : {}),
        ...(measurements.reworkRate !== undefined ? { ReworkRate: measurements.reworkRate } : {})
      },
      ...(bundle.sourceSystem ? { source: bundle.sourceSystem } : {}),
      ...(bundle.note ? { note: bundle.note } : {})
    },
    confidence: clamp01(average(confidenceSignals, 0.6)),
    unknowns: unique(unknowns),
    findings
  };
}
