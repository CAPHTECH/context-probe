import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  EES_BAD_DELIVERY_PATH,
  EES_BASE_ENTRY,
  EES_BOUNDARY_MAP_PATH,
  EES_CONSTRAINTS_PATH,
  EES_GOOD_DELIVERY_PATH,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureEvolutionDeliveryScoringValidationTests(tempRoots: string[]): void {
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

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(goodEes.components.Locality ?? 0).toBeGreaterThan(badEes.components.Locality ?? 0);
  }, 30000);
}
