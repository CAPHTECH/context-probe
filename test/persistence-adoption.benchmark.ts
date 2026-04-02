import { expect, test } from "vitest";
import { evaluateBenchmark } from "./persistence-adoption.benchmark.helpers.js";
import {
  MAX_THIN_HISTORY_CONFIDENCE,
  MAX_THIN_HISTORY_LOCALITY_SCORE,
  MIN_IMPROVEMENT_RATE,
  MIN_REPO_BACKED_ADVANTAGE_CASES,
} from "./persistence-adoption.helpers.js";

export function registerPersistenceAdoptionBenchmarkTests(tempRoots: string[]) {
  test("promotes the persistence candidate once repo-backed advantage evidence exists", async () => {
    const summary = await evaluateBenchmark(tempRoots);

    expect(summary.controlViolations).toBe(0);
    expect(summary.syntheticAdvantage.caseCount).toBeGreaterThanOrEqual(2);
    expect(summary.syntheticAdvantage.elsMisclassifications).toBeGreaterThan(
      summary.syntheticAdvantage.persistenceMisclassifications,
    );
    expect(summary.syntheticAdvantage.improvementRate).toBeGreaterThanOrEqual(MIN_IMPROVEMENT_RATE);
    expect(summary.repoBackedAdvantage.caseCount).toBeGreaterThanOrEqual(MIN_REPO_BACKED_ADVANTAGE_CASES);
    expect(summary.repoBackedAdvantage.elsMisclassifications).toBeGreaterThan(
      summary.repoBackedAdvantage.persistenceMisclassifications,
    );
    expect(summary.repoBackedAdvantage.improvementRate).toBeGreaterThanOrEqual(MIN_IMPROVEMENT_RATE);
    expect(summary.robustnessViolations).toBe(0);
    expect(summary.confidenceViolations).toBe(0);
    expect(summary.determinismViolations).toBe(0);
    expect(summary.reasons).toEqual([]);
    expect(summary.verdict).toBe("go");
    expect(MAX_THIN_HISTORY_CONFIDENCE).toBeGreaterThan(MAX_THIN_HISTORY_LOCALITY_SCORE);
  }, 60000);
}
