import { detectDirectionViolations, scoreDependencyDirection } from "../analyzers/architecture.js";
import { scoreInterfaceProtocolStability } from "../analyzers/architecture-contracts.js";
import { ingestComplexityExportBundle } from "../analyzers/architecture-cti-ingest.js";
import { normalizeDeliveryObservations } from "../analyzers/architecture-delivery-normalization.js";
import {
  scoreArchitectureEvolutionEfficiency,
  scoreArchitectureEvolutionLocality,
} from "../analyzers/architecture-evolution.js";
import {
  ingestDeliveryExportBundle,
  ingestTelemetryExportBundle,
} from "../analyzers/architecture-observation-ingest.js";
import { scoreOperationalAdequacy } from "../analyzers/architecture-operations.js";
import { normalizePatternRuntimeObservations } from "../analyzers/architecture-pattern-runtime-normalization.js";
import { scoreBoundaryPurity } from "../analyzers/architecture-purity.js";
import { scoreQualityScenarioFit } from "../analyzers/architecture-scenarios.js";
import type { ResolvedCanonicalSource } from "../analyzers/architecture-source-loader.js";
import { normalizeTelemetryObservations } from "../analyzers/architecture-telemetry-normalization.js";
import { scoreTopologyIsolation } from "../analyzers/architecture-topology.js";
import { parseCodebase } from "../analyzers/code.js";
import { scoreComplexityTax } from "../analyzers/cti.js";
import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureConstraints,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTopologyModel,
  CochangeCommit,
  CommandResponse,
  MetricScore,
  PolicyConfig,
  ProvenanceRef,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
} from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { normalizeHistory } from "./history.js";
import { getDomainPolicy } from "./policy.js";
import { confidenceFromSignals, createResponse, toEvidence, toProvenance } from "./response.js";
import { toMetricScore, weightedAverage } from "./scoring-shared.js";

export async function computeArchitectureScores(options: {
  repoPath: string;
  constraints: ArchitectureConstraints;
  policyConfig: PolicyConfig;
  profileName: string;
  scenarioCatalog?: ArchitectureScenarioCatalog;
  scenarioObservations?: ScenarioObservationSet;
  scenarioObservationSource?: ResolvedCanonicalSource<ScenarioObservationSet>;
  scenarioObservationSourceRequested?: boolean;
  topologyModel?: ArchitectureTopologyModel;
  boundaryMap?: ArchitectureBoundaryMap;
  contractBaseline?: ArchitectureContractBaseline;
  contractBaselineSource?: ResolvedCanonicalSource<ArchitectureContractBaseline>;
  contractBaselineSourceRequested?: boolean;
  runtimeObservations?: TopologyRuntimeObservationSet;
  deliveryObservations?: ArchitectureDeliveryObservationSet;
  deliveryRawObservations?: ArchitectureDeliveryRawObservationSet;
  deliveryExport?: ArchitectureDeliveryExportBundle;
  deliverySource?: ResolvedCanonicalSource<ArchitectureDeliveryExportBundle>;
  deliverySourceRequested?: boolean;
  deliveryNormalizationProfile?: ArchitectureDeliveryNormalizationProfile;
  telemetryObservations?: ArchitectureTelemetryObservationSet;
  telemetryRawObservations?: ArchitectureTelemetryRawObservationSet;
  telemetryExport?: ArchitectureTelemetryExportBundle;
  telemetrySource?: ResolvedCanonicalSource<ArchitectureTelemetryExportBundle>;
  telemetrySourceRequested?: boolean;
  telemetryNormalizationProfile?: ArchitectureTelemetryNormalizationProfile;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet;
  patternRuntimeRawObservations?: ArchitecturePatternRuntimeRawObservationSet;
  patternRuntimeRawRequested?: boolean;
  patternRuntimeNormalizationProfile?: ArchitecturePatternRuntimeNormalizationProfile;
  patternRuntimeNormalizationProfileRequested?: boolean;
  complexityExport?: ArchitectureComplexityExportBundle;
  complexitySource?: ResolvedCanonicalSource<ArchitectureComplexityExportBundle>;
  complexitySourceRequested?: boolean;
  additionalProvenance?: ProvenanceRef[];
}): Promise<
  CommandResponse<{
    domainId: "architecture_design";
    metrics: MetricScore[];
    violations: ReturnType<typeof detectDirectionViolations>;
  }>
