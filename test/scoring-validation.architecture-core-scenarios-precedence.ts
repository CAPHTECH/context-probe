import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  POLICY_PATH,
  QSF_BAD_OBSERVATIONS_PATH,
  QSF_CONSTRAINTS_PATH,
  QSF_GOOD_OBSERVATIONS_PATH,
  QSF_REPO,
  QSF_SCENARIOS_PATH,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreScenarioPrecedenceScoringValidationTests(tempRoots: string[]): void {
  test("explicit scenario observations take precedence over scenario observation sources", async () => {
    const badSource = await writeJsonFixture(tempRoots, "qsf-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_BAD_OBSERVATIONS_PATH,
    });

    const explicitResponse = await COMMANDS["score.compute"]!(
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
    const precedenceResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
        "scenario-observation-source": badSource,
      },
      { cwd: process.cwd() },
    );

    const explicitQsf = (
      explicitResponse.result as { metrics: Array<{ metricId: string; value: number }> }
    ).metrics.find((metric) => metric.metricId === "QSF");
    const precedenceQsf = (
      precedenceResponse.result as { metrics: Array<{ metricId: string; value: number }> }
    ).metrics.find((metric) => metric.metricId === "QSF");

    expect(precedenceQsf?.value ?? 0).toBeCloseTo(explicitQsf?.value ?? 0, 6);
    expect(
      precedenceResponse.unknowns.some((entry) => entry.includes("scenario observation source was not used")),
    ).toBe(true);
  });
}
