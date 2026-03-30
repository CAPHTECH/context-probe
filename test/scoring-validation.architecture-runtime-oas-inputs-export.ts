import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_EXPORT_BAD_TELEMETRY_PATH,
  OAS_EXPORT_GOOD_TELEMETRY_PATH,
  OAS_EXPORT_THIN_TELEMETRY_PATH,
  OAS_RAW_PROFILE_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimeOasInputExportScoringValidationTests(): void {
  test("OAS also supports telemetry export bundles and embedded runtime observations", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_GOOD_TELEMETRY_PATH,
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
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
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
        "telemetry-export": OAS_EXPORT_THIN_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.PatternRuntime ?? 0).toBeGreaterThan(badOas.components.PatternRuntime ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("telemetry export"))).toBe(true);
    expect(thinOas.unknowns.some((entry) => entry.includes("PatternRuntime"))).toBe(true);
  });
}
