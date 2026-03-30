import { normalizeDeliveryObservations } from "../analyzers/architecture-delivery-normalization.js";
import {
  ingestDeliveryExportBundle,
  ingestTelemetryExportBundle,
} from "../analyzers/architecture-observation-ingest.js";
import { scoreOperationalAdequacy } from "../analyzers/architecture-operations.js";
import { normalizePatternRuntimeObservations } from "../analyzers/architecture-pattern-runtime-normalization.js";
import { normalizeTelemetryObservations } from "../analyzers/architecture-telemetry-normalization.js";
import type {
  ComputeArchitectureScoresOptions,
  DeliveryExportIngestResult,
  DeliveryNormalizationResult,
  OperationsScore,
  PatternRuntimeNormalizationResult,
  TelemetryExportIngestResult,
  TelemetryNormalizationResult,
} from "./architecture-scoring-types.js";

export interface ArchitectureScoringObservabilityResults {
  telemetryExportIngestResult?: TelemetryExportIngestResult;
  patternRuntimeNormalizationResult?: PatternRuntimeNormalizationResult;
  telemetryNormalizationResult?: TelemetryNormalizationResult;
  operationsScore: OperationsScore;
  deliveryExportIngestResult?: DeliveryExportIngestResult;
  deliveryNormalizationResult?: DeliveryNormalizationResult;
  usablePatternRuntimeRaw: boolean;
}

export function resolveArchitectureScoringObservabilityInputs(
  options: ComputeArchitectureScoresOptions,
  topologyValue: number,
): ArchitectureScoringObservabilityResults {
  const telemetryExportBundle = options.telemetryExport ?? options.telemetrySource?.data;
  const telemetryExportIngestResult = telemetryExportBundle
    ? ingestTelemetryExportBundle(telemetryExportBundle)
    : undefined;
  const usableTelemetryRaw = Boolean(options.telemetryRawObservations && options.telemetryNormalizationProfile);
  const usablePatternRuntimeRaw = Boolean(
    options.patternRuntimeRawObservations && options.patternRuntimeNormalizationProfile,
  );
  const patternRuntimeNormalizationResult = options.patternRuntimeObservations
    ? undefined
    : options.patternRuntimeRawObservations || options.patternRuntimeNormalizationProfile
      ? normalizePatternRuntimeObservations({
          ...(options.patternRuntimeRawObservations ? { raw: options.patternRuntimeRawObservations } : {}),
          ...(options.patternRuntimeNormalizationProfile
            ? { profile: options.patternRuntimeNormalizationProfile }
            : {}),
        })
      : undefined;
  const telemetryRawInput = options.telemetryObservations
    ? undefined
    : usableTelemetryRaw
      ? options.telemetryRawObservations
      : telemetryExportBundle
        ? telemetryExportIngestResult?.telemetryRawObservations
        : options.telemetryRawObservations;
  const patternRuntimeInput =
    options.patternRuntimeObservations ??
    (usablePatternRuntimeRaw ? patternRuntimeNormalizationResult?.patternRuntimeObservations : undefined) ??
    telemetryExportIngestResult?.patternRuntimeObservations;
  const telemetryNormalizationResult = options.telemetryObservations
    ? undefined
    : telemetryRawInput || options.telemetryNormalizationProfile
      ? normalizeTelemetryObservations({
          ...(telemetryRawInput ? { raw: telemetryRawInput } : {}),
          ...(options.telemetryNormalizationProfile ? { profile: options.telemetryNormalizationProfile } : {}),
        })
      : undefined;
  const operationsScore = scoreOperationalAdequacy({
    ...(options.telemetryObservations
      ? { telemetry: options.telemetryObservations }
      : telemetryNormalizationResult
        ? { telemetry: telemetryNormalizationResult.telemetry }
        : {}),
    ...(patternRuntimeInput ? { patternRuntime: patternRuntimeInput } : {}),
    topologyIsolationBridge: topologyValue,
  });

  const deliveryExportBundle = options.deliveryExport ?? options.deliverySource?.data;
  const deliveryExportIngestResult = deliveryExportBundle
    ? ingestDeliveryExportBundle(deliveryExportBundle)
    : undefined;
  const usableDeliveryRaw = Boolean(options.deliveryRawObservations && options.deliveryNormalizationProfile);
  const deliveryRawInput = options.deliveryObservations
    ? undefined
    : usableDeliveryRaw
      ? options.deliveryRawObservations
      : deliveryExportBundle
        ? deliveryExportIngestResult?.deliveryRawObservations
        : options.deliveryRawObservations;
  const deliveryNormalizationResult = options.deliveryObservations
    ? undefined
    : deliveryRawInput || options.deliveryNormalizationProfile
      ? normalizeDeliveryObservations({
          ...(deliveryRawInput ? { raw: deliveryRawInput } : {}),
          ...(options.deliveryNormalizationProfile ? { profile: options.deliveryNormalizationProfile } : {}),
        })
      : undefined;

  return {
    operationsScore,
    ...(telemetryExportIngestResult ? { telemetryExportIngestResult } : {}),
    ...(patternRuntimeNormalizationResult ? { patternRuntimeNormalizationResult } : {}),
    ...(telemetryNormalizationResult ? { telemetryNormalizationResult } : {}),
    ...(deliveryExportIngestResult ? { deliveryExportIngestResult } : {}),
    ...(deliveryNormalizationResult ? { deliveryNormalizationResult } : {}),
    usablePatternRuntimeRaw,
  };
}
