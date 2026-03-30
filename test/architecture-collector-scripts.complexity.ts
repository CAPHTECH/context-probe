import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  COLLECTOR_COMPLEXITY_BAD,
  COLLECTOR_COMPLEXITY_GOOD,
  COLLECTOR_COMPLEXITY_THIN,
  COMPLEXITY_COLLECTOR,
  CTI_BAD_CONSTRAINTS_PATH,
  CTI_BAD_REPO,
  CTI_GOOD_CONSTRAINTS_PATH,
  CTI_GOOD_REPO,
  getMetric,
  POLICY_PATH,
  shellQuote,
  writeSourceConfig,
} from "./architecture-collector-scripts.helpers.js";

export function registerArchitectureCollectorComplexityTests(tempRoots: string[]): void {
  test("score.compute accepts complexity collector command sources end-to-end", async () => {
    const goodSource = await writeSourceConfig(tempRoots, "complexity-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(COMPLEXITY_COLLECTOR)} ${shellQuote(COLLECTOR_COMPLEXITY_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "complexity-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(COMPLEXITY_COLLECTOR)} ${shellQuote(COLLECTOR_COMPLEXITY_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "complexity-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(COMPLEXITY_COLLECTOR)} ${shellQuote(COLLECTOR_COMPLEXITY_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": goodSource,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": badSource,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": thinSource,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "CTI").value).toBeLessThan(getMetric(badResponse, "CTI").value);
    expect(
      getMetric(thinResponse, "CTI").unknowns.some((entry) => entry.includes("on-call")) ||
        thinResponse.unknowns.length > 0,
    ).toBe(true);
  });
}
