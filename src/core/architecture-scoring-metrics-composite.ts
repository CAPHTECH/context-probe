import type { ArchitectureMetricBuilderArgs } from "./architecture-scoring-metric-shared.js";
import type { MetricScore } from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals } from "./response.js";
import { toMetricScore, weightedAverage } from "./scoring-shared.js";

export function buildCompositeArchitectureMetricScores(
  args: ArchitectureMetricBuilderArgs,
  scores: MetricScore[],
): MetricScore[] {
  const { options, policy } = args;
  if (!policy.metrics.APSI) {
    return [];
  }

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

  return [
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
  ];
}
