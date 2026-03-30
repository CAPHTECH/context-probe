import type {
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryRawObservationSet,
} from "../core/contracts.js";
import { average, clamp01, type ObservationIngestFinding, unique } from "./architecture-observation-ingest-shared.js";

export interface IngestedTelemetryExport {
  telemetryRawObservations: ArchitectureTelemetryRawObservationSet;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet;
  confidence: number;
  unknowns: string[];
  findings: ObservationIngestFinding[];
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
      ...(band.saturationRatio !== undefined ? { saturationRatio: band.saturationRatio } : {}),
    };

    const mappings = [
      { component: "latencyP95", observed: band.latencyP95 },
      { component: "errorRate", observed: band.errorRate },
      { component: "saturationRatio", observed: band.saturationRatio },
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
          ...(band.window ? { window: band.window } : {}),
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
        ...(band.window ? { window: band.window } : {}),
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
      ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {}),
    });
    confidenceSignals.push(0.8);
  }

  return {
    telemetryRawObservations: {
      version: bundle.version,
      bands,
    },
    ...(bundle.patternRuntime ? { patternRuntimeObservations: bundle.patternRuntime } : {}),
    confidence: clamp01(average(confidenceSignals, 0.6)),
    unknowns: unique(unknowns),
    findings,
  };
}
