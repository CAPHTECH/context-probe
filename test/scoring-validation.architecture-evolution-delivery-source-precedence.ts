import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  EES_BASE_ENTRY,
  EES_BOUNDARY_MAP_PATH,
  EES_CONSTRAINTS_PATH,
  EES_EXPORT_BAD_DELIVERY_PATH,
  EES_EXPORT_GOOD_DELIVERY_PATH,
  EES_GOOD_DELIVERY_PATH,
  EES_RAW_BAD_DELIVERY_PATH,
  EES_RAW_PROFILE_PATH,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureEvolutionDeliverySourcePrecedenceTests(tempRoots: string[]): void {
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
