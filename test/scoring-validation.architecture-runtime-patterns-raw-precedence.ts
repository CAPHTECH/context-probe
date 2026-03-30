import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_EXPORT_GOOD_TELEMETRY_PATH,
  OAS_GOOD_RUNTIME_PATH,
  OAS_GOOD_TELEMETRY_PATH,
  OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_MISMATCH_RUNTIME_PATH,
  OAS_RAW_FAMILY_THIN_RUNTIME_PATH,
  OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
  OAS_RAW_PROFILE_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimePatternRawPrecedenceScoringValidationTests(): void {
  test("OAS keeps raw pattern runtime partials observable and lets raw runtime override embedded telemetry runtime", async () => {
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_THIN_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const mismatchResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MISMATCH_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const precedenceResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_GOOD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const explicitOverrideResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const thinOas = getMetric(thinResponse, "OAS");
    const mismatchOas = getMetric(mismatchResponse, "OAS");
    const precedenceOas = getMetric(precedenceResponse, "OAS");
    const explicitOverrideOas = getMetric(explicitOverrideResponse, "OAS");

    expect(thinOas.unknowns.some((entry) => entry.includes("serviceBasedRuntime"))).toBe(true);
    expect(mismatchOas.unknowns.some((entry) => entry.includes("patternFamily=cqrs"))).toBe(true);
    expect(mismatchOas.confidence).toBeLessThan(0.85);
    expect(
      precedenceOas.unknowns.some((entry) =>
        entry.includes("pattern runtime data inside the telemetry export was not used"),
      ),
    ).toBe(true);
    expect(precedenceOas.components.PatternRuntime ?? 1).toBeLessThan(0.5);
    expect(explicitOverrideOas.unknowns.some((entry) => entry.includes("raw pattern runtime input was not used"))).toBe(
      true,
    );
    expect(explicitOverrideOas.components.PatternRuntime ?? 0).toBeGreaterThan(0.8);
  });
}
