import { execFile as execFileCallback } from "node:child_process";
import { chmod } from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const execFile = promisify(execFileCallback);

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const CODEX_STUB = path.resolve("test/fixtures/stubs/codex-stub.mjs");
const MCCS_MODEL_PATH = path.resolve("fixtures/validation/scoring/mccs/model.yaml");
const MCCS_GOOD_ENTRY = "fixtures/validation/scoring/mccs/good-repo";
const MCCS_BAD_ENTRY = "fixtures/validation/scoring/mccs/bad-repo";
const DDS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/dds/constraints.yaml");
const DDS_GOOD_REPO = path.resolve("fixtures/validation/scoring/dds/good-repo");
const DDS_BAD_REPO = path.resolve("fixtures/validation/scoring/dds/bad-repo");
const BPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/bps/constraints.yaml");
const BPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/bps/good-repo");
const BPS_BAD_REPO = path.resolve("fixtures/validation/scoring/bps/bad-repo");
const IPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ips/constraints.yaml");
const IPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/ips/good-repo");
const IPS_BAD_REPO = path.resolve("fixtures/validation/scoring/ips/bad-repo");
const CTI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/good-constraints.yaml");
const CTI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/bad-constraints.yaml");
const CTI_GOOD_REPO = path.resolve("fixtures/validation/scoring/cti/good-repo");
const CTI_BAD_REPO = path.resolve("fixtures/validation/scoring/cti/bad-repo");
const QSF_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/qsf/constraints.yaml");
const QSF_REPO = path.resolve("fixtures/validation/scoring/qsf/repo");
const QSF_SCENARIOS_PATH = path.resolve("fixtures/validation/scoring/qsf/scenarios.yaml");
const QSF_GOOD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/good-observations.yaml");
const QSF_BAD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/bad-observations.yaml");
const QSF_THIN_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/thin-observations.yaml");
const APSI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/good-constraints.yaml");
const APSI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/bad-constraints.yaml");
const TIS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/tis/constraints.yaml");
const TIS_REPO = path.resolve("fixtures/validation/scoring/tis/repo");
const TIS_GOOD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/good-topology.yaml");
const TIS_BAD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/bad-topology.yaml");
const TIS_GOOD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/good-runtime.yaml");
const TIS_BAD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/bad-runtime.yaml");
const AELS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/aels/constraints.yaml");
const AELS_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/aels/boundary-map.yaml");
const AELS_BASE_ENTRY = "fixtures/validation/scoring/aels/base-repo";
const EES_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ees/constraints.yaml");
const EES_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/ees/boundary-map.yaml");
const EES_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/good-delivery.yaml");
const EES_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/bad-delivery.yaml");
const EES_BASE_ENTRY = "fixtures/validation/scoring/ees/base-repo";
const ELS_MODEL_PATH = path.resolve("fixtures/validation/scoring/els/model.yaml");
const ELS_BASE_ENTRY = "fixtures/validation/scoring/els/base-repo";
const BFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/bfs/model.yaml");
const BFS_GOOD_ENTRY = "fixtures/validation/scoring/bfs/good";
const BFS_BAD_ENTRY = "fixtures/validation/scoring/bfs/bad-misaligned";
const AFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/afs/model.yaml");
const AFS_GOOD_ENTRY = "fixtures/validation/scoring/afs/good";
const AFS_BAD_ENTRY = "fixtures/validation/scoring/afs/bad-cross-transaction";
const DRF_MODEL_PATH = path.resolve("fixtures/validation/scoring/drf/model.yaml");
const DRF_GOOD_ENTRY = "fixtures/validation/scoring/drf/good";
const DRF_BAD_ENTRY = "fixtures/validation/scoring/drf/bad-ambiguous";
const ULI_MODEL_PATH = path.resolve("fixtures/validation/scoring/uli/model.yaml");
const ULI_GOOD_ENTRY = "fixtures/validation/scoring/uli/good";
const ULI_BAD_TRACE_ENTRY = "fixtures/validation/scoring/uli/bad-trace";

