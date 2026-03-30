import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  POLICY_PATH,
  QSF_BAD_OBSERVATIONS_PATH,
  QSF_CONSTRAINTS_PATH,
  QSF_GOOD_OBSERVATIONS_PATH,
  QSF_REPO,
  QSF_SCENARIOS_PATH,
  QSF_THIN_OBSERVATIONS_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreScenarioValueScoringValidationTests(): void {
  test("QSF is higher for scenario-observing candidates than for scenario-missing or poor-fit candidates", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_BAD_OBSERVATIONS_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_THIN_OBSERVATIONS_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodQsf = getMetric(goodResponse, "QSF");
    const badQsf = getMetric(badResponse, "QSF");
    const thinQsf = getMetric(thinResponse, "QSF");

    expect(goodQsf.value).toBeGreaterThan(badQsf.value);
    expect(goodQsf.value).toBeGreaterThan(thinQsf.value);
    expect(thinQsf.unknowns.some((entry) => entry.includes("observed value"))).toBe(true);
    expect(goodQsf.components.weighted_coverage ?? 0).toBeGreaterThan(thinQsf.components.weighted_coverage ?? 0);
    expect(goodQsf.components.average_normalized_score ?? 0).toBeGreaterThan(
      badQsf.components.average_normalized_score ?? 0,
    );
  });
}
