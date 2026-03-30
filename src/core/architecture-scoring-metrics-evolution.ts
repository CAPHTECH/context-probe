import { type ArchitectureMetricBuilderArgs, evidenceRefs } from "./architecture-scoring-metric-shared.js";
import type { MetricScore } from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals } from "./response.js";
import { toMetricScore } from "./scoring-shared.js";

export function buildEvolutionArchitectureMetricScores(args: ArchitectureMetricBuilderArgs): MetricScore[] {
  const { options, policy, context, evidence } = args;
  const scores: MetricScore[] = [];

  if (policy.metrics.CTI) {
    scores.push(
      toMetricScore(
        "CTI",
        evaluateFormula(policy.metrics.CTI.formula, context.complexityScore.components),
        context.complexityScore.components,
        evidenceRefs(evidence.complexitySource, evidence.complexityExport, evidence.complexity),
        confidenceFromSignals(
          context.complexityExportIngestResult
            ? options.complexitySource
              ? [
                  context.complexityScore.confidence,
                  context.complexityExportIngestResult.confidence,
                  options.complexitySource.confidence,
                ]
              : [context.complexityScore.confidence, context.complexityExportIngestResult.confidence]
            : [context.complexityScore.confidence],
        ),
        Array.from(
          new Set([
            ...(options.complexitySource?.unknowns ?? []),
            ...(context.complexityExportIngestResult?.unknowns ?? []),
            ...context.complexityScore.unknowns,
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
        context.localityValue,
        {
          CrossBoundaryCoChange: context.evolutionLocalityScore.CrossBoundaryCoChange,
          WeightedPropagationCost: context.evolutionLocalityScore.WeightedPropagationCost,
          WeightedClusteringCost: context.evolutionLocalityScore.WeightedClusteringCost,
        },
        evidenceRefs(evidence.evolution),
        context.evolutionLocalityScore.confidence,
        context.evolutionLocalityScore.unknowns,
      ),
    );
  }

  if (policy.metrics.EES) {
    const eesUnknowns = [
      ...(options.deliverySource?.unknowns ?? []),
      ...(context.deliveryExportIngestResult?.unknowns ?? []),
      ...(context.deliveryNormalizationResult?.unknowns ?? []),
      ...context.evolutionEfficiencyScore.unknowns,
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
          Delivery: context.evolutionEfficiencyScore.Delivery,
          Locality: context.evolutionEfficiencyScore.Locality,
        }),
        {
          Delivery: context.evolutionEfficiencyScore.Delivery,
          Locality: context.evolutionEfficiencyScore.Locality,
        },
        evidenceRefs(
          evidence.deliverySource,
          evidence.deliveryInput,
          evidence.deliveryExport,
          evidence.deliveryNormalization,
          evidence.evolution,
        ),
        confidenceFromSignals([
          context.evolutionEfficiencyScore.confidence,
          ...(context.deliveryNormalizationResult
            ? [context.deliveryNormalizationResult.confidence]
            : options.deliverySource
              ? [options.deliverySource.confidence, context.deliveryExportIngestResult?.confidence ?? 0.8]
              : context.deliveryExportIngestResult
                ? [context.deliveryExportIngestResult.confidence]
                : [0.85]),
        ]),
        Array.from(new Set(eesUnknowns)),
      ),
    );
  }

  return scores;
}
