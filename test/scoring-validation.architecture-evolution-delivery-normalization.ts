import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
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
} from "./scoring-validation.helpers.js";

export function registerArchitectureEvolutionDeliveryNormalizationScoringValidationTests(tempRoots: string[]): void {
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
}
