import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_EXPORT_BAD_TELEMETRY_PATH,
  OAS_EXPORT_GOOD_TELEMETRY_PATH,
  OAS_GOOD_RUNTIME_PATH,
  OAS_RAW_GOOD_TELEMETRY_PATH,
  OAS_RAW_PROFILE_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimeOasInputPrecedenceScoringValidationTests(tempRoots: string[]): void {
  test("normalized, raw, and export telemetry inputs take precedence over telemetry sources", async () => {
    const goodSource = await writeJsonFixture(tempRoots, "oas-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: OAS_EXPORT_GOOD_TELEMETRY_PATH,
    });

    const response = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_RAW_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
        "telemetry-source": goodSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const normalizedResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_RAW_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const oas = getMetric(response, "OAS");
    const normalizedOas = getMetric(normalizedResponse, "OAS");
    expect(oas.components.CommonOps ?? 0).toBeCloseTo(normalizedOas.components.CommonOps ?? 0, 8);
    expect(response.unknowns.some((entry) => entry.includes("A higher-priority telemetry input was present"))).toBe(
      true,
    );

    const rawResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_GOOD_TELEMETRY_PATH,
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
        "telemetry-source": goodSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    expect(rawResponse.unknowns.some((entry) => entry.includes("telemetry source was not used"))).toBe(true);

    const exportResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
        "telemetry-source": goodSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    expect(exportResponse.unknowns.some((entry) => entry.includes("telemetry source was not used"))).toBe(true);
  });
}
