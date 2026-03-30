import { detectDirectionViolations, scoreDependencyDirection } from "../analyzers/architecture.js";
import { scoreInterfaceProtocolStability } from "../analyzers/architecture-contracts.js";
import { ingestComplexityExportBundle } from "../analyzers/architecture-cti-ingest.js";
import { normalizeDeliveryObservations } from "../analyzers/architecture-delivery-normalization.js";
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
import type {
  ArchitecturePolicy,
  ArchitectureViolations,
  ComplexityExportIngestResult,
  ComplexityScore,
  ComputeArchitectureScoresOptions,
  DeliveryExportIngestResult,
  DeliveryNormalizationResult,
  DirectionScore,
  OperationsScore,
  PatternRuntimeNormalizationResult,
  ProtocolScore,
  PurityScore,
  ScenarioScore,
  TelemetryExportIngestResult,
  TelemetryNormalizationResult,
  TopologyScore,
} from "./architecture-scoring-types.js";
import { evaluateFormula } from "./formula.js";

export interface ArchitectureScoringInputResults {
  codebase: Awaited<ReturnType<typeof parseCodebase>>;
  directionScore: DirectionScore;
  purityScore: PurityScore;
  protocolScore: ProtocolScore;
  scenarioScore: ScenarioScore;
  topologyScore: TopologyScore;
  topologyValue: number;
  telemetryExportIngestResult?: TelemetryExportIngestResult;
  patternRuntimeNormalizationResult?: PatternRuntimeNormalizationResult;
  telemetryNormalizationResult?: TelemetryNormalizationResult;
  operationsScore: OperationsScore;
  deliveryExportIngestResult?: DeliveryExportIngestResult;
  deliveryNormalizationResult?: DeliveryNormalizationResult;
  complexityExportIngestResult?: ComplexityExportIngestResult;
  complexityScore: ComplexityScore;
  violations: ArchitectureViolations;
  usablePatternRuntimeRaw: boolean;
}

export async function resolveArchitectureScoringInputs(
  options: ComputeArchitectureScoresOptions,
  policy: ArchitecturePolicy,
): Promise<ArchitectureScoringInputResults> {
  const codebase = await parseCodebase(options.repoPath);
  const directionScore = scoreDependencyDirection(codebase, options.constraints);
  const purityScore = scoreBoundaryPurity(codebase, options.constraints);
  const resolvedContractBaseline = options.contractBaseline ?? options.contractBaselineSource?.data;
  const protocolScore = await scoreInterfaceProtocolStability({
    root: options.repoPath,
    codebase,
    constraints: options.constraints,
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
          ...options.constraints,
          complexity: complexityExportIngestResult.complexity,
        }
      : options.constraints,
  });

  return {
    codebase,
    directionScore,
    purityScore,
    protocolScore,
    scenarioScore,
    topologyScore,
    operationsScore,
    complexityScore,
    violations: detectDirectionViolations(codebase, options.constraints),
    usablePatternRuntimeRaw,
    topologyValue,
    ...(telemetryExportIngestResult ? { telemetryExportIngestResult } : {}),
    ...(patternRuntimeNormalizationResult ? { patternRuntimeNormalizationResult } : {}),
    ...(telemetryNormalizationResult ? { telemetryNormalizationResult } : {}),
    ...(deliveryExportIngestResult ? { deliveryExportIngestResult } : {}),
    ...(deliveryNormalizationResult ? { deliveryNormalizationResult } : {}),
    ...(complexityExportIngestResult ? { complexityExportIngestResult } : {}),
  };
}
