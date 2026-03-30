import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  DATA_FILE_STUB,
  getMetric,
  IPS_BAD_REPO,
  IPS_BASELINE_PATH,
  IPS_BASELINE_SOURCE_FILE_PATH,
  IPS_CONSTRAINTS_PATH,
  IPS_GOOD_REPO,
  POLICY_PATH,
  shellQuote,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreProtocolScoringValidationTests(tempRoots: string[]): void {
  test("IPS is higher for clean public contracts than for implementation-coupled contracts", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_GOOD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodIps = getMetric(goodResponse, "IPS");
    const badIps = getMetric(badResponse, "IPS");

    expect(goodIps.value).toBeGreaterThan(badIps.value);
    expect(goodIps.components.CBC ?? 0).toBeGreaterThan(badIps.components.CBC ?? 0);
    expect(badIps.components.BCR ?? 0).toBeGreaterThan(goodIps.components.BCR ?? 0);
    expect(goodIps.components.SLA ?? 0).toBeGreaterThan(badIps.components.SLA ?? 0);
  });

  test("IPS also supports contract baseline inputs via direct files and source configs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const commandSource = await writeJsonFixture(tempRoots, "ips-baseline-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(IPS_BASELINE_PATH)}`,
    });

    const fileSourceResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_GOOD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "contract-baseline-source": IPS_BASELINE_SOURCE_FILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const commandSourceResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "contract-baseline-source": commandSource,
      },
      { cwd: process.cwd() },
    );

    const fileSourceIps = getMetric(fileSourceResponse, "IPS");
    const commandSourceIps = getMetric(commandSourceResponse, "IPS");

    expect(fileSourceResponse.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
    expect(commandSourceResponse.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
    expect(fileSourceIps.components.CBC ?? 0).toBeGreaterThan(commandSourceIps.components.CBC ?? 0);
    expect(commandSourceIps.components.BCR ?? 0).toBeGreaterThan(fileSourceIps.components.BCR ?? 0);
    expect(
      fileSourceResponse.evidence.some((entry) => entry.statement.includes("contract baseline source config")),
    ).toBe(true);
    expect(commandSourceResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  });

  test("explicit contract baseline takes precedence over contract baseline sources", async () => {
    const sameSource = await writeJsonFixture(tempRoots, "ips-baseline-precedence.json", {
      version: "1.0",
      sourceType: "file",
      path: IPS_BASELINE_PATH,
    });

    const response = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "contract-baseline": IPS_BASELINE_PATH,
        "contract-baseline-source": sameSource,
      },
      { cwd: process.cwd() },
    );

    expect(response.unknowns).toContain(
      "A contract baseline was provided explicitly, so the contract baseline source was not used.",
    );
    expect(response.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
  });
}
