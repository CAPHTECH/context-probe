import { normalizePatternRuntimeObservations } from "./command-input-loaders-architecture-compat-pattern-runtime.js";
import {
  asNumber,
  asString,
  isRecord,
  toVersion,
  withNumericField,
  withOptionalObject,
  withOptionalString,
} from "./command-input-loaders-architecture-compat-shared.js";
import type { ArchitectureTelemetryExportBundle, ArchitectureTelemetryObservationSet } from "./core/contracts.js";

function sanitizeTelemetryObservationBands(input: unknown): ArchitectureTelemetryObservationSet["bands"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const bandId = asString(entry.bandId);
    const trafficWeight = asNumber(entry.trafficWeight);
    if (!bandId || trafficWeight === undefined) {
      return [];
    }
    return [
      {
        bandId,
        trafficWeight,
        ...withNumericField("LatencyScore", asNumber(entry.LatencyScore)),
        ...withNumericField("ErrorScore", asNumber(entry.ErrorScore)),
        ...withNumericField("SaturationScore", asNumber(entry.SaturationScore)),
      },
    ];
  });
}

function sanitizeTelemetryExportBands(input: unknown): ArchitectureTelemetryExportBundle["bands"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const bandId = asString(entry.bandId);
    const trafficWeight = asNumber(entry.trafficWeight);
    if (!bandId || trafficWeight === undefined) {
      return [];
    }
    return [
      {
        bandId,
        trafficWeight,
        ...withNumericField("latencyP95", asNumber(entry.latencyP95)),
        ...withNumericField("errorRate", asNumber(entry.errorRate)),
        ...withNumericField("saturationRatio", asNumber(entry.saturationRatio)),
        ...withOptionalString("source", asString(entry.source)),
        ...withOptionalString("window", asString(entry.window)),
      },
    ];
  });
}

function telemetryReadinessScore(status: string | undefined, gaps: unknown): number {
  const normalized = (status ?? "").toLowerCase();
  let base =
    normalized === "emitting" || normalized === "observed-in-code"
      ? 0.88
      : normalized === "configured"
        ? 0.74
        : normalized === "configured-not-sampled"
          ? 0.66
          : normalized === "documented-only"
            ? 0.45
            : 0.5;
  const gapCount = Array.isArray(gaps) ? gaps.length : 0;
  base -= Math.min(0.2, gapCount * 0.04);
  return Math.max(0, Math.min(1, base));
}

export function normalizeArchitectureTelemetryObservations(input: unknown): ArchitectureTelemetryObservationSet {
  if (!isRecord(input)) {
    return { version: "1.0", bands: [] };
  }
  if (Array.isArray(input.bands)) {
    return {
      version: toVersion(input),
      bands: sanitizeTelemetryObservationBands(input.bands),
    };
  }

  const sources = Array.isArray(input.sources) ? input.sources.filter(isRecord) : [];
  const observations = Array.isArray(input.observations) ? input.observations.filter(isRecord) : [];
  const candidates = [...sources, ...observations];

  if (candidates.length === 0) {
    return {
      version: toVersion(input),
      bands: [],
    };
  }

  const total = candidates.reduce((sum, candidate) => {
    return sum + telemetryReadinessScore(asString(candidate.status), candidate.gaps);
  }, 0);
  const averageScore = total / candidates.length;

  return {
    version: toVersion(input),
    bands: [
      {
        bandId: "inventory",
        trafficWeight: 1,
        LatencyScore: averageScore,
        ErrorScore: averageScore,
        SaturationScore: averageScore,
      },
    ],
  };
}

export function normalizeArchitectureTelemetryExportBundle(input: unknown): ArchitectureTelemetryExportBundle {
  if (!isRecord(input)) {
    return { version: "1.0", bands: [] };
  }
  if (Array.isArray(input.bands)) {
    return {
      version: toVersion(input),
      bands: sanitizeTelemetryExportBands(input.bands),
      ...withOptionalString("sourceSystem", asString(input.sourceSystem)),
      ...withOptionalObject("patternRuntime", normalizePatternRuntimeObservations(input.patternRuntime)),
      ...withOptionalString("note", asString(input.note)),
    };
  }

  const embeddedExport =
    isRecord(input.contextProbe) && isRecord(input.contextProbe.exportBundle)
      ? input.contextProbe.exportBundle
      : undefined;
  if (isRecord(embeddedExport) && Array.isArray(embeddedExport.bands)) {
    return {
      version: toVersion(embeddedExport),
      bands: sanitizeTelemetryExportBands(embeddedExport.bands),
      ...withOptionalString("sourceSystem", asString(embeddedExport.sourceSystem)),
      ...withOptionalObject("patternRuntime", normalizePatternRuntimeObservations(embeddedExport.patternRuntime)),
      ...withOptionalString("note", asString(embeddedExport.note)),
    };
  }

  const sourceSystem = asString(input.sourceSystem);
  const note = asString(input.note);

  return {
    version: toVersion(input),
    bands: [],
    ...(sourceSystem ? { sourceSystem } : {}),
    ...(note ? { note } : {}),
  };
}
