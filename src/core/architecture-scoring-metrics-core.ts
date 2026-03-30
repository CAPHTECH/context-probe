import { type ArchitectureMetricBuilderArgs, evidenceRefs } from "./architecture-scoring-metric-shared.js";
import type { MetricScore } from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals } from "./response.js";
import { toMetricScore } from "./scoring-shared.js";

export function buildCoreArchitectureMetricScores(args: ArchitectureMetricBuilderArgs): MetricScore[] {
  const { options, policy, context, evidence } = args;
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

  return scores;
}
