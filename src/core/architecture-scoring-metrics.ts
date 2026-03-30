import type { ArchitectureEvidenceBundle } from "./architecture-scoring-evidence.js";
import type {
  ArchitecturePolicy,
  ArchitectureScoringContext,
  ComputeArchitectureScoresOptions,
} from "./architecture-scoring-types.js";
import type { MetricScore } from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals } from "./response.js";
import { toMetricScore, weightedAverage } from "./scoring-shared.js";

function evidenceRefs(...groups: Array<Array<{ evidenceId: string }>>): string[] {
  return groups.flatMap((group) => group.map((entry) => entry.evidenceId));
}

export function buildArchitectureMetricScores(
  options: ComputeArchitectureScoresOptions,
  policy: ArchitecturePolicy,
  context: ArchitectureScoringContext,
  evidence: ArchitectureEvidenceBundle,
): MetricScore[] {
  const scores: MetricScore[] = [];

  if (policy.metrics.QSF) {
    const qsfUnknowns = [
      ...context.scenarioScore.unknowns,
      ...(options.scenarioObservationSource?.unknowns ?? []),
      ...(options.scenarioObservations && options.scenarioObservationSourceRequested
        ? ["Scenario observations were provided explicitly, so the scenario observation source was not used."]
        : []),
    ];
    scores.push(
      toMetricScore(
        "QSF",
        evaluateFormula(policy.metrics.QSF.formula, {
          QSF: context.scenarioScore.QSF,
        }),
        {
          scenario_count: context.scenarioScore.scenarioCount,
          weighted_coverage: context.scenarioScore.weightedCoverage,
          average_normalized_score: context.scenarioScore.averageNormalizedScore,
          QSF: context.scenarioScore.QSF,
        },
        evidenceRefs(evidence.scenarioSource, evidence.scenario),
        confidenceFromSignals(
          options.scenarioObservationSource
            ? [context.scenarioScore.confidence, options.scenarioObservationSource.confidence]
            : [context.scenarioScore.confidence],
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
          IDR: context.directionScore.IDR,
          LRC: context.directionScore.LRC,
          APM: context.directionScore.APM,
        }),
        {
          IDR: context.directionScore.IDR,
          LRC: context.directionScore.LRC,
          APM: context.directionScore.APM,
        },
        evidenceRefs(evidence.direction),
        context.directionScore.applicableEdges > 0 ? 0.9 : 0.55,
        context.directionScore.applicableEdges > 0
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
          ALR: context.purityScore.ALR,
          FCC: context.purityScore.FCC,
          SICR: context.purityScore.SICR,
        }),
        {
          ALR: context.purityScore.ALR,
          FCC: context.purityScore.FCC,
          SICR: context.purityScore.SICR,
        },
        evidenceRefs(evidence.purity),
        context.purityScore.confidence,
        context.purityScore.unknowns,
      ),
    );
  }

  if (policy.metrics.IPS) {
    const ipsUnknowns = Array.from(
      new Set([
        ...(options.contractBaselineSource?.unknowns ?? []),
        ...context.protocolScore.unknowns,
        ...(options.contractBaseline && options.contractBaselineSourceRequested
          ? ["A contract baseline was provided explicitly, so the contract baseline source was not used."]
          : []),
      ]),
    );
    scores.push(
      toMetricScore(
        "IPS",
        evaluateFormula(policy.metrics.IPS.formula, {
          CBC: context.protocolScore.CBC,
          BCR: context.protocolScore.BCR,
          SLA: context.protocolScore.SLA,
        }),
        {
          CBC: context.protocolScore.CBC,
          BCR: context.protocolScore.BCR,
          SLA: context.protocolScore.SLA,
        },
        evidenceRefs(evidence.contractBaselineInput, evidence.contractBaselineSource, evidence.protocol),
        context.protocolScore.confidence,
        ipsUnknowns,
      ),
    );
  }

  if (policy.metrics.TIS) {
    scores.push(
      toMetricScore(
        "TIS",
        evaluateFormula(policy.metrics.TIS.formula, {
          FI: context.topologyScore.FI,
          RC: context.topologyScore.RC,
          SDR: context.topologyScore.SDR,
        }),
        {
          FI: context.topologyScore.FI,
          RC: context.topologyScore.RC,
          SDR: context.topologyScore.SDR,
        },
        evidenceRefs(evidence.topology),
        context.topologyScore.confidence,
        context.topologyScore.unknowns,
      ),
    );
  }

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
    if (options.profileName !== "default") {
      apsiUnknowns.push(`APSI is using the comparison weights from the ${options.profileName} policy profile.`);
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

  return scores;
}
