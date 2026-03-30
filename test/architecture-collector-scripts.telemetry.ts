import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  COLLECTOR_TELEMETRY_BAD,
  COLLECTOR_TELEMETRY_GOOD,
  COLLECTOR_TELEMETRY_THIN,
  getMetric,
  OAS_RAW_PROFILE_PATH,
  POLICY_PATH,
  shellQuote,
  TELEMETRY_COLLECTOR,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
  writeSourceConfig,
} from "./architecture-collector-scripts.helpers.js";

export function registerArchitectureCollectorTelemetryTests(tempRoots: string[]): void {
  test("score.compute accepts telemetry collector command sources end-to-end", async () => {
    const goodSource = await writeSourceConfig(tempRoots, "telemetry-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(TELEMETRY_COLLECTOR)} ${shellQuote(COLLECTOR_TELEMETRY_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "telemetry-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(TELEMETRY_COLLECTOR)} ${shellQuote(COLLECTOR_TELEMETRY_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "telemetry-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(TELEMETRY_COLLECTOR)} ${shellQuote(COLLECTOR_TELEMETRY_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": goodSource,
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
        "telemetry-source": badSource,
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
        "telemetry-source": thinSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "OAS").value).toBeGreaterThan(getMetric(badResponse, "OAS").value);
    expect(thinResponse.unknowns.some((entry) => entry.includes("telemetry export"))).toBe(true);
  });
}
