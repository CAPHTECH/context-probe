import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  BPS_BAD_REPO,
  BPS_CONSTRAINTS_PATH,
  BPS_GOOD_REPO,
  DDS_BAD_REPO,
  DDS_CONSTRAINTS_PATH,
  DDS_GOOD_REPO,
  getMetric,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreStructureScoringValidationTests(): void {
  test("DDS is higher for inward-only dependencies than for violating dependencies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_GOOD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_BAD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodDds = getMetric(goodResponse, "DDS");
    const badDds = getMetric(badResponse, "DDS");

    expect(goodDds.value).toBeGreaterThan(badDds.value);
    expect(goodDds.value).toBe(1);
    expect(badDds.value).toBeLessThan(0.58);
  });

  test("BPS is higher for contained outer-layer code than for leaked and shared internal code", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: BPS_GOOD_REPO,
        constraints: BPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: BPS_BAD_REPO,
        constraints: BPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodBps = getMetric(goodResponse, "BPS");
    const badBps = getMetric(badResponse, "BPS");

    expect(goodBps.value).toBeGreaterThan(badBps.value);
    expect(goodBps.components.FCC ?? 0).toBeGreaterThan(badBps.components.FCC ?? 0);
    expect(badBps.components.ALR ?? 0).toBeGreaterThan(goodBps.components.ALR ?? 0);
    expect(badBps.components.SICR ?? 0).toBeGreaterThan(goodBps.components.SICR ?? 0);
  });
}
