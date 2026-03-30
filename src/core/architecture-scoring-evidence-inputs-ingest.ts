import type { EvidenceEntry } from "./architecture-scoring-evidence-inputs-shared.js";
import { buildSourceInputEvidence } from "./architecture-scoring-evidence-inputs-shared.js";
import type { ArchitectureScoringContext, ComputeArchitectureScoresOptions } from "./architecture-scoring-types.js";
import { toEvidence } from "./response.js";

export function buildContractBaselineInputEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  if (!options.contractBaseline && !options.contractBaselineSource) {
    return [];
  }

  return [
    toEvidence(
      `Using a contract baseline for IPS delta comparison${
        options.contractBaselineSource ? ` (${options.contractBaselineSource.sourceType} source)` : ""
      }.`,
      {
        source: "contract_baseline",
        ...(options.contractBaselineSource?.resolvedPath
          ? { sourcePath: options.contractBaselineSource.resolvedPath }
          : {}),
        ...(options.contractBaselineSource?.command ? { command: options.contractBaselineSource.command } : {}),
      },
      undefined,
      options.contractBaselineSource?.confidence ?? 0.82,
    ),
  ];
}

export function buildDeliveryInputEvidence(
  options: ComputeArchitectureScoresOptions,
  context: ArchitectureScoringContext,
): EvidenceEntry[] {
  if (options.deliveryObservations) {
    return [
      toEvidence(
        "Using the normalized scores from delivery observations as-is.",
        { source: "normalized_input" },
        undefined,
        0.84,
      ),
    ];
  }
  if (options.deliveryRawObservations) {
    return [
      toEvidence(
        "Using raw delivery observations after scoring them through the normalization profile.",
        { source: "raw_normalized" },
        undefined,
        0.82,
      ),
    ];
  }
  if (options.deliveryExport) {
    return [
      toEvidence(
        "Ingested the delivery export as the delivery input for EES.",
        { source: "delivery_export" },
        undefined,
        0.8,
      ),
    ];
  }
  if (options.deliverySource) {
    return buildSourceInputEvidence(options.deliverySource, "delivery_source", "delivery source", 0.78);
  }
  if (context.deliveryNormalizationResult) {
    return [
      toEvidence(
        "Using raw delivery observations after scoring them through the normalization profile.",
        { source: "raw_normalized" },
        undefined,
        0.82,
      ),
    ];
  }
  return [];
}

export function buildTelemetryInputEvidence(
  options: ComputeArchitectureScoresOptions,
  context: ArchitectureScoringContext,
): EvidenceEntry[] {
  if (options.telemetryObservations) {
    return [
      toEvidence(
        "Using the normalized scores from telemetry observations as-is.",
        { source: "normalized_input" },
        undefined,
        0.84,
      ),
    ];
  }
  if (options.telemetryRawObservations) {
    return [
      toEvidence(
        "Using raw telemetry observations after scoring them through the normalization profile.",
        { source: "raw_normalized" },
        undefined,
        0.82,
      ),
    ];
  }
  if (options.telemetryExport) {
    return [
      toEvidence(
        "Ingested the telemetry export as the CommonOps input for OAS.",
        { source: "telemetry_export" },
        undefined,
        0.8,
      ),
    ];
  }
  if (options.telemetrySource) {
    return buildSourceInputEvidence(options.telemetrySource, "telemetry_source", "telemetry source", 0.78);
  }
  if (context.telemetryNormalizationResult) {
    return [
      toEvidence(
        "Using raw telemetry observations after scoring them through the normalization profile.",
        { source: "raw_normalized" },
        undefined,
        0.82,
      ),
    ];
  }
  return [];
}
