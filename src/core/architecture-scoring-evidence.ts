import type { ArchitectureScoringContext, ComputeArchitectureScoresOptions } from "./architecture-scoring-types.js";
import { toEvidence } from "./response.js";

type EvidenceEntry = ReturnType<typeof toEvidence>;

export interface ArchitectureEvidenceBundle {
  direction: EvidenceEntry[];
  purity: EvidenceEntry[];
  protocol: EvidenceEntry[];
  contractBaselineSource: EvidenceEntry[];
  contractBaselineInput: EvidenceEntry[];
  scenario: EvidenceEntry[];
  scenarioSource: EvidenceEntry[];
  topology: EvidenceEntry[];
  operations: EvidenceEntry[];
  telemetrySource: EvidenceEntry[];
  telemetryNormalization: EvidenceEntry[];
  patternRuntimeNormalization: EvidenceEntry[];
  telemetryExport: EvidenceEntry[];
  deliverySource: EvidenceEntry[];
  deliveryNormalization: EvidenceEntry[];
  complexitySource: EvidenceEntry[];
  deliveryExport: EvidenceEntry[];
  complexityExport: EvidenceEntry[];
  complexity: EvidenceEntry[];
  evolution: EvidenceEntry[];
  deliveryInput: EvidenceEntry[];
  telemetryInput: EvidenceEntry[];
}

