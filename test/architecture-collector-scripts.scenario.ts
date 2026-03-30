import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  COLLECTOR_SCENARIO_BAD,
  COLLECTOR_SCENARIO_GOOD,
  COLLECTOR_SCENARIO_THIN,
  getMetric,
  POLICY_PATH,
  QSF_CONSTRAINTS_PATH,
  QSF_REPO,
  QSF_SCENARIOS_PATH,
  SCENARIO_COLLECTOR,
  shellQuote,
  writeSourceConfig,
} from "./architecture-collector-scripts.helpers.js";

export function registerArchitectureCollectorScenarioTests(tempRoots: string[]): void {
  test("score.compute accepts scenario collector command sources end-to-end", async () => {
    const goodSource = await writeSourceConfig(tempRoots, "scenario-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(SCENARIO_COLLECTOR)} ${shellQuote(COLLECTOR_SCENARIO_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "scenario-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(SCENARIO_COLLECTOR)} ${shellQuote(COLLECTOR_SCENARIO_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "scenario-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(SCENARIO_COLLECTOR)} ${shellQuote(COLLECTOR_SCENARIO_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": goodSource,
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
        "scenario-observation-source": badSource,
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
        "scenario-observation-source": thinSource,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "QSF").value).toBeGreaterThan(getMetric(badResponse, "QSF").value);
    expect(getMetric(thinResponse, "QSF").unknowns.some((entry) => entry.includes("S-002"))).toBe(true);
  });
}
