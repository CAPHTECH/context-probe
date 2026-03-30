import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  APSI_BAD_CONSTRAINTS_PATH,
  APSI_FORMULAS,
  APSI_GOOD_CONSTRAINTS_PATH,
  BPS_BAD_REPO,
  BPS_CONSTRAINTS_PATH,
  BPS_GOOD_REPO,
  CTI_BAD_CONSTRAINTS_PATH,
  CTI_BAD_EXPORT_PATH,
  CTI_BAD_REPO,
  CTI_GOOD_CONSTRAINTS_PATH,
  CTI_GOOD_EXPORT_PATH,
  CTI_GOOD_REPO,
  computeApsiFromWeights,
  DATA_FILE_STUB,
  DDS_BAD_REPO,
  DDS_CONSTRAINTS_PATH,
  DDS_GOOD_REPO,
  EES_BAD_DELIVERY_PATH,
  EES_GOOD_DELIVERY_PATH,
  getMetric,
  IPS_BAD_REPO,
  IPS_BASELINE_PATH,
  IPS_BASELINE_SOURCE_FILE_PATH,
  IPS_CONSTRAINTS_PATH,
  IPS_GOOD_REPO,
  OAS_BAD_RUNTIME_PATH,
  OAS_BAD_TELEMETRY_PATH,
  OAS_GOOD_RUNTIME_PATH,
  OAS_GOOD_TELEMETRY_PATH,
  POLICY_PATH,
  QSF_BAD_OBSERVATIONS_PATH,
  QSF_CONSTRAINTS_PATH,
  QSF_GOOD_OBSERVATIONS_PATH,
  QSF_REPO,
  QSF_SCENARIOS_PATH,
  QSF_THIN_OBSERVATIONS_PATH,
  shellQuote,
  TIS_BAD_RUNTIME_PATH,
  TIS_BAD_TOPOLOGY_PATH,
  TIS_GOOD_RUNTIME_PATH,
  TIS_GOOD_TOPOLOGY_PATH,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureCoreScoringValidationTests(tempRoots: string[]): void {
  test("DDS is higher for inward-only dependencies than for violating dependencies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_GOOD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_BAD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodDds = getMetric(goodResponse, "DDS");
    const badDds = getMetric(badResponse, "DDS");

    expect(goodDds.value).toBeGreaterThan(badDds.value);
    expect(goodDds.value).toBe(1);
    expect(badDds.value).toBeLessThan(0.58);
  });

  test("BPS is higher for contained outer-layer code than for leaked and shared internal code", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: BPS_GOOD_REPO,
        constraints: BPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: BPS_BAD_REPO,
        constraints: BPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodBps = getMetric(goodResponse, "BPS");
    const badBps = getMetric(badResponse, "BPS");

    expect(goodBps.value).toBeGreaterThan(badBps.value);
    expect(goodBps.components.FCC ?? 0).toBeGreaterThan(badBps.components.FCC ?? 0);
    expect(badBps.components.ALR ?? 0).toBeGreaterThan(goodBps.components.ALR ?? 0);
    expect(badBps.components.SICR ?? 0).toBeGreaterThan(goodBps.components.SICR ?? 0);
  });

  test("IPS is higher for clean public contracts than for implementation-coupled contracts", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_GOOD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodIps = getMetric(goodResponse, "IPS");
    const badIps = getMetric(badResponse, "IPS");

    expect(goodIps.value).toBeGreaterThan(badIps.value);
    expect(goodIps.components.CBC ?? 0).toBeGreaterThan(badIps.components.CBC ?? 0);
    expect(badIps.components.BCR ?? 0).toBeGreaterThan(goodIps.components.BCR ?? 0);
    expect(goodIps.components.SLA ?? 0).toBeGreaterThan(badIps.components.SLA ?? 0);
  });

  test("IPS also supports contract baseline inputs via direct files and source configs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const commandSource = await writeJsonFixture(tempRoots, "ips-baseline-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(IPS_BASELINE_PATH)}`,
    });

    const fileSourceResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_GOOD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "contract-baseline-source": IPS_BASELINE_SOURCE_FILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const commandSourceResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "contract-baseline-source": commandSource,
      },
      { cwd: process.cwd() },
    );

    const fileSourceIps = getMetric(fileSourceResponse, "IPS");
    const commandSourceIps = getMetric(commandSourceResponse, "IPS");

    expect(fileSourceResponse.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
    expect(commandSourceResponse.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
    expect(fileSourceIps.components.CBC ?? 0).toBeGreaterThan(commandSourceIps.components.CBC ?? 0);
    expect(commandSourceIps.components.BCR ?? 0).toBeGreaterThan(fileSourceIps.components.BCR ?? 0);
    expect(
      fileSourceResponse.evidence.some((entry) => entry.statement.includes("contract baseline source config")),
    ).toBe(true);
    expect(commandSourceResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  });

  test("explicit contract baseline takes precedence over contract baseline sources", async () => {
    const sameSource = await writeJsonFixture(tempRoots, "ips-baseline-precedence.json", {
      version: "1.0",
      sourceType: "file",
      path: IPS_BASELINE_PATH,
    });

    const response = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "contract-baseline": IPS_BASELINE_PATH,
        "contract-baseline-source": sameSource,
      },
      { cwd: process.cwd() },
    );

    expect(response.unknowns).toContain(
      "A contract baseline was provided explicitly, so the contract baseline source was not used.",
    );
    expect(response.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
  });

  test("CTI is lower for lean operational setups than for complexity-heavy setups", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    const goodCti = getMetric(goodResponse, "CTI");
    const badCti = getMetric(badResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(badCti.components.DeployablesPerTeam ?? 0).toBeGreaterThan(goodCti.components.DeployablesPerTeam ?? 0);
    expect(badCti.components.ContractsOrSchemasPerService ?? 0).toBeGreaterThan(
      goodCti.components.ContractsOrSchemasPerService ?? 0,
    );
    expect(badCti.components.SyncDepthOverhead ?? 0).toBeGreaterThan(goodCti.components.SyncDepthOverhead ?? 0);
  });

  test("CTI also ingests operational export bundles and lets export data override fallback metadata", async () => {
    const exportedGoodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_GOOD_EXPORT_PATH,
      },
      { cwd: process.cwd() },
    );
    const exportedBadResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_BAD_EXPORT_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodCti = getMetric(exportedGoodResponse, "CTI");
    const badCti = getMetric(exportedBadResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(goodCti.components.DeployablesPerTeam ?? 1).toBeLessThan(badCti.components.DeployablesPerTeam ?? 0);
    expect(goodCti.unknowns.some((entry) => entry.includes("complexity export"))).toBe(false);
  });

  test("CTI also supports complexity source configs via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "cti-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: CTI_GOOD_EXPORT_PATH,
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "cti-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(CTI_BAD_EXPORT_PATH)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": goodFileSource,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": badCommandSource,
      },
      { cwd: process.cwd() },
    );

    const goodCti = getMetric(goodResponse, "CTI");
    const badCti = getMetric(badResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("complexity source config"))).toBe(true);
    expect(badResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  });

  test("explicit complexity export takes precedence over complexity sources", async () => {
    const goodSource = await writeJsonFixture(tempRoots, "cti-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: CTI_GOOD_EXPORT_PATH,
    });

    const response = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_BAD_EXPORT_PATH,
        "complexity-source": goodSource,
      },
      { cwd: process.cwd() },
    );

    const cti = getMetric(response, "CTI");

    expect(cti.value).toBeGreaterThan(0.4);
    expect(response.unknowns.some((entry) => entry.includes("complexity source was not used"))).toBe(true);
  });

  test("QSF is higher for scenario-observing candidates than for scenario-missing or poor-fit candidates", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_BAD_OBSERVATIONS_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_THIN_OBSERVATIONS_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodQsf = getMetric(goodResponse, "QSF");
    const badQsf = getMetric(badResponse, "QSF");
    const thinQsf = getMetric(thinResponse, "QSF");

    expect(goodQsf.value).toBeGreaterThan(badQsf.value);
    expect(goodQsf.value).toBeGreaterThan(thinQsf.value);
    expect(thinQsf.unknowns.some((entry) => entry.includes("observed value"))).toBe(true);
    expect(goodQsf.components.weighted_coverage ?? 0).toBeGreaterThan(thinQsf.components.weighted_coverage ?? 0);
    expect(goodQsf.components.average_normalized_score ?? 0).toBeGreaterThan(
      badQsf.components.average_normalized_score ?? 0,
    );
  });

  test("QSF also supports scenario observation sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "qsf-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_GOOD_OBSERVATIONS_PATH,
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "qsf-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(QSF_BAD_OBSERVATIONS_PATH)}`,
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "qsf-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_THIN_OBSERVATIONS_PATH,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": goodFileSource,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": badCommandSource,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": thinFileSource,
      },
      { cwd: process.cwd() },
    );

    const goodQsf = getMetric(goodResponse, "QSF");
    const badQsf = getMetric(badResponse, "QSF");
    const thinQsf = getMetric(thinResponse, "QSF");

    expect(goodQsf.value).toBeGreaterThan(badQsf.value);
    expect(goodQsf.value).toBeGreaterThan(thinQsf.value);
    expect(thinQsf.unknowns.some((entry) => entry.includes("observed value"))).toBe(true);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("scenario observation source config"))).toBe(
      true,
    );
  });

  test("explicit scenario observations take precedence over scenario observation sources", async () => {
    const badSource = await writeJsonFixture(tempRoots, "qsf-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_BAD_OBSERVATIONS_PATH,
    });

    const explicitResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
      },
      { cwd: process.cwd() },
    );
    const precedenceResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
        "scenario-observation-source": badSource,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(precedenceResponse, "QSF").value).toBeCloseTo(getMetric(explicitResponse, "QSF").value, 6);
    expect(
      precedenceResponse.unknowns.some((entry) => entry.includes("scenario observation source was not used")),
    ).toBe(true);
  });

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