export function buildArchitectureEvidence(
  options: ComputeArchitectureScoresOptions,
  context: ArchitectureScoringContext,
): ArchitectureEvidenceBundle {
  const direction = context.violations.map((violation) =>
    toEvidence(
      `${violation.sourceLayer} -> ${violation.targetLayer} direction violation`,
      {
        source: violation.source,
        target: violation.target,
      },
      undefined,
      0.95,
    ),
  );
  const purity = context.purityScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        path: finding.path,
        ...(finding.source ? { source: finding.source } : {}),
        ...(finding.target ? { target: finding.target } : {}),
        ...(finding.sourceLayer ? { sourceLayer: finding.sourceLayer } : {}),
        ...(finding.targetLayer ? { targetLayer: finding.targetLayer } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
  const protocol = context.protocolScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        path: finding.path,
        ...(finding.symbol ? { symbol: finding.symbol } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
  const contractBaselineSource = (options.contractBaselineSource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "contract_baseline_source",
      },
      undefined,
      finding.confidence,
    ),
  );
  const contractBaselineInput =
    options.contractBaseline || options.contractBaselineSource
      ? [
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
        ]
      : [];
  const scenario = context.scenarioScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        scenarioId: finding.scenarioId,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
        source: finding.source,
      },
      undefined,
      finding.confidence,
    ),
  );
  const scenarioSource = (options.scenarioObservationSource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "scenario_observation_source",
      },
      undefined,
      finding.confidence,
    ),
  );
  const topology = context.topologyScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.nodeId ? { nodeId: finding.nodeId } : {}),
        ...(finding.source ? { source: finding.source } : {}),
        ...(finding.target ? { target: finding.target } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
  const operations = context.operationsScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.bandId ? { bandId: finding.bandId } : {}),
        ...(finding.component ? { component: finding.component } : {}),
        ...(finding.patternFamily ? { patternFamily: finding.patternFamily } : {}),
        ...(finding.signal ? { signal: finding.signal } : {}),
        ...(finding.source ? { source: finding.source } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
  const telemetrySource = (options.telemetrySource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "telemetry_source",
      },
      undefined,
      finding.confidence,
    ),
  );
  const telemetryNormalization = (context.telemetryNormalizationResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        bandId: finding.bandId,
        component: finding.component,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
  const patternRuntimeNormalization = (context.patternRuntimeNormalizationResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        block: finding.block,
        rawSignal: finding.rawSignal,
        scoreSignal: finding.scoreSignal,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
        source: "pattern_runtime_raw_normalized",
      },
      undefined,
      finding.confidence,
    ),
  );
  const telemetryExport = (context.telemetryExportIngestResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.bandId ? { bandId: finding.bandId } : {}),
        ...(finding.component ? { component: finding.component } : {}),
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.sourceSystem ? { sourceSystem: finding.sourceSystem } : {}),
        ...(finding.window ? { window: finding.window } : {}),
        source: "telemetry_export",
      },
      undefined,
      finding.confidence,
    ),
  );
  const deliverySource = (options.deliverySource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "delivery_source",
      },
      undefined,
      finding.confidence,
    ),
  );
  const deliveryNormalization = (context.deliveryNormalizationResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        component: finding.component,
        scoreComponent: finding.scoreComponent,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
        source: "raw_normalized",
      },
      undefined,
      finding.confidence,
    ),
  );
  const complexitySource = (options.complexitySource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "complexity_source",
      },
      undefined,
      finding.confidence,
    ),
  );
  const deliveryExport = (context.deliveryExportIngestResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.component ? { component: finding.component } : {}),
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.sourceSystem ? { sourceSystem: finding.sourceSystem } : {}),
        source: "delivery_export",
      },
      undefined,
      finding.confidence,
    ),
  );
  const complexityExport = (context.complexityExportIngestResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        component: finding.component,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.sourceSystem ? { sourceSystem: finding.sourceSystem } : {}),
        source: "complexity_export",
      },
      undefined,
      finding.confidence,
    ),
  );
  const complexity = context.complexityScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        component: finding.component,
        observed: finding.observed,
        normalized: finding.normalized,
        source: finding.source,
      },
      undefined,
      finding.confidence,
    ),
  );
  const evolution = context.evolutionLocalityScore.findings
    .concat(context.evolutionEfficiencyScore.findings)
    .map((finding) =>
      toEvidence(
        finding.note,
        {
          kind: finding.kind,
          ...(finding.commitHash ? { commitHash: finding.commitHash } : {}),
          ...(finding.component ? { component: finding.component } : {}),
        },
        undefined,
        finding.confidence,
      ),
    );
  const deliveryInput = options.deliveryObservations
    ? [
        toEvidence(
          "Using the normalized scores from delivery observations as-is.",
          { source: "normalized_input" },
          undefined,
          0.84,
        ),
      ]
    : options.deliveryRawObservations
      ? [
          toEvidence(
            "Using raw delivery observations after scoring them through the normalization profile.",
            { source: "raw_normalized" },
            undefined,
            0.82,
          ),
        ]
      : options.deliveryExport
        ? [
            toEvidence(
              "Ingested the delivery export as the delivery input for EES.",
              { source: "delivery_export" },
              undefined,
              0.8,
            ),
          ]
        : options.deliverySource
          ? [
              toEvidence(
                `Ingested a canonical export from delivery source (${options.deliverySource.sourceType}).`,
                {
                  source: "delivery_source",
                  sourceType: options.deliverySource.sourceType,
                  ...(options.deliverySource.resolvedPath ? { sourcePath: options.deliverySource.resolvedPath } : {}),
                  ...(options.deliverySource.command ? { command: options.deliverySource.command } : {}),
                },
                undefined,
                0.78,
              ),
            ]
          : context.deliveryNormalizationResult
            ? [
                toEvidence(
                  "Using raw delivery observations after scoring them through the normalization profile.",
                  { source: "raw_normalized" },
                  undefined,
                  0.82,
                ),
              ]
            : [];
  const telemetryInput = options.telemetryObservations
    ? [
        toEvidence(
          "Using the normalized scores from telemetry observations as-is.",
          { source: "normalized_input" },
          undefined,
          0.84,
        ),
      ]
    : options.telemetryRawObservations
      ? [
          toEvidence(
            "Using raw telemetry observations after scoring them through the normalization profile.",
            { source: "raw_normalized" },
            undefined,
            0.82,
          ),
        ]
      : options.telemetryExport
        ? [
            toEvidence(
              "Ingested the telemetry export as the CommonOps input for OAS.",
              { source: "telemetry_export" },
              undefined,
              0.8,
            ),
          ]
        : options.telemetrySource
          ? [
              toEvidence(
                `Ingested a canonical export from telemetry source (${options.telemetrySource.sourceType}).`,
                {
                  source: "telemetry_source",
                  sourceType: options.telemetrySource.sourceType,
                  ...(options.telemetrySource.resolvedPath ? { sourcePath: options.telemetrySource.resolvedPath } : {}),
                  ...(options.telemetrySource.command ? { command: options.telemetrySource.command } : {}),
                },
                undefined,
                0.78,
              ),
            ]
          : context.telemetryNormalizationResult
            ? [
                toEvidence(
                  "Using raw telemetry observations after scoring them through the normalization profile.",
                  { source: "raw_normalized" },
                  undefined,
                  0.82,
                ),
              ]
            : [];

  return {
    direction,
    purity,
    protocol,
    contractBaselineSource,
    contractBaselineInput,
    scenario,
    scenarioSource,
    topology,
    operations,
    telemetrySource,
    telemetryNormalization,
    patternRuntimeNormalization,
    telemetryExport,
    deliverySource,
    deliveryNormalization,
    complexitySource,
    deliveryExport,
    complexityExport,
    complexity,
    evolution,
    deliveryInput,
    telemetryInput,
  };
}

export function collectArchitectureEvidence(evidence: ArchitectureEvidenceBundle): EvidenceEntry[] {
  return [
    ...evidence.scenarioSource,
    ...evidence.scenario,
    ...evidence.direction,
    ...evidence.purity,
    ...evidence.contractBaselineInput,
    ...evidence.protocol,
    ...evidence.contractBaselineSource,
    ...evidence.topology,
    ...evidence.telemetrySource,
    ...evidence.telemetryInput,
    ...evidence.telemetryExport,
    ...evidence.telemetryNormalization,
    ...evidence.patternRuntimeNormalization,
    ...evidence.operations,
    ...evidence.deliverySource,
    ...evidence.deliveryInput,
    ...evidence.deliveryExport,
    ...evidence.deliveryNormalization,
    ...evidence.complexitySource,
    ...evidence.complexityExport,
    ...evidence.complexity,
    ...evidence.evolution,
  ];
}
