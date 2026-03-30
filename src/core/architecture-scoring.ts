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
import { normalizeTelemetryObservations } from "../analyzers/architecture-telemetry-normalization.js";
import { scoreTopologyIsolation } from "../analyzers/architecture-topology.js";
import { parseCodebase } from "../analyzers/code.js";
import { scoreComplexityTax } from "../analyzers/cti.js";
import { buildArchitectureEvidence, collectArchitectureEvidence } from "./architecture-scoring-evidence.js";
import { buildArchitectureMetricScores } from "./architecture-scoring-metrics.js";
import type { ArchitectureScoringContext, ComputeArchitectureScoresOptions } from "./architecture-scoring-types.js";
import type { CochangeCommit, CommandResponse, MetricScore } from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { normalizeHistory } from "./history.js";
import { getDomainPolicy } from "./policy.js";
import { confidenceFromSignals, createResponse, toProvenance } from "./response.js";

export async function computeArchitectureScores(options: ComputeArchitectureScoresOptions): Promise<
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
  const context: ArchitectureScoringContext = {
    directionScore,
    purityScore,
    protocolScore,
    scenarioScore,
    topologyScore,
    ...(telemetryExportIngestResult ? { telemetryExportIngestResult } : {}),
    ...(patternRuntimeNormalizationResult ? { patternRuntimeNormalizationResult } : {}),
    ...(telemetryNormalizationResult ? { telemetryNormalizationResult } : {}),
    operationsScore,
    ...(deliveryExportIngestResult ? { deliveryExportIngestResult } : {}),
    ...(deliveryNormalizationResult ? { deliveryNormalizationResult } : {}),
    ...(complexityExportIngestResult ? { complexityExportIngestResult } : {}),
    complexityScore,
    architectureCommits,
    architectureHistoryDiagnostics,
    evolutionLocalityScore,
    evolutionEfficiencyScore,
    localityValue,
    violations,
    usablePatternRuntimeRaw,
  };
  const architectureEvidence = buildArchitectureEvidence(options, context);
  const scores = buildArchitectureMetricScores(options, policy, context, architectureEvidence);
  const evidence = collectArchitectureEvidence(architectureEvidence);

  return createResponse(
    {
      domainId: "architecture_design",
      metrics: scores,
      violations,
    },
    {
      status: architectureHistoryDiagnostics.length > 0 ? "warning" : "ok",
      evidence,
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
