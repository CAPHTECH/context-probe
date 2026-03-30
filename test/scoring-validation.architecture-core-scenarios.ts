import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  DATA_FILE_STUB,
  getMetric,
  POLICY_PATH,
  QSF_BAD_OBSERVATIONS_PATH,
  QSF_CONSTRAINTS_PATH,
  QSF_GOOD_OBSERVATIONS_PATH,
  QSF_REPO,
  QSF_SCENARIOS_PATH,
  QSF_THIN_OBSERVATIONS_PATH,
  shellQuote,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreScenarioScoringValidationTests(tempRoots: string[]): void {
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

  test("QSF also supports scenario observation sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "qsf-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_GOOD_OBSERVATIONS_PATH,
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "qsf-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(QSF_BAD_OBSERVATIONS_PATH)}`,
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "qsf-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_THIN_OBSERVATIONS_PATH,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": goodFileSource,
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
        "scenario-observation-source": badCommandSource,
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
        "scenario-observation-source": thinFileSource,
      },
      { cwd: process.cwd() },
    );

    const goodQsf = getMetric(goodResponse, "QSF");
    const badQsf = getMetric(badResponse, "QSF");
    const thinQsf = getMetric(thinResponse, "QSF");

    expect(goodQsf.value).toBeGreaterThan(badQsf.value);
    expect(goodQsf.value).toBeGreaterThan(thinQsf.value);
    expect(thinQsf.unknowns.some((entry) => entry.includes("observed value"))).toBe(true);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("scenario observation source config"))).toBe(
      true,
    );
  });

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

    expect(getMetric(precedenceResponse, "QSF").value).toBeCloseTo(getMetric(explicitResponse, "QSF").value, 6);
    expect(
      precedenceResponse.unknowns.some((entry) => entry.includes("scenario observation source was not used")),
    ).toBe(true);
  });
}
