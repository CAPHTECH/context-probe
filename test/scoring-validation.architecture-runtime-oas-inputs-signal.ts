import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_BAD_RUNTIME_PATH,
  OAS_BAD_TELEMETRY_PATH,
  OAS_GOOD_RUNTIME_PATH,
  OAS_GOOD_TELEMETRY_PATH,
  OAS_THIN_TELEMETRY_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimeOasInputSignalScoringValidationTests(): void {
  test("OAS is higher when traffic-band operations and pattern runtime both remain healthy", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_BAD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_BAD_RUNTIME_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_THIN_TELEMETRY_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.CommonOps ?? 0).toBeGreaterThan(badOas.components.CommonOps ?? 0);
    expect(goodOas.components.PatternRuntime ?? 0).toBeGreaterThan(badOas.components.PatternRuntime ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("CommonOps"))).toBe(true);
    expect(thinOas.unknowns.some((entry) => entry.includes("PatternRuntime"))).toBe(true);
  });
}
