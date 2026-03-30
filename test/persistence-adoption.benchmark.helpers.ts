import {
  type BenchmarkSummary,
  DRIFT_TOLERANCE,
  MAX_THIN_HISTORY_CONFIDENCE,
  MAX_THIN_HISTORY_LOCALITY_SCORE,
  MIN_IMPROVEMENT_RATE,
  MIN_REPO_BACKED_ADVANTAGE_CASES,
  scoresPreferBetter,
  summarizeAdvantages,
} from "./persistence-adoption.helpers.js";
import { createAcceptanceCases } from "./persistence-adoption.repo-cases.js";

export async function evaluateBenchmark(tempRoots: string[]): Promise<BenchmarkSummary> {
  const cases = createAcceptanceCases(tempRoots);
  let controlViolations = 0;
  let robustnessViolations = 0;
  let confidenceViolations = 0;
  let determinismViolations = 0;
  const syntheticAdvantageResults: Array<{ elsCorrect: boolean; persistenceCorrect: boolean }> = [];
  const repoBackedAdvantageResults: Array<{ elsCorrect: boolean; persistenceCorrect: boolean }> = [];

  for (const entry of cases) {
    if (entry.kind === "control" || entry.kind === "advantage") {
      const result = await entry.build();
      const elsCorrect = scoresPreferBetter(result.better.els.score, result.worse.els.score);
      const persistenceCorrect = scoresPreferBetter(
        result.better.persistenceCandidate.localityScore,
        result.worse.persistenceCandidate.localityScore,
      );

      if (entry.kind === "control" && (!elsCorrect || !persistenceCorrect)) {
        controlViolations += 1;
      }
      if (entry.kind === "advantage") {
        const bucket = entry.evidenceLevel === "repo_backed" ? repoBackedAdvantageResults : syntheticAdvantageResults;
        bucket.push({ elsCorrect, persistenceCorrect });
      }
      continue;
    }

    if (entry.kind === "robustness") {
      const result = await entry.build();
      const maxDrift = entry.maxDrift ?? DRIFT_TOLERANCE;
      const elsDrift = Math.abs(result.baseline.els.score - result.variant.els.score);
      const persistenceDrift = Math.abs(
        result.baseline.persistenceCandidate.localityScore - result.variant.persistenceCandidate.localityScore,
      );

      if (elsDrift > maxDrift || persistenceDrift > maxDrift) {
        robustnessViolations += 1;
      }
      continue;
    }

    if (entry.kind === "confidence") {
      const result = await entry.build();
      const maxConfidence = entry.maxConfidence ?? MAX_THIN_HISTORY_CONFIDENCE;
      const maxLocalityScore = entry.maxLocalityScore ?? MAX_THIN_HISTORY_LOCALITY_SCORE;
      const hasRequiredUnknown = result.unknowns.some((unknown) => unknown.includes(entry.requiredUnknownFragment));

      if (
        result.confidence >= maxConfidence ||
        !hasRequiredUnknown ||
        result.result.persistenceCandidate.localityScore > maxLocalityScore
      ) {
        confidenceViolations += 1;
      }
      continue;
    }

    if (entry.kind === "determinism") {
      const result = await entry.build();
      if (
        JSON.stringify(result.forward.result) !== JSON.stringify(result.reversed.result) ||
        result.forward.confidence !== result.reversed.confidence ||
        JSON.stringify(result.forward.unknowns) !== JSON.stringify(result.reversed.unknowns)
      ) {
        determinismViolations += 1;
      }
    }
  }

  const syntheticAdvantage = summarizeAdvantages(syntheticAdvantageResults);
  const repoBackedAdvantage = summarizeAdvantages(repoBackedAdvantageResults);
  const reasons: string[] = [];

  if (controlViolations > 0) {
    reasons.push("control_regressions_detected");
  }
  if (robustnessViolations > 0) {
    reasons.push("robustness_violations_detected");
  }
  if (confidenceViolations > 0) {
    reasons.push("confidence_violations_detected");
  }
  if (determinismViolations > 0) {
    reasons.push("determinism_violations_detected");
  }
  if (repoBackedAdvantage.caseCount < MIN_REPO_BACKED_ADVANTAGE_CASES) {
    reasons.push("insufficient_repo_backed_advantage_evidence");
  }
  if (repoBackedAdvantage.elsMisclassifications === 0) {
    reasons.push("no_repo_backed_els_failures_observed");
  }
  if (repoBackedAdvantage.persistenceMisclassifications >= repoBackedAdvantage.elsMisclassifications) {
    reasons.push("persistence_does_not_beat_repo_backed_els");
  }
  if (repoBackedAdvantage.improvementRate < MIN_IMPROVEMENT_RATE) {
    reasons.push("repo_backed_improvement_below_threshold");
  }

  return {
    controlViolations,
    syntheticAdvantage,
    repoBackedAdvantage,
    robustnessViolations,
    confidenceViolations,
    determinismViolations,
    reasons,
    verdict: reasons.length === 0 ? "go" : "no_go",
  };
}
