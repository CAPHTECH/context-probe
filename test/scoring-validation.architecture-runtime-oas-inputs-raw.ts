import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_RAW_BAD_TELEMETRY_PATH,
  OAS_RAW_GOOD_TELEMETRY_PATH,
  OAS_RAW_PROFILE_PATH,
  OAS_RAW_THIN_TELEMETRY_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimeOasInputRawScoringValidationTests(): void {
  test("OAS also supports raw telemetry observations through an explicit normalization profile", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_GOOD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_BAD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_THIN_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.CommonOps ?? 0).toBeGreaterThan(badOas.components.CommonOps ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("raw"))).toBe(true);
  });
}
