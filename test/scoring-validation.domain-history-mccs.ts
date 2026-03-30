import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  MCCS_BAD_ENTRY,
  MCCS_GOOD_ENTRY,
  MCCS_MODEL_PATH,
  materializeGitFixture,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryMccsScoringValidationTests(tempRoots: string[]): void {
  test("MCCS is higher for contract-compliant repositories than for leaking repositories", async () => {
    const goodRepo = await materializeGitFixture(MCCS_GOOD_ENTRY, tempRoots, "feat: init good mccs");
    const badRepo = await materializeGitFixture(MCCS_BAD_ENTRY, tempRoots, "feat: init bad mccs");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    const goodMccs = getMetric(goodResponse, "MCCS");
    const badMccs = getMetric(badResponse, "MCCS");

    expect(goodMccs.value).toBeGreaterThan(badMccs.value);
    expect(goodMccs.value).toBe(1);
    expect(badMccs.value).toBe(0);
  }, 20000);
}
