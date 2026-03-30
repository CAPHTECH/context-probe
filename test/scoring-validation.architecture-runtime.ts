import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  DATA_FILE_STUB,
  getMetric,
  OAS_BAD_RUNTIME_PATH,
  OAS_BAD_TELEMETRY_PATH,
  OAS_EXPORT_BAD_TELEMETRY_PATH,
  OAS_EXPORT_GOOD_TELEMETRY_PATH,
  OAS_EXPORT_THIN_TELEMETRY_PATH,
  OAS_FAMILY_CQRS_BAD_RUNTIME_PATH,
  OAS_FAMILY_CQRS_GOOD_RUNTIME_PATH,
  OAS_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
  OAS_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
  OAS_FAMILY_LAYERED_BAD_RUNTIME_PATH,
  OAS_FAMILY_LAYERED_GOOD_RUNTIME_PATH,
  OAS_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
  OAS_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
  OAS_FAMILY_MISMATCH_RUNTIME_PATH,
  OAS_FAMILY_THIN_RUNTIME_PATH,
  OAS_GOOD_RUNTIME_PATH,
  OAS_GOOD_TELEMETRY_PATH,
  OAS_RAW_BAD_TELEMETRY_PATH,
  OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH,
  OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
  OAS_RAW_FAMILY_LAYERED_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_LAYERED_GOOD_RUNTIME_PATH,
  OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
  OAS_RAW_FAMILY_MISMATCH_RUNTIME_PATH,
  OAS_RAW_FAMILY_THIN_RUNTIME_PATH,
  OAS_RAW_GOOD_TELEMETRY_PATH,
  OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
  OAS_RAW_PROFILE_PATH,
  OAS_RAW_THIN_TELEMETRY_PATH,
  OAS_THIN_TELEMETRY_PATH,
  POLICY_PATH,
  shellQuote,
  TIS_BAD_RUNTIME_PATH,
  TIS_BAD_TOPOLOGY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_GOOD_RUNTIME_PATH,
  TIS_GOOD_TOPOLOGY_PATH,
  TIS_REPO,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimeScoringValidationTests(tempRoots: string[]): void {
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

  test("OAS also supports raw telemetry observations through an explicit normalization profile", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_GOOD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
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
        "telemetry-raw-observations": OAS_RAW_BAD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
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

  test("OAS also supports telemetry sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "oas-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: OAS_EXPORT_GOOD_TELEMETRY_PATH,
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "oas-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(OAS_EXPORT_BAD_TELEMETRY_PATH)}`,
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "oas-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: OAS_EXPORT_THIN_TELEMETRY_PATH,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": goodFileSource,
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
        "telemetry-source": badCommandSource,
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
        "telemetry-source": thinFileSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.CommonOps ?? 0).toBeGreaterThan(badOas.components.CommonOps ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("telemetry export"))).toBe(true);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("telemetry source config"))).toBe(true);
    expect(badResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  });

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
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
        "telemetry-source": goodSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const oas = getMetric(response, "OAS");

    expect(oas.components.CommonOps ?? 0).toBeGreaterThan(0.7);
    expect(oas.unknowns.some((entry) => entry.includes("A higher-priority telemetry input was present"))).toBe(true);

    const rawResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_BAD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
        "telemetry-source": goodSource,
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

  test("OAS derives PatternRuntime from family-specific runtime schemas", async () => {
    const layeredGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_LAYERED_GOOD_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_LAYERED_BAD_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_CQRS_GOOD_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_CQRS_BAD_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
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
        "pattern-runtime-observations": OAS_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
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

  test("TIS is higher for isolated topologies than for shared-dependency topologies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_GOOD_TOPOLOGY_PATH,
        "runtime-observations": TIS_GOOD_RUNTIME_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
        "runtime-observations": TIS_BAD_RUNTIME_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodTis = getMetric(goodResponse, "TIS");
    const badTis = getMetric(badResponse, "TIS");
    const thinTis = getMetric(thinResponse, "TIS");

    expect(goodTis.value).toBeGreaterThan(badTis.value);
    expect(goodTis.components.FI ?? 0).toBeGreaterThan(badTis.components.FI ?? 0);
    expect(goodTis.components.RC ?? 0).toBeGreaterThan(badTis.components.RC ?? 0);
    expect(badTis.components.SDR ?? 0).toBeGreaterThan(goodTis.components.SDR ?? 0);
    expect(thinTis.unknowns.some((entry) => entry.includes("static proxy"))).toBe(true);
  });
}
