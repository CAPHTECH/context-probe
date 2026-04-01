import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  APSI_BAD_CONSTRAINTS_PATH,
  APSI_GOOD_CONSTRAINTS_PATH,
  EES_BAD_DELIVERY_PATH,
  EES_GOOD_DELIVERY_PATH,
  getMetric,
  OAS_BAD_RUNTIME_PATH,
  OAS_BAD_TELEMETRY_PATH,
  OAS_GOOD_RUNTIME_PATH,
  OAS_GOOD_TELEMETRY_PATH,
  POLICY_PATH,
  QSF_BAD_OBSERVATIONS_PATH,
  QSF_GOOD_OBSERVATIONS_PATH,
  QSF_REPO,
  QSF_SCENARIOS_PATH,
  TIS_BAD_RUNTIME_PATH,
  TIS_BAD_TOPOLOGY_PATH,
  TIS_GOOD_RUNTIME_PATH,
  TIS_GOOD_TOPOLOGY_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreCompositeApsiScoringValidationTests(): void {
  test("APSI is higher when scenario fit, conformance proxies, runtime proxies, evolution, and complexity tax all align", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: APSI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
        "topology-model": TIS_GOOD_TOPOLOGY_PATH,
        "runtime-observations": TIS_GOOD_RUNTIME_PATH,
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: APSI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_BAD_OBSERVATIONS_PATH,
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
        "runtime-observations": TIS_BAD_RUNTIME_PATH,
        "telemetry-observations": OAS_BAD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_BAD_RUNTIME_PATH,
        "delivery-observations": EES_BAD_DELIVERY_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodApsi = getMetric(goodResponse, "APSI");
    const badApsi = getMetric(badResponse, "APSI");

    expect(goodApsi.value).toBeGreaterThan(badApsi.value);
    expect(goodApsi.components.QSF ?? 0).toBeGreaterThan(badApsi.components.QSF ?? 0);
    expect(goodApsi.components.OAS ?? 0).toBeGreaterThan(badApsi.components.OAS ?? 0);
    expect(goodApsi.components.EES ?? 0).toBeGreaterThan(badApsi.components.EES ?? 0);
    expect(goodApsi.components.CTI ?? 0).toBeLessThan(badApsi.components.CTI ?? 0);
    expect(goodApsi.unknowns.some((entry) => entry.includes("PCS is a proxy composite of DDS, BPS, and IPS."))).toBe(
      false,
    );
    expect(goodApsi.unknowns.some((entry) => entry.includes("OAS is bridged from TIS"))).toBe(false);
  });
}
