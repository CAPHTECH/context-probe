import type { detectBoundaryLeaks, detectContractUsage } from "../analyzers/code.js";
import type { Evidence } from "./contracts.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals, toEvidence } from "./response.js";
import { computeLeakRatio, toMetricScore } from "./scoring-shared.js";

type BoundaryLeakFinding = ReturnType<typeof detectBoundaryLeaks>[number];
type ContractUsageSummary = ReturnType<typeof detectContractUsage>;

export interface MccsMetricBuildResult {
  metric: ReturnType<typeof toMetricScore>;
  evidence: Evidence[];
  unknowns: string[];
}

export function buildMccsMetric(input: {
  metricPolicy: { formula: string };
  contractUsage: ContractUsageSummary;
  leakFindings: BoundaryLeakFinding[];
}): MccsMetricBuildResult {
  const evidence = input.leakFindings.map((finding) =>
    toEvidence(
      `${finding.sourceContext} -> ${finding.targetContext} internal leak`,
      {
        path: finding.path,
        violationType: finding.violationType,
      },
      [finding.findingId],
      0.95,
    ),
  );
  const leakRatio = computeLeakRatio(input.leakFindings, input.contractUsage.applicableReferences);
  const unknowns =
    input.contractUsage.applicableReferences > 0
      ? []
      : [
          "No applicable cross-context references were found, so MCCS evidence is limited.",
          "No cross-context references were observed, so MCCS should be interpreted carefully.",
        ];
  const mccsConfidence = input.contractUsage.applicableReferences > 0 ? 0.9 : 0.55;
  const components = {
    MRP: 1 - leakRatio,
    BLR: leakRatio,
    CLA: input.contractUsage.adherence,
  };

  return {
    metric: toMetricScore(
      "MCCS",
      evaluateFormula(input.metricPolicy.formula, components),
      components,
      evidence.map((entry) => entry.evidenceId),
      confidenceFromSignals([0.9, mccsConfidence, 0.9]),
      input.contractUsage.applicableReferences > 0
        ? []
        : ["No cross-context references were observed, so MCCS should be interpreted carefully."],
    ),
    evidence,
    unknowns,
  };
}