> {
  const { repoPath, constraints, policyConfig, profileName } = options;
  const policy = getDomainPolicy(policyConfig, profileName, "architecture_design");
  const codebase = await parseCodebase(repoPath);
  const directionScore = scoreDependencyDirection(codebase, constraints);
  const purityScore = scoreBoundaryPurity(codebase, constraints);
  const resolvedContractBaseline = options.contractBaseline ?? options.contractBaselineSource?.data;
  const protocolScore = await scoreInterfaceProtocolStability({
    root: repoPath,
    codebase,
    constraints,
    ...(resolvedContractBaseline ? { baseline: resolvedContractBaseline } : {}),
  });
  const scenarioObservationsInput = options.scenarioObservations ?? options.scenarioObservationSource?.data;
  const scenarioScore = scoreQualityScenarioFit({
    ...(options.scenarioCatalog ? { catalog: options.scenarioCatalog } : {}),
    ...(scenarioObservationsInput ? { observations: scenarioObservationsInput } : {}),
  });
  const topologyScore = scoreTopologyIsolation({
    ...(options.topologyModel ? { topology: options.topologyModel } : {}),
    ...(options.runtimeObservations ? { observations: options.runtimeObservations } : {}),
  });
  const topologyValue = policy.metrics.TIS
    ? evaluateFormula(policy.metrics.TIS.formula, {
        FI: topologyScore.FI,
        RC: topologyScore.RC,
        SDR: topologyScore.SDR,
      })
    : 0.4 * topologyScore.FI + 0.3 * topologyScore.RC + 0.3 * (1 - topologyScore.SDR);
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
  const complexityExportBundle = options.complexityExport ?? options.complexitySource?.data;
  const complexityExportIngestResult = complexityExportBundle
    ? ingestComplexityExportBundle({
        bundle: complexityExportBundle,
        ...(options.constraints.complexity ? { existing: options.constraints.complexity } : {}),
      })
    : undefined;
  const complexityScore = scoreComplexityTax({
    codebase,
    constraints: complexityExportIngestResult
      ? {
          ...constraints,
          complexity: complexityExportIngestResult.complexity,
        }
      : constraints,
  });
  let architectureCommits: CochangeCommit[] = [];
  let architectureHistoryDiagnostics: string[] = [];
  try {
    architectureCommits = await normalizeHistory(repoPath, policyConfig, profileName);
  } catch (error) {
    architectureHistoryDiagnostics = [
      error instanceof Error
        ? `Skipped architecture history analysis: ${error.message}`
        : "Skipped architecture history analysis",
    ];
  }
  const evolutionLocalityScore = scoreArchitectureEvolutionLocality({
    commits: architectureCommits,
    constraints,
    ...(options.boundaryMap ? { boundaryMap: options.boundaryMap } : {}),
  });
  const localityValue = policy.metrics.AELS
    ? evaluateFormula(policy.metrics.AELS.formula, {
        CrossBoundaryCoChange: evolutionLocalityScore.CrossBoundaryCoChange,
        WeightedPropagationCost: evolutionLocalityScore.WeightedPropagationCost,
        WeightedClusteringCost: evolutionLocalityScore.WeightedClusteringCost,
      })
    : 0.4 * (1 - evolutionLocalityScore.CrossBoundaryCoChange) +
      0.3 * (1 - evolutionLocalityScore.WeightedPropagationCost) +
      0.3 * (1 - evolutionLocalityScore.WeightedClusteringCost);
  const evolutionEfficiencyScore = scoreArchitectureEvolutionEfficiency({
    ...(options.deliveryObservations
      ? { deliveryObservations: options.deliveryObservations }
      : deliveryNormalizationResult
        ? { deliveryObservations: deliveryNormalizationResult.deliveryObservations }
        : {}),
    locality: localityValue,
    localityConfidence: evolutionLocalityScore.confidence,
    localityUnknowns: evolutionLocalityScore.unknowns,
  });
  const violations = detectDirectionViolations(codebase, constraints);
  const evidence = violations.map((violation) =>
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
  const purityEvidence = purityScore.findings.map((finding) =>
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
  const protocolEvidence = protocolScore.findings.map((finding) =>
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
  const contractBaselineSourceEvidence = (options.contractBaselineSource?.findings ?? []).map((finding) =>
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
  const contractBaselineInputEvidence =
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
  const scenarioEvidence = scenarioScore.findings.map((finding) =>
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
  const scenarioSourceEvidence = (options.scenarioObservationSource?.findings ?? []).map((finding) =>
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
  const topologyEvidence = topologyScore.findings.map((finding) =>
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
  const operationsEvidence = operationsScore.findings.map((finding) =>
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
  const telemetrySourceEvidence = (options.telemetrySource?.findings ?? []).map((finding) =>
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
  const telemetryNormalizationEvidence = (telemetryNormalizationResult?.findings ?? []).map((finding) =>
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
  const patternRuntimeNormalizationEvidence = (patternRuntimeNormalizationResult?.findings ?? []).map((finding) =>
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
  const telemetryExportEvidence = (telemetryExportIngestResult?.findings ?? []).map((finding) =>
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
  const deliverySourceEvidence = (options.deliverySource?.findings ?? []).map((finding) =>
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
  const deliveryNormalizationEvidence = (deliveryNormalizationResult?.findings ?? []).map((finding) =>
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
  const complexitySourceEvidence = (options.complexitySource?.findings ?? []).map((finding) =>
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
  const deliveryExportEvidence = (deliveryExportIngestResult?.findings ?? []).map((finding) =>
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
  const complexityExportEvidence = (complexityExportIngestResult?.findings ?? []).map((finding) =>
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
  const complexityEvidence = complexityScore.findings.map((finding) =>
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
  const evolutionEvidence = evolutionLocalityScore.findings.concat(evolutionEfficiencyScore.findings).map((finding) =>
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
  const deliveryInputEvidence = options.deliveryObservations
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
          : deliveryNormalizationResult
            ? [
                toEvidence(
                  "Using raw delivery observations after scoring them through the normalization profile.",
                  { source: "raw_normalized" },
                  undefined,
                  0.82,
                ),
              ]
            : [];
  const telemetryInputEvidence = options.telemetryObservations
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
          : telemetryNormalizationResult
            ? [
                toEvidence(
                  "Using raw telemetry observations after scoring them through the normalization profile.",
                  { source: "raw_normalized" },
                  undefined,
                  0.82,
                ),
              ]
            : [];
  const scores: MetricScore[] = [];
  if (policy.metrics.QSF) {
    const qsfUnknowns = [
      ...scenarioScore.unknowns,
      ...(options.scenarioObservationSource?.unknowns ?? []),
      ...(options.scenarioObservations && options.scenarioObservationSourceRequested
        ? ["Scenario observations were provided explicitly, so the scenario observation source was not used."]
        : []),
    ];
    scores.push(
      toMetricScore(
        "QSF",
        evaluateFormula(policy.metrics.QSF.formula, {
          QSF: scenarioScore.QSF,
        }),
        {
          scenario_count: scenarioScore.scenarioCount,
          weighted_coverage: scenarioScore.weightedCoverage,
          average_normalized_score: scenarioScore.averageNormalizedScore,
          QSF: scenarioScore.QSF,
        },
        [...scenarioSourceEvidence, ...scenarioEvidence].map((entry) => entry.evidenceId),
        confidenceFromSignals(
          options.scenarioObservationSource
            ? [scenarioScore.confidence, options.scenarioObservationSource.confidence]
            : [scenarioScore.confidence],
        ),
        Array.from(new Set(qsfUnknowns)),
      ),
    );
  }
  if (policy.metrics.DDS) {
    scores.push(
      toMetricScore(
        "DDS",
        evaluateFormula(policy.metrics.DDS.formula, {
          IDR: directionScore.IDR,
          LRC: directionScore.LRC,
          APM: directionScore.APM,
        }),
        {
          IDR: directionScore.IDR,
          LRC: directionScore.LRC,
          APM: directionScore.APM,
        },
        evidence.map((entry) => entry.evidenceId),
        directionScore.applicableEdges > 0 ? 0.9 : 0.55,
        directionScore.applicableEdges > 0
          ? []
          : ["There are too few dependencies that can be classified into layers."],
      ),
    );
  }
  if (policy.metrics.BPS) {
    scores.push(
      toMetricScore(
        "BPS",
        evaluateFormula(policy.metrics.BPS.formula, {
          ALR: purityScore.ALR,
          FCC: purityScore.FCC,
          SICR: purityScore.SICR,
        }),
        {
          ALR: purityScore.ALR,
          FCC: purityScore.FCC,
          SICR: purityScore.SICR,
        },
        purityEvidence.map((entry) => entry.evidenceId),
        purityScore.confidence,
        purityScore.unknowns,
      ),
    );
  }
  if (policy.metrics.IPS) {
    const ipsUnknowns = Array.from(
      new Set([
        ...(options.contractBaselineSource?.unknowns ?? []),
        ...protocolScore.unknowns,
        ...(options.contractBaseline && options.contractBaselineSourceRequested
          ? ["A contract baseline was provided explicitly, so the contract baseline source was not used."]
          : []),
      ]),
    );
    scores.push(
      toMetricScore(
        "IPS",
        evaluateFormula(policy.metrics.IPS.formula, {
          CBC: protocolScore.CBC,
          BCR: protocolScore.BCR,
          SLA: protocolScore.SLA,
        }),
        {
          CBC: protocolScore.CBC,
          BCR: protocolScore.BCR,
          SLA: protocolScore.SLA,
        },
        [...contractBaselineInputEvidence, ...contractBaselineSourceEvidence, ...protocolEvidence].map(
          (entry) => entry.evidenceId,
        ),
        protocolScore.confidence,
        ipsUnknowns,
      ),
    );
  }
  if (policy.metrics.TIS) {
    scores.push(
      toMetricScore(
        "TIS",
        evaluateFormula(policy.metrics.TIS.formula, {
          FI: topologyScore.FI,
          RC: topologyScore.RC,
          SDR: topologyScore.SDR,
        }),
        {
          FI: topologyScore.FI,
          RC: topologyScore.RC,
          SDR: topologyScore.SDR,
        },
        topologyEvidence.map((entry) => entry.evidenceId),
        topologyScore.confidence,
        topologyScore.unknowns,
      ),
    );
  }
  if (policy.metrics.OAS) {
    const oasEvidenceRefs = [
      ...telemetrySourceEvidence,
      ...telemetryInputEvidence,
      ...telemetryExportEvidence,
      ...telemetryNormalizationEvidence,
      ...patternRuntimeNormalizationEvidence,
      ...operationsEvidence,
    ].map((entry) => entry.evidenceId);
    const oasUnknowns = [
      ...(options.telemetrySource?.unknowns ?? []),
      ...(telemetryNormalizationResult?.unknowns ?? []),
      ...(telemetryExportIngestResult?.unknowns ?? []),
      ...(patternRuntimeNormalizationResult?.unknowns ?? []),
      ...operationsScore.unknowns,
      ...(options.telemetryObservations &&
      (options.telemetryRawObservations ||
        options.telemetryNormalizationProfile ||
        options.telemetryExport ||
        options.telemetrySourceRequested)
        ? ["Telemetry observations were provided explicitly, so raw/export/source telemetry inputs were not used."]
        : []),
      ...(options.telemetryRawObservations && options.telemetryExport
        ? ["Raw telemetry observations were provided explicitly, so the telemetry export was not used."]
        : []),
      ...(options.telemetrySourceRequested &&
      (options.telemetryObservations ||
        (options.telemetryRawObservations && options.telemetryNormalizationProfile) ||
        options.telemetryExport)
        ? ["A higher-priority telemetry input was present, so the telemetry source was not used."]
        : []),
      ...(options.patternRuntimeObservations && telemetryExportIngestResult?.patternRuntimeObservations
        ? [
            "Pattern runtime observations were provided explicitly, so pattern runtime data inside the telemetry export was not used.",
          ]
        : []),
      ...(options.patternRuntimeObservations &&
      options.patternRuntimeRawRequested &&
      options.patternRuntimeNormalizationProfileRequested
        ? ["Pattern runtime observations were provided explicitly, so raw pattern runtime input was not used."]
        : []),
      ...(usablePatternRuntimeRaw && telemetryExportIngestResult?.patternRuntimeObservations
        ? [
            "Raw pattern runtime input was provided explicitly, so pattern runtime data inside the telemetry export was not used.",
          ]
        : []),
    ];
    scores.push(
      toMetricScore(
        "OAS",
        evaluateFormula(policy.metrics.OAS.formula, {
          CommonOps: operationsScore.CommonOps,
          PatternRuntime: operationsScore.PatternRuntime,
        }),
        {
          CommonOps: operationsScore.CommonOps,
          PatternRuntime: operationsScore.PatternRuntime,
          band_count: operationsScore.bandCount,
          weighted_band_coverage: operationsScore.weightedBandCoverage,
        },
        oasEvidenceRefs,
        confidenceFromSignals([
          operationsScore.confidence,
          ...(patternRuntimeNormalizationResult ? [patternRuntimeNormalizationResult.confidence] : []),
          ...(telemetryNormalizationResult
            ? [telemetryNormalizationResult.confidence]
            : options.telemetrySource
              ? [options.telemetrySource.confidence, telemetryExportIngestResult?.confidence ?? 0.8]
              : telemetryExportIngestResult
                ? [telemetryExportIngestResult.confidence]
                : [0.85]),
        ]),
        Array.from(new Set(oasUnknowns)),
      ),
    );
  }
  if (policy.metrics.CTI) {
    scores.push(
      toMetricScore(
        "CTI",
        evaluateFormula(policy.metrics.CTI.formula, complexityScore.components),
        complexityScore.components,
        [...complexitySourceEvidence, ...complexityExportEvidence, ...complexityEvidence].map(
          (entry) => entry.evidenceId,
        ),
        confidenceFromSignals(
          complexityExportIngestResult
            ? options.complexitySource
              ? [
                  complexityScore.confidence,
                  complexityExportIngestResult.confidence,
                  options.complexitySource.confidence,
                ]
              : [complexityScore.confidence, complexityExportIngestResult.confidence]
            : [complexityScore.confidence],
        ),
        Array.from(
          new Set([
            ...(options.complexitySource?.unknowns ?? []),
            ...(complexityExportIngestResult?.unknowns ?? []),
            ...complexityScore.unknowns,
            ...(options.complexityExport && options.complexitySourceRequested
              ? ["A complexity export was provided explicitly, so the complexity source was not used."]
              : []),
          ]),
        ),
      ),
    );
  }
  if (policy.metrics.AELS) {
    scores.push(
      toMetricScore(
        "AELS",
        localityValue,
        {
          CrossBoundaryCoChange: evolutionLocalityScore.CrossBoundaryCoChange,
          WeightedPropagationCost: evolutionLocalityScore.WeightedPropagationCost,
          WeightedClusteringCost: evolutionLocalityScore.WeightedClusteringCost,
        },
        evolutionEvidence.map((entry) => entry.evidenceId),
        evolutionLocalityScore.confidence,
        evolutionLocalityScore.unknowns,
      ),
    );
  }
  if (policy.metrics.EES) {
    const eesUnknowns = [
      ...(options.deliverySource?.unknowns ?? []),
      ...(deliveryExportIngestResult?.unknowns ?? []),
      ...(deliveryNormalizationResult?.unknowns ?? []),
      ...evolutionEfficiencyScore.unknowns,
      ...(options.deliveryObservations &&
      (options.deliveryRawObservations ||
        options.deliveryNormalizationProfile ||
        options.deliveryExport ||
        options.deliverySourceRequested)
        ? ["Delivery observations were provided explicitly, so raw/export/source delivery inputs were not used."]
        : []),
      ...(options.deliveryRawObservations && options.deliveryExport
        ? ["Raw delivery observations were provided explicitly, so the delivery export was not used."]
        : []),
      ...(options.deliverySourceRequested &&
      (options.deliveryObservations ||
        (options.deliveryRawObservations && options.deliveryNormalizationProfile) ||
        options.deliveryExport)
        ? ["A higher-priority delivery input was present, so the delivery source was not used."]
        : []),
    ];
    scores.push(
      toMetricScore(
        "EES",
        evaluateFormula(policy.metrics.EES.formula, {
          Delivery: evolutionEfficiencyScore.Delivery,
          Locality: evolutionEfficiencyScore.Locality,
        }),
        {
          Delivery: evolutionEfficiencyScore.Delivery,
          Locality: evolutionEfficiencyScore.Locality,
        },
        [
          ...deliverySourceEvidence,
          ...deliveryInputEvidence,
          ...deliveryExportEvidence,
          ...deliveryNormalizationEvidence,
          ...evolutionEvidence,
        ].map((entry) => entry.evidenceId),
        confidenceFromSignals([
          evolutionEfficiencyScore.confidence,
          ...(deliveryNormalizationResult
            ? [deliveryNormalizationResult.confidence]
            : options.deliverySource
              ? [options.deliverySource.confidence, deliveryExportIngestResult?.confidence ?? 0.8]
              : deliveryExportIngestResult
                ? [deliveryExportIngestResult.confidence]
                : [0.85]),
        ]),
        Array.from(new Set(eesUnknowns)),
      ),
    );
  }
  if (policy.metrics.APSI) {
    const scoreMap = new Map(scores.map((score) => [score.metricId, score]));
    const qsfMetric = scoreMap.get("QSF");
    const ddsMetric = scoreMap.get("DDS");
    const bpsMetric = scoreMap.get("BPS");
    const ipsMetric = scoreMap.get("IPS");
    const tisMetric = scoreMap.get("TIS");
    const oasMetric = scoreMap.get("OAS");
    const eesMetric = scoreMap.get("EES");
    const ctiMetric = scoreMap.get("CTI");
    const PCS = weightedAverage(
      [
        { value: ddsMetric?.value, weight: 0.4 },
        { value: bpsMetric?.value, weight: 0.35 },
        { value: ipsMetric?.value, weight: 0.25 },
      ],
      0.5,
    );
    const OAS = oasMetric?.value ?? tisMetric?.value ?? 0.5;
    const apsiComponents = {
      QSF: qsfMetric?.value ?? 0.5,
      PCS,
      OAS,
      EES: eesMetric?.value ?? 0.5,
      CTI: ctiMetric?.value ?? 0.5,
    };
    const apsiUnknowns = ["PCS is a proxy composite of DDS, BPS, and IPS."];
    if (!qsfMetric) {
      apsiUnknowns.push("QSF was not computed, so APSI is using the neutral fallback value 0.5.");
    }
    if (!ddsMetric || !bpsMetric || !ipsMetric) {
      apsiUnknowns.push("Some of DDS/BPS/IPS were not computed, so PCS is only a partial proxy.");
    }
    if (!oasMetric && tisMetric) {
      apsiUnknowns.push("OAS is being approximated through the TIS proxy.");
    }
    if (!oasMetric && !tisMetric) {
      apsiUnknowns.push("Neither OAS nor TIS was computed, so APSI is using the neutral fallback value 0.5.");
    }
    if (!eesMetric) {
      apsiUnknowns.push("EES was not computed, so APSI is using the neutral fallback value 0.5.");
    }
    if (!ctiMetric) {
      apsiUnknowns.push("CTI was not computed, so APSI is using the neutral fallback value 0.5.");
    }
    if (profileName !== "default") {
      apsiUnknowns.push(`APSI is using the comparison weights from the ${profileName} policy profile.`);
    }
    scores.push(
      toMetricScore(
        "APSI",
        evaluateFormula(policy.metrics.APSI.formula, apsiComponents),
        apsiComponents,
        Array.from(
          new Set(
            [qsfMetric, ddsMetric, bpsMetric, ipsMetric, oasMetric, tisMetric, eesMetric, ctiMetric].flatMap(
              (metric) => metric?.evidenceRefs ?? [],
            ),
          ),
        ),
        confidenceFromSignals(
          [qsfMetric, ddsMetric, bpsMetric, ipsMetric, oasMetric, tisMetric, eesMetric, ctiMetric].flatMap((metric) =>
            metric ? [metric.confidence] : [],
          ),
        ),
        Array.from(new Set(apsiUnknowns)),
      ),
    );
  }

  return createResponse(
    {
      domainId: "architecture_design",
      metrics: scores,
      violations,
    },
    {
      status: architectureHistoryDiagnostics.length > 0 ? "warning" : "ok",
      evidence: [
        ...scenarioSourceEvidence,
        ...scenarioEvidence,
        ...evidence,
        ...purityEvidence,
        ...contractBaselineInputEvidence,
        ...protocolEvidence,
        ...contractBaselineSourceEvidence,
        ...topologyEvidence,
        ...telemetrySourceEvidence,
        ...telemetryInputEvidence,
        ...telemetryExportEvidence,
        ...telemetryNormalizationEvidence,
        ...patternRuntimeNormalizationEvidence,
        ...operationsEvidence,
        ...deliverySourceEvidence,
        ...deliveryInputEvidence,
        ...deliveryExportEvidence,
        ...deliveryNormalizationEvidence,
        ...complexitySourceEvidence,
        ...complexityExportEvidence,
        ...complexityEvidence,
        ...evolutionEvidence,
      ],
      confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
      unknowns: Array.from(new Set(scores.flatMap((score) => score.unknowns))),
      diagnostics: architectureHistoryDiagnostics,
      provenance: [
        toProvenance(repoPath, "architecture_design"),
        toProvenance(repoPath, `profile=${profileName}`),
        ...(options.additionalProvenance ?? []),
      ],
    },
  );
}
