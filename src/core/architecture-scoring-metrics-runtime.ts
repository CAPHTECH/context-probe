import { type ArchitectureMetricBuilderArgs, evidenceRefs } from "./architecture-scoring-metric-shared.js";
import type { MetricScore } from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals } from "./response.js";
import { toMetricScore } from "./scoring-shared.js";

export function buildRuntimeArchitectureMetricScores(args: ArchitectureMetricBuilderArgs): MetricScore[] {
  const { options, policy, context, evidence } = args;
  const scores: MetricScore[] = [];

  if (policy.metrics.OAS) {
    const oasUnknowns = [
      ...(options.telemetrySource?.unknowns ?? []),
      ...(context.telemetryNormalizationResult?.unknowns ?? []),
      ...(context.telemetryExportIngestResult?.unknowns ?? []),
      ...(context.patternRuntimeNormalizationResult?.unknowns ?? []),
      ...context.operationsScore.unknowns,
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
      ...(options.patternRuntimeObservations && context.telemetryExportIngestResult?.patternRuntimeObservations
        ? [
            "Pattern runtime observations were provided explicitly, so pattern runtime data inside the telemetry export was not used.",
          ]
        : []),
      ...(options.patternRuntimeObservations &&
      options.patternRuntimeRawRequested &&
      options.patternRuntimeNormalizationProfileRequested
        ? ["Pattern runtime observations were provided explicitly, so raw pattern runtime input was not used."]
        : []),
      ...(context.usablePatternRuntimeRaw && context.telemetryExportIngestResult?.patternRuntimeObservations
        ? [
            "Raw pattern runtime input was provided explicitly, so pattern runtime data inside the telemetry export was not used.",
          ]
        : []),
    ];
    scores.push(
      toMetricScore(
        "OAS",
        evaluateFormula(policy.metrics.OAS.formula, {
          CommonOps: context.operationsScore.CommonOps,
          PatternRuntime: context.operationsScore.PatternRuntime,
        }),
        {
          CommonOps: context.operationsScore.CommonOps,
          PatternRuntime: context.operationsScore.PatternRuntime,
          band_count: context.operationsScore.bandCount,
          weighted_band_coverage: context.operationsScore.weightedBandCoverage,
        },
        evidenceRefs(
          evidence.telemetrySource,
          evidence.telemetryInput,
          evidence.telemetryExport,
          evidence.telemetryNormalization,
          evidence.patternRuntimeNormalization,
          evidence.operations,
        ),
        confidenceFromSignals([
          context.operationsScore.confidence,
          ...(context.patternRuntimeNormalizationResult ? [context.patternRuntimeNormalizationResult.confidence] : []),
          ...(context.telemetryNormalizationResult
            ? [context.telemetryNormalizationResult.confidence]
            : options.telemetrySource
              ? [options.telemetrySource.confidence, context.telemetryExportIngestResult?.confidence ?? 0.8]
              : context.telemetryExportIngestResult
                ? [context.telemetryExportIngestResult.confidence]
                : [0.85]),
        ]),
        Array.from(new Set(oasUnknowns)),
      ),
    );
  }

  return scores;
}
