import type { ArchitectureScoringContext, ComputeArchitectureScoresOptions } from "./architecture-scoring-types.js";
import { toEvidence } from "./response.js";

type EvidenceEntry = ReturnType<typeof toEvidence>;

interface SourceConfigFinding {
  note: string;
  kind: string;
  sourceType: string;
  sourcePath?: string;
  command?: string;
  cwd?: string;
  confidence: number;
}

interface ResolvedSourceLike {
  sourceType: string;
  resolvedPath?: string;
  command?: string;
  confidence?: number;
  findings?: SourceConfigFinding[];
}

function buildSourceConfigEvidence(source: ResolvedSourceLike | undefined, evidenceSource: string): EvidenceEntry[] {
  return (source?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: evidenceSource,
      },
      undefined,
      finding.confidence,
    ),
  );
}

function buildSourceInputEvidence(
  source: ResolvedSourceLike | undefined,
  evidenceSource: string,
  label: string,
  confidence = 0.78,
): EvidenceEntry[] {
  if (!source) {
    return [];
  }

  return [
    toEvidence(
      `Ingested a canonical export from ${label} (${source.sourceType}).`,
      {
        source: evidenceSource,
        sourceType: source.sourceType,
        ...(source.resolvedPath ? { sourcePath: source.resolvedPath } : {}),
        ...(source.command ? { command: source.command } : {}),
      },
      undefined,
      confidence,
    ),
  ];
}

export function buildContractBaselineSourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.contractBaselineSource, "contract_baseline_source");
}

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

export function buildScenarioSourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.scenarioObservationSource, "scenario_observation_source");
}

export function buildTelemetrySourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.telemetrySource, "telemetry_source");
}

export function buildDeliverySourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.deliverySource, "delivery_source");
}

export function buildComplexitySourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.complexitySource, "complexity_source");
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
