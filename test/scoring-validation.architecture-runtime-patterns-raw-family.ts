import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_GOOD_TELEMETRY_PATH,
  OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH,
  OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
  OAS_RAW_FAMILY_LAYERED_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_LAYERED_GOOD_RUNTIME_PATH,
  OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
  OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimePatternRawFamilyScoringValidationTests(): void {
  test("OAS also derives PatternRuntime from raw family-specific runtime observations", async () => {
    const layeredGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_LAYERED_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const layeredBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_LAYERED_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const microservicesGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const microservicesBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const cqrsGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const cqrsBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const eventDrivenGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const eventDrivenBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(layeredGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(layeredBad, "OAS").components.PatternRuntime ?? 0,
    );
    expect(getMetric(microservicesGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(microservicesBad, "OAS").components.PatternRuntime ?? 0,
    );
    expect(getMetric(cqrsGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(cqrsBad, "OAS").components.PatternRuntime ?? 0,
    );
    expect(getMetric(eventDrivenGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(eventDrivenBad, "OAS").components.PatternRuntime ?? 0,
    );
  });
}
