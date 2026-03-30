import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  APSI_BAD_CONSTRAINTS_PATH,
  APSI_FORMULAS,
  APSI_GOOD_CONSTRAINTS_PATH,
  computeApsiFromWeights,
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

export function registerArchitectureCoreCompositeScoringValidationTests(): void {
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
      true,
    );
    expect(goodApsi.unknowns.some((entry) => entry.includes("OAS is bridged from TIS"))).toBe(false);
  });

  test("APSI follows the selected policy profile weights without changing supporting metrics", async () => {
    const baseArgs = {
      repo: QSF_REPO,
      constraints: APSI_GOOD_CONSTRAINTS_PATH,
      policy: POLICY_PATH,
      domain: "architecture_design",
      "scenario-catalog": QSF_SCENARIOS_PATH,
      "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
      "topology-model": TIS_GOOD_TOPOLOGY_PATH,
      "runtime-observations": TIS_GOOD_RUNTIME_PATH,
      "telemetry-observations": OAS_BAD_TELEMETRY_PATH,
      "pattern-runtime-observations": OAS_BAD_RUNTIME_PATH,
      "delivery-observations": EES_BAD_DELIVERY_PATH,
    } as const;

    const defaultResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "default",
      },
      { cwd: process.cwd() },
    );
    const layeredResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "layered",
      },
      { cwd: process.cwd() },
    );
    const serviceBasedResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "service_based",
      },
      { cwd: process.cwd() },
    );
    const cqrsResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "cqrs",
      },
      { cwd: process.cwd() },
    );
    const eventDrivenResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "event_driven",
      },
      { cwd: process.cwd() },
    );

    const defaultApsi = getMetric(defaultResponse, "APSI");
    const layeredApsi = getMetric(layeredResponse, "APSI");
    const serviceBasedApsi = getMetric(serviceBasedResponse, "APSI");
    const cqrsApsi = getMetric(cqrsResponse, "APSI");
    const eventDrivenApsi = getMetric(eventDrivenResponse, "APSI");

    expect(layeredApsi.components).toEqual(defaultApsi.components);
    expect(serviceBasedApsi.components).toEqual(defaultApsi.components);
    expect(cqrsApsi.components).toEqual(defaultApsi.components);
    expect(eventDrivenApsi.components).toEqual(defaultApsi.components);

    expect(defaultApsi.value).toBeCloseTo(computeApsiFromWeights(defaultApsi.components, APSI_FORMULAS.default), 10);
    expect(layeredApsi.value).toBeCloseTo(computeApsiFromWeights(layeredApsi.components, APSI_FORMULAS.layered), 10);
    expect(serviceBasedApsi.value).toBeCloseTo(
      computeApsiFromWeights(serviceBasedApsi.components, APSI_FORMULAS.service_based),
      10,
    );
    expect(cqrsApsi.value).toBeCloseTo(computeApsiFromWeights(cqrsApsi.components, APSI_FORMULAS.cqrs), 10);
    expect(eventDrivenApsi.value).toBeCloseTo(
      computeApsiFromWeights(eventDrivenApsi.components, APSI_FORMULAS.event_driven),
      10,
    );

    expect(layeredApsi.value).not.toBeCloseTo(defaultApsi.value, 10);
    expect(serviceBasedApsi.value).not.toBeCloseTo(defaultApsi.value, 10);
    expect(layeredApsi.unknowns.some((entry) => entry.includes("layered policy profile"))).toBe(true);
    expect(serviceBasedApsi.unknowns.some((entry) => entry.includes("service_based policy profile"))).toBe(true);
  });
}
