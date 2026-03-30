import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_FAMILY_MISMATCH_RUNTIME_PATH,
  OAS_FAMILY_THIN_RUNTIME_PATH,
  OAS_GOOD_TELEMETRY_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimePatternFamilyObservabilityScoringValidationTests(): void {
  test("OAS keeps partial family runtime schemas observable and degrades confidence on mismatches", async () => {
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_THIN_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_MISMATCH_RUNTIME_PATH,
      },
      { cwd: process.cwd() },
    );

    const thinOas = getMetric(thinResponse, "OAS");
    const mismatchOas = getMetric(mismatchResponse, "OAS");

    expect(thinOas.unknowns.some((entry) => entry.includes("serviceBasedRuntime"))).toBe(true);
    expect(mismatchOas.unknowns.some((entry) => entry.includes("legacy score"))).toBe(true);
    expect(mismatchOas.unknowns.some((entry) => entry.includes("patternFamily=microservices"))).toBe(true);
    expect(mismatchOas.components.PatternRuntime ?? 0).toBeGreaterThan(0.8);
    expect(mismatchOas.confidence).toBeLessThan(0.85);
  });
}
