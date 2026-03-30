import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  AELS_BASE_ENTRY,
  AELS_BOUNDARY_MAP_PATH,
  AELS_CONSTRAINTS_PATH,
  appendAndCommit,
  DATA_FILE_STUB,
  EES_BAD_DELIVERY_PATH,
  EES_BASE_ENTRY,
  EES_BOUNDARY_MAP_PATH,
  EES_CONSTRAINTS_PATH,
  EES_EXPORT_BAD_DELIVERY_PATH,
  EES_EXPORT_GOOD_DELIVERY_PATH,
  EES_EXPORT_THIN_DELIVERY_PATH,
  EES_GOOD_DELIVERY_PATH,
  EES_RAW_BAD_DELIVERY_PATH,
  EES_RAW_GOOD_DELIVERY_PATH,
  EES_RAW_PROFILE_PATH,
  EES_RAW_THIN_DELIVERY_PATH,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
  shellQuote,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureEvolutionScoringValidationTests(tempRoots: string[]): void {
  test("AELS is higher for architecture histories that stay within boundaries", async () => {
    const localRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels local");
    const scatteredRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels scattered");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalOne = 'billing-local-1';\n",
      },
      "feat: billing local 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentLocalOne = 'fulfillment-local-1';\n",
      },
      "feat: fulfillment local 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalTwo = 'billing-local-2';\n",
      },
      "feat: billing local 2",
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossOne = 'billing-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCrossOne = 'fulfillment-cross-1';\n",
      },
      "feat: cross-boundary 1",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossTwo = 'billing-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCrossTwo = 'fulfillment-cross-2';\n",
      },
      "feat: cross-boundary 2",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossThree = 'billing-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCrossThree = 'fulfillment-cross-3';\n",
      },
      "feat: cross-boundary 3",
    );

    const localResponse = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH,
      },
      { cwd: process.cwd() },
    );
    const scatteredResponse = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH,
      },
      { cwd: process.cwd() },
    );

    const localAels = getMetric(localResponse, "AELS");
    const scatteredAels = getMetric(scatteredResponse, "AELS");

    expect(localAels.value).toBeGreaterThan(scatteredAels.value);
    expect(scatteredAels.components.CrossBoundaryCoChange ?? 0).toBeGreaterThan(
      localAels.components.CrossBoundaryCoChange ?? 0,
    );
    expect(scatteredAels.components.WeightedPropagationCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedPropagationCost ?? 0,
    );
    expect(scatteredAels.components.WeightedClusteringCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedClusteringCost ?? 0,
    );
  }, 30000);

  test("EES is higher when delivery and architecture locality are both healthy", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingDeliveryLocalOne = 'billing-delivery-local-1';\n",
      },
      "feat: billing local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentDeliveryLocalOne = 'fulfillment-delivery-local-1';\n",
      },
      "feat: fulfillment local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingDeliveryLocalTwo = 'billing-delivery-local-2';\n",
      },
      "feat: billing local 2",
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingDeliveryCrossOne = 'billing-delivery-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentDeliveryCrossOne = 'fulfillment-delivery-cross-1';\n",
      },
      "feat: cross-boundary 1",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingDeliveryCrossTwo = 'billing-delivery-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentDeliveryCrossTwo = 'fulfillment-delivery-cross-2';\n",
      },
      "feat: cross-boundary 2",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingDeliveryCrossThree = 'billing-delivery-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentDeliveryCrossThree = 'fulfillment-delivery-cross-3';\n",
      },
      "feat: cross-boundary 3",
    );

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_BAD_DELIVERY_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(goodEes.components.Locality ?? 0).toBeGreaterThan(badEes.components.Locality ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("delivery observations"))).toBe(true);
  }, 30000);

  test("EES also supports raw delivery observations through an explicit normalization profile", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees raw good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees raw bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawDeliveryOne = 'billing-raw-1';\n",
      },
      "feat: boundary-local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRawDeliveryOne = 'fulfillment-raw-1';\n",
      },
      "feat: boundary-local 2",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawDeliveryTwo = 'billing-raw-2';\n",
      },
      "feat: boundary-local 3",
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawCrossOne = 'billing-raw-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRawCrossOne = 'fulfillment-raw-cross-1';\n",
      },
      "feat: raw cross-boundary 1",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawCrossTwo = 'billing-raw-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRawCrossTwo = 'fulfillment-raw-cross-2';\n",
      },
      "feat: raw cross-boundary 2",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawCrossThree = 'billing-raw-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRawCrossThree = 'fulfillment-raw-cross-3';\n",
      },
      "feat: raw cross-boundary 3",
    );

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_GOOD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_THIN_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("raw DeployFrequency"))).toBe(true);
  }, 30000);

  test("EES also supports delivery export bundles through the same normalization path", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees export good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees export bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingExportLocalOne = 'billing-export-local-1';\n",
      },
      "feat: export local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentExportLocalOne = 'fulfillment-export-local-1';\n",
      },
      "feat: export local 2",
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingExportCrossOne = 'billing-export-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentExportCrossOne = 'fulfillment-export-cross-1';\n",
      },
      "feat: export cross-boundary 1",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingExportCrossTwo = 'billing-export-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentExportCrossTwo = 'fulfillment-export-cross-2';\n",
      },
      "feat: export cross-boundary 2",
    );

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_GOOD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_THIN_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("delivery export"))).toBe(true);
  }, 30000);

  test("EES also supports delivery sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees source good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees source bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceLocalOne = 'billing-source-local-1';\n",
      },
      "feat: source local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentSourceLocalOne = 'fulfillment-source-local-1';\n",
      },
      "feat: source local 2",
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceCrossOne = 'billing-source-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentSourceCrossOne = 'fulfillment-source-cross-1';\n",
      },
      "feat: source cross-boundary 1",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceCrossTwo = 'billing-source-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentSourceCrossTwo = 'fulfillment-source-cross-2';\n",
      },
      "feat: source cross-boundary 2",
    );

    const goodFileSource = await writeJsonFixture(tempRoots, "ees-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_GOOD_DELIVERY_PATH,
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "ees-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(EES_EXPORT_BAD_DELIVERY_PATH)}`,
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "ees-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_THIN_DELIVERY_PATH,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": goodFileSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": badCommandSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": thinFileSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("delivery export"))).toBe(true);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("delivery source config"))).toBe(true);
    expect(badResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  }, 30000);

  test("normalized delivery observations take precedence over raw, export, and source delivery inputs", async () => {
    const repo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees precedence");

    await appendAndCommit(
      repo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingPrecedenceOne = 'billing-precedence-1';\n",
      },
      "feat: precedence local 1",
    );
    await appendAndCommit(
      repo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentPrecedenceOne = 'fulfillment-precedence-1';\n",
      },
      "feat: precedence local 2",
    );

    const goodSource = await writeJsonFixture(tempRoots, "ees-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_GOOD_DELIVERY_PATH,
    });

    const normalizedResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH,
      },
      { cwd: process.cwd() },
    );
    const precedenceResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH,
        "delivery-raw-observations": EES_RAW_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-export": EES_EXPORT_BAD_DELIVERY_PATH,
        "delivery-source": goodSource,
      },
      { cwd: process.cwd() },
    );

    const normalizedEes = getMetric(normalizedResponse, "EES");
    const precedenceEes = getMetric(precedenceResponse, "EES");

    expect(precedenceEes.components.Delivery ?? 0).toBeCloseTo(normalizedEes.components.Delivery ?? 0, 6);
    expect(precedenceEes.unknowns.some((entry) => entry.includes("A higher-priority delivery input was present"))).toBe(
      true,
    );

    const rawResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-source": goodSource,
      },
      { cwd: process.cwd() },
    );
    expect(rawResponse.unknowns.some((entry) => entry.includes("delivery source was not used"))).toBe(true);

    const exportResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-source": goodSource,
      },
      { cwd: process.cwd() },
    );
    expect(exportResponse.unknowns.some((entry) => entry.includes("delivery source was not used"))).toBe(true);
  }, 30000);
}