describe("score validation", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
  });

  test("MCCS is higher for contract-compliant repositories than for leaking repositories", async () => {
    const goodRepo = await materializeGitFixture(MCCS_GOOD_ENTRY, tempRoots, "feat: init good mccs");
    const badRepo = await materializeGitFixture(MCCS_BAD_ENTRY, tempRoots, "feat: init bad mccs");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );

    const goodMccs = getMetric(goodResponse, "MCCS");
    const badMccs = getMetric(badResponse, "MCCS");

    expect(goodMccs.value).toBeGreaterThan(badMccs.value);
    expect(goodMccs.value).toBe(1);
    expect(badMccs.value).toBe(0);
  }, 10000);

  test("DDS is higher for inward-only dependencies than for violating dependencies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_GOOD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_BAD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
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
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: BPS_BAD_REPO,
        constraints: BPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
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
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    const goodIps = getMetric(goodResponse, "IPS");
    const badIps = getMetric(badResponse, "IPS");

    expect(goodIps.value).toBeGreaterThan(badIps.value);
    expect(goodIps.components.CBC ?? 0).toBeGreaterThan(badIps.components.CBC ?? 0);
    expect(badIps.components.BCR ?? 0).toBeGreaterThan(goodIps.components.BCR ?? 0);
    expect(goodIps.components.SLA ?? 0).toBeGreaterThan(badIps.components.SLA ?? 0);
  });

  test("CTI is lower for lean operational setups than for complexity-heavy setups", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    const goodCti = getMetric(goodResponse, "CTI");
    const badCti = getMetric(badResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(badCti.components.DeployablesPerTeam ?? 0).toBeGreaterThan(goodCti.components.DeployablesPerTeam ?? 0);
    expect(badCti.components.ContractsOrSchemasPerService ?? 0).toBeGreaterThan(
      goodCti.components.ContractsOrSchemasPerService ?? 0
    );
    expect(badCti.components.SyncDepthOverhead ?? 0).toBeGreaterThan(goodCti.components.SyncDepthOverhead ?? 0);
  });

  test("QSF is higher for scenario-observing candidates than for scenario-missing or poor-fit candidates", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_BAD_OBSERVATIONS_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_THIN_OBSERVATIONS_PATH
      },
      { cwd: process.cwd() }
    );

    const goodQsf = getMetric(goodResponse, "QSF");
    const badQsf = getMetric(badResponse, "QSF");
    const thinQsf = getMetric(thinResponse, "QSF");

    expect(goodQsf.value).toBeGreaterThan(badQsf.value);
    expect(goodQsf.value).toBeGreaterThan(thinQsf.value);
    expect(thinQsf.unknowns.some((entry) => entry.includes("observed value"))).toBe(true);
    expect(goodQsf.components.weighted_coverage ?? 0).toBeGreaterThan(thinQsf.components.weighted_coverage ?? 0);
    expect(goodQsf.components.average_normalized_score ?? 0).toBeGreaterThan(
      badQsf.components.average_normalized_score ?? 0
    );
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
        "delivery-observations": EES_GOOD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
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
        "delivery-observations": EES_BAD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
    );

    const goodApsi = getMetric(goodResponse, "APSI");
    const badApsi = getMetric(badResponse, "APSI");

    expect(goodApsi.value).toBeGreaterThan(badApsi.value);
    expect(goodApsi.components.QSF ?? 0).toBeGreaterThan(badApsi.components.QSF ?? 0);
    expect(goodApsi.components.OAS ?? 0).toBeGreaterThan(badApsi.components.OAS ?? 0);
    expect(goodApsi.components.EES ?? 0).toBeGreaterThan(badApsi.components.EES ?? 0);
    expect(goodApsi.components.CTI ?? 0).toBeLessThan(badApsi.components.CTI ?? 0);
    expect(goodApsi.unknowns.some((entry) => entry.includes("PCS は DDS/BPS/IPS"))).toBe(true);
    expect(goodApsi.unknowns.some((entry) => entry.includes("OAS は TIS"))).toBe(true);
  });

  test("TIS is higher for isolated topologies than for shared-dependency topologies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_GOOD_TOPOLOGY_PATH,
        "runtime-observations": TIS_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
        "runtime-observations": TIS_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH
      },
      { cwd: process.cwd() }
    );

    const goodTis = getMetric(goodResponse, "TIS");
    const badTis = getMetric(badResponse, "TIS");
    const thinTis = getMetric(thinResponse, "TIS");

    expect(goodTis.value).toBeGreaterThan(badTis.value);
    expect(goodTis.components.FI ?? 0).toBeGreaterThan(badTis.components.FI ?? 0);
    expect(goodTis.components.RC ?? 0).toBeGreaterThan(badTis.components.RC ?? 0);
    expect(badTis.components.SDR ?? 0).toBeGreaterThan(goodTis.components.SDR ?? 0);
    expect(thinTis.unknowns.some((entry) => entry.includes("runtime observation"))).toBe(true);
  });

  test("AELS is higher for architecture histories that stay within boundaries", async () => {
    const localRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels local");
    const scatteredRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels scattered");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalOne = 'billing-local-1';\n"
      },
      "feat: billing local 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentLocalOne = 'fulfillment-local-1';\n"
      },
      "feat: fulfillment local 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalTwo = 'billing-local-2';\n"
      },
      "feat: billing local 2"
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossOne = 'billing-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentCrossOne = 'fulfillment-cross-1';\n"
      },
      "feat: cross-boundary 1"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossTwo = 'billing-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentCrossTwo = 'fulfillment-cross-2';\n"
      },
      "feat: cross-boundary 2"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossThree = 'billing-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentCrossThree = 'fulfillment-cross-3';\n"
      },
      "feat: cross-boundary 3"
    );

    const localResponse = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH
      },
      { cwd: process.cwd() }
    );
    const scatteredResponse = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH
      },
      { cwd: process.cwd() }
    );

    const localAels = getMetric(localResponse, "AELS");
    const scatteredAels = getMetric(scatteredResponse, "AELS");

    expect(localAels.value).toBeGreaterThan(scatteredAels.value);
    expect(scatteredAels.components.CrossBoundaryCoChange ?? 0).toBeGreaterThan(
      localAels.components.CrossBoundaryCoChange ?? 0
    );
    expect(scatteredAels.components.WeightedPropagationCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedPropagationCost ?? 0
    );
    expect(scatteredAels.components.WeightedClusteringCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedClusteringCost ?? 0
    );
  }, 30000);

  test("EES is higher when delivery and architecture locality are both healthy", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryLocalOne = 'billing-delivery-local-1';\n"
      },
      "feat: billing local 1"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryLocalOne = 'fulfillment-delivery-local-1';\n"
      },
      "feat: fulfillment local 1"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryLocalTwo = 'billing-delivery-local-2';\n"
      },
      "feat: billing local 2"
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryCrossOne = 'billing-delivery-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryCrossOne = 'fulfillment-delivery-cross-1';\n"
      },
      "feat: cross-boundary 1"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryCrossTwo = 'billing-delivery-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryCrossTwo = 'fulfillment-delivery-cross-2';\n"
      },
      "feat: cross-boundary 2"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryCrossThree = 'billing-delivery-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryCrossThree = 'fulfillment-delivery-cross-3';\n"
      },
      "feat: cross-boundary 3"
    );

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_BAD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH
      },
      { cwd: process.cwd() }
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(goodEes.components.Locality ?? 0).toBeGreaterThan(badEes.components.Locality ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("delivery observations"))).toBe(true);
  }, 30000);

  test("ELS is higher for localized histories than for scattered histories", async () => {
    const localRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init local history");
    const scatteredRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init scattered history");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRevisionOne = 'billing-1';\n"
      },
      "feat: billing update 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRevisionOne = 'fulfillment-1';\n"
      },
      "feat: fulfillment update 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRevisionTwo = 'billing-2';\n"
      },
      "feat: billing update 2"
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterOne = 'billing-a';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterOne = 'fulfillment-a';\n"
      },
      "feat: cross-context update 1"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterTwo = 'billing-b';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterTwo = 'fulfillment-b';\n"
      },
      "feat: cross-context update 2"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterThree = 'billing-c';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterThree = 'fulfillment-c';\n"
      },
      "feat: cross-context update 3"
    );

    const localResponse = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );
    const scatteredResponse = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );

    const localEls = getMetric(localResponse, "ELS");
    const scatteredEls = getMetric(scatteredResponse, "ELS");

    expect(localEls.value).toBeGreaterThan(scatteredEls.value);
    expect(localEls.value).toBeGreaterThanOrEqual(0.7);
    expect(scatteredEls.value).toBeLessThanOrEqual(0.1);
  }, 20000);

  test("ULI is higher for well-traced glossary terms than for untraced or colliding terms", async () => {
    await chmod(CODEX_STUB, 0o755);

    const goodRoot = await createTemporaryWorkspace([ULI_GOOD_ENTRY]);
    const badTraceRoot = await createTemporaryWorkspace([ULI_BAD_TRACE_ENTRY]);
    tempRoots.push(goodRoot, badTraceRoot);

    const goodRepo = path.join(goodRoot, ULI_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, ULI_GOOD_ENTRY, "docs");
    const badTraceRepo = path.join(badTraceRoot, ULI_BAD_TRACE_ENTRY, "repo");
    const badTraceDocs = path.join(badTraceRoot, ULI_BAD_TRACE_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init uli good");
    await initializeTemporaryGitRepo(badTraceRepo, "feat: init uli bad trace");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badTraceResponse = await COMMANDS["score.compute"]!(
      {
        repo: badTraceRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badTraceDocs
      },
      { cwd: process.cwd() }
    );
    const badCollisionResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs,
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none"
      },
      { cwd: process.cwd() }
    );

    const goodUli = getMetric(goodResponse, "ULI");
    const badTraceUli = getMetric(badTraceResponse, "ULI");
    const badCollisionUli = getMetric(badCollisionResponse, "ULI");

    expect(goodUli.value).toBeGreaterThan(badTraceUli.value);
    expect(goodUli.value).toBeGreaterThan(badCollisionUli.value);
    expect(goodUli.components.TL ?? 0).toBeGreaterThan(badTraceUli.components.TL ?? 0);
    expect(badCollisionUli.components.TC ?? 0).toBeGreaterThan(goodUli.components.TC ?? 0);
  }, 15000);

  test("DRF is higher for explicit rules and invariants than for ambiguous documents", async () => {
    const goodRoot = await createTemporaryWorkspace([DRF_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([DRF_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, DRF_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, DRF_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, DRF_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, DRF_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init drf good");
    await initializeTemporaryGitRepo(badRepo, "feat: init drf bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: DRF_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: DRF_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs
      },
      { cwd: process.cwd() }
    );

    const goodDrf = getMetric(goodResponse, "DRF");
    const badDrf = getMetric(badResponse, "DRF");

    expect(goodDrf.value).toBeGreaterThan(badDrf.value);
    expect(goodDrf.components.RC ?? 0).toBeGreaterThan(badDrf.components.RC ?? 0);
    expect(goodDrf.components.RA ?? 0).toBeGreaterThan(badDrf.components.RA ?? 0);
    expect(badDrf.unknowns).toContain("SC は use case signal ベースの近似です");
  }, 15000);

  test("BFS is higher for context-localized documents than for misaligned shared-boundary documents", async () => {
    const goodRoot = await createTemporaryWorkspace([BFS_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([BFS_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, BFS_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, BFS_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, BFS_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, BFS_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init bfs good");
    await initializeTemporaryGitRepo(badRepo, "feat: init bfs bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: BFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: BFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs
      },
      { cwd: process.cwd() }
    );

    const goodBfs = getMetric(goodResponse, "BFS");
    const badBfs = getMetric(badResponse, "BFS");

    expect(goodBfs.value).toBeGreaterThan(badBfs.value);
    expect(goodBfs.components.A ?? 0).toBeGreaterThan(badBfs.components.A ?? 0);
    expect(goodBfs.components.R ?? 0).toBeGreaterThanOrEqual(badBfs.components.R ?? 0);
  }, 15000);

  test("AFS is higher for localized invariants than for cross-context transaction invariants", async () => {
    const goodRoot = await createTemporaryWorkspace([AFS_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([AFS_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, AFS_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, AFS_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, AFS_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, AFS_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init afs good");
    await initializeTemporaryGitRepo(badRepo, "feat: init afs bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: AFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: AFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs
      },
      { cwd: process.cwd() }
    );

    const goodAfs = getMetric(goodResponse, "AFS");
    const badAfs = getMetric(badResponse, "AFS");

    expect(goodAfs.value).toBeGreaterThan(badAfs.value);
    expect(goodAfs.components.SIC ?? 0).toBeGreaterThan(badAfs.components.SIC ?? 0);
    expect(badAfs.components.XTC ?? 0).toBeGreaterThan(goodAfs.components.XTC ?? 0);
    expect(goodAfs.unknowns).toContain("Aggregate 定義がないため context を aggregate proxy として扱っています");
  }, 15000);
});

async function materializeGitFixture(
  entry: string,
  tempRoots: string[],
  initialCommitMessage: string
): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([entry]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, entry);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    const targetPath = path.join(repoPath, relativePath);
    const current = await readFile(targetPath, "utf8");
    await writeFile(targetPath, `${current}${content}`, "utf8");
  }

  await execFile("git", ["add", "."], { cwd: repoPath });
  await execFile(
    "git",
    [
      "-c",
      "user.email=tester@example.com",
      "-c",
      "user.name=Context Probe Tester",
      "commit",
      "-m",
      message
    ],
    { cwd: repoPath }
  );
}

function getMetric(
  response: Awaited<ReturnType<NonNullable<typeof COMMANDS["score.compute"]>>>,
  metricId: string
) {
  const result = response.result as {
    metrics: Array<{
      metricId: string;
      value: number;
      components: Record<string, number>;
      unknowns: string[];
    }>;
  };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}
