import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  DATA_FILE_STUB,
  getMetric,
  OAS_EXPORT_BAD_TELEMETRY_PATH,
  OAS_EXPORT_GOOD_TELEMETRY_PATH,
  OAS_EXPORT_THIN_TELEMETRY_PATH,
  OAS_RAW_PROFILE_PATH,
  POLICY_PATH,
  shellQuote,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimeOasInputSourceScoringValidationTests(tempRoots: string[]): void {
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
}
