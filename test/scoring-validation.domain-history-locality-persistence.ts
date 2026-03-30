import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  ELS_BASE_ENTRY,
  ELS_MODEL_PATH,
  materializeGitFixture,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryLocalityPersistenceScoringValidationTests(tempRoots: string[]): void {
  test("history.analyze_persistence highlights stronger co-change clusters in scattered histories", async () => {
    const localRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init local persistence");
    const scatteredRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init scattered persistence");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingPersistenceOne = 'billing-p1';\n",
      },
      "feat: billing persistence 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentPersistenceOne = 'fulfillment-p1';\n",
      },
      "feat: fulfillment persistence 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingPersistenceTwo = 'billing-p2';\n",
      },
      "feat: billing persistence 2",
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingPersistenceScatterOne = 'billing-sp1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentPersistenceScatterOne = 'fulfillment-sp1';\n",
      },
      "feat: cross-context persistence 1",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingPersistenceScatterTwo = 'billing-sp2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentPersistenceScatterTwo = 'fulfillment-sp2';\n",
      },
      "feat: cross-context persistence 2",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingPersistenceScatterThree = 'billing-sp3';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentPersistenceScatterThree = 'fulfillment-sp3';\n",
      },
      "feat: cross-context persistence 3",
    );

    const localResponse = await COMMANDS["history.analyze_persistence"]!(
      {
        repo: localRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
      },
      { cwd: process.cwd() },
    );
    const scatteredResponse = await COMMANDS["history.analyze_persistence"]!(
      {
        repo: scatteredRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
      },
      { cwd: process.cwd() },
    );

    const localResult = localResponse.result as {
      pairWeights: Array<{ rawCount: number; jaccard: number }>;
      naturalSplitLevels: number[];
    };
    const scatteredResult = scatteredResponse.result as {
      pairWeights: Array<{ rawCount: number; jaccard: number }>;
      naturalSplitLevels: number[];
    };

    expect(scatteredResult.pairWeights[0]?.jaccard ?? 0).toBeGreaterThan(localResult.pairWeights[0]?.jaccard ?? 0);
    expect(scatteredResult.naturalSplitLevels[0] ?? 0).toBeGreaterThan(localResult.naturalSplitLevels[0] ?? 0);
  }, 20000);
}
