import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  COLLECTOR_DELIVERY_BAD,
  COLLECTOR_DELIVERY_GOOD,
  COLLECTOR_DELIVERY_THIN,
  DELIVERY_COLLECTOR,
  EES_BASE_ENTRY,
  EES_BOUNDARY_MAP_PATH,
  EES_CONSTRAINTS_PATH,
  EES_RAW_PROFILE_PATH,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
  shellQuote,
  writeSourceConfig,
} from "./architecture-collector-scripts.helpers.js";

export function registerArchitectureCollectorDeliveryTests(tempRoots: string[]): void {
  test("score.compute accepts delivery collector command sources end-to-end", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init collector ees good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init collector ees bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingCollectorLocalOne = 'billing-collector-local-1';\n",
      },
      "feat: collector local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCollectorLocalOne = 'fulfillment-collector-local-1';\n",
      },
      "feat: collector local 2",
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingCollectorCrossOne = 'billing-collector-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCollectorCrossOne = 'fulfillment-collector-cross-1';\n",
      },
      "feat: collector cross 1",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingCollectorCrossTwo = 'billing-collector-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCollectorCrossTwo = 'fulfillment-collector-cross-2';\n",
      },
      "feat: collector cross 2",
    );

    const goodSource = await writeSourceConfig(tempRoots, "delivery-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(DELIVERY_COLLECTOR)} ${shellQuote(COLLECTOR_DELIVERY_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "delivery-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(DELIVERY_COLLECTOR)} ${shellQuote(COLLECTOR_DELIVERY_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "delivery-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(DELIVERY_COLLECTOR)} ${shellQuote(COLLECTOR_DELIVERY_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": goodSource,
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
        "delivery-source": badSource,
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
        "delivery-source": thinSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "EES").value).toBeGreaterThan(getMetric(badResponse, "EES").value);
    expect(getMetric(thinResponse, "EES").unknowns.some((entry) => entry.includes("DeployFreqScore"))).toBe(true);
  }, 30000);
}
