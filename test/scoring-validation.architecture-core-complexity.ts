import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  CTI_BAD_CONSTRAINTS_PATH,
  CTI_BAD_EXPORT_PATH,
  CTI_BAD_REPO,
  CTI_GOOD_CONSTRAINTS_PATH,
  CTI_GOOD_EXPORT_PATH,
  CTI_GOOD_REPO,
  DATA_FILE_STUB,
  getMetric,
  POLICY_PATH,
  shellQuote,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreComplexityScoringValidationTests(tempRoots: string[]): void {
  test("CTI is lower for lean operational setups than for complexity-heavy setups", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodCti = getMetric(goodResponse, "CTI");
    const badCti = getMetric(badResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(badCti.components.DeployablesPerTeam ?? 0).toBeGreaterThan(goodCti.components.DeployablesPerTeam ?? 0);
    expect(badCti.components.ContractsOrSchemasPerService ?? 0).toBeGreaterThan(
      goodCti.components.ContractsOrSchemasPerService ?? 0,
    );
    expect(badCti.components.SyncDepthOverhead ?? 0).toBeGreaterThan(goodCti.components.SyncDepthOverhead ?? 0);
  });

  test("CTI also ingests operational export bundles and lets export data override fallback metadata", async () => {
    const exportedGoodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_GOOD_EXPORT_PATH,
      },
      { cwd: process.cwd() },
    );
    const exportedBadResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_BAD_EXPORT_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodCti = getMetric(exportedGoodResponse, "CTI");
    const badCti = getMetric(exportedBadResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(goodCti.components.DeployablesPerTeam ?? 1).toBeLessThan(badCti.components.DeployablesPerTeam ?? 0);
    expect(goodCti.unknowns.some((entry) => entry.includes("complexity export"))).toBe(false);
  });

  test("CTI also supports complexity source configs via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "cti-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: CTI_GOOD_EXPORT_PATH,
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "cti-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(CTI_BAD_EXPORT_PATH)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": goodFileSource,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": badCommandSource,
      },
      { cwd: process.cwd() },
    );

    const goodCti = getMetric(goodResponse, "CTI");
    const badCti = getMetric(badResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("complexity source config"))).toBe(true);
    expect(badResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  });

  test("explicit complexity export takes precedence over complexity sources", async () => {
    const goodSource = await writeJsonFixture(tempRoots, "cti-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: CTI_GOOD_EXPORT_PATH,
    });

    const response = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_BAD_EXPORT_PATH,
        "complexity-source": goodSource,
      },
      { cwd: process.cwd() },
    );

    const cti = getMetric(response, "CTI");

    expect(cti.value).toBeGreaterThan(0.4);
    expect(response.unknowns.some((entry) => entry.includes("complexity source was not used"))).toBe(true);
  });
}
