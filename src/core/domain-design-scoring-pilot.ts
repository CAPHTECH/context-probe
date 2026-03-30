import type { DomainDesignScoreResult, DomainDesignShadowRolloutGateEvaluation, MetricScore } from "./contracts.js";
import { persistenceCandidateToMetricComponents } from "./domain-design-scoring-support.js";

export interface PilotResolutionResult {
  metric: MetricScore;
  pilot?: DomainDesignScoreResult["pilot"];
  diagnostics: string[];
}

export function resolveDomainPersistencePilot(input: {
  metric: MetricScore;
  shadow: DomainDesignScoreResult["shadow"];
  shadowLocalityConfidence: number;
  pilotPersistenceCategory?: string;
  pilotGateEvaluation?: DomainDesignShadowRolloutGateEvaluation;
}): PilotResolutionResult {
  const diagnostics: string[] = [];
  const { metric, shadow, shadowLocalityConfidence, pilotPersistenceCategory, pilotGateEvaluation } = input;
  if (!pilotPersistenceCategory) {
    return { metric, diagnostics };
  }
  if (!pilotGateEvaluation) {
    throw new Error("pilotPersistenceCategory requires pilotGateEvaluation");
  }

  const categoryGate = pilotGateEvaluation.categories.find((entry) => entry.category === pilotPersistenceCategory);
  if (!categoryGate) {
    throw new Error(`No shadow rollout category gate is registered for \`${pilotPersistenceCategory}\``);
  }

  const baselineElsValue = metric.value;
  const persistenceCandidateValue = shadow?.localityModels.persistenceCandidate.localityScore ?? baselineElsValue;
  const comparisonAvailable =
    (shadow?.localityModels.persistenceAnalysis.relevantCommitCount ?? 0) > 0 &&
    (shadow?.localityModels.persistenceAnalysis.contextsSeen.length ?? 0) > 0;
  const applied = comparisonAvailable && categoryGate.gate.rolloutDisposition === "replace";
  const pilotFallbackMessage =
    "Persistence pilot fell back to baseline ELS because locality comparison data is unavailable.";

  if (!comparisonAvailable) {
    diagnostics.push(pilotFallbackMessage);
    metric.unknowns = Array.from(new Set([...metric.unknowns, pilotFallbackMessage]));
  }

  if (applied && shadow) {
    metric.value = persistenceCandidateValue;
    metric.components = persistenceCandidateToMetricComponents(shadow.localityModels.persistenceCandidate);
    metric.confidence = shadowLocalityConfidence > 0 ? shadowLocalityConfidence : metric.confidence;
    metric.evidenceRefs = [];
    metric.unknowns = Array.from(
      new Set([
        ...metric.unknowns,
        `ELS fully reflects persistence_candidate pilot output for category \`${pilotPersistenceCategory}\` and exposes persistence-derived locality metadata.`,
      ]),
    );
  }

  return {
    metric,
    diagnostics,
    pilot: {
      category: pilotPersistenceCategory,
      applied,
      localitySource: applied ? "persistence_candidate" : "els",
      baselineElsValue,
      persistenceCandidateValue,
      effectiveElsValue: metric.value,
      overallGate: {
        reasons: pilotGateEvaluation.reasons,
        replacementVerdict: pilotGateEvaluation.replacementVerdict,
        rolloutDisposition: pilotGateEvaluation.rolloutDisposition,
      },
      categoryGate: {
        reasons: categoryGate.gate.reasons,
        replacementVerdict: categoryGate.gate.replacementVerdict,
        rolloutDisposition: categoryGate.gate.rolloutDisposition,
      },
    },
  };
}
