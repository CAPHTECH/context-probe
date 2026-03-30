import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  ELS_BASE_ENTRY,
  ELS_MODEL_PATH,
  getLocalityComparison,
  materializeGitFixture,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryLocalityOrderingScoringValidationTests(tempRoots: string[]): void {
  test("history.compare_locality_models preserves localized-vs-scattered ordering for both models", async () => {
    const localRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init local comparison");
    const scatteredRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init scattered comparison");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingComparisonOne = 'billing-c1';\n",
      },
      "feat: billing comparison 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentComparisonOne = 'fulfillment-c1';\n",
      },
      "feat: fulfillment comparison 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingComparisonTwo = 'billing-c2';\n",
      },
      "feat: billing comparison 2",
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingComparisonScatterOne = 'billing-cs1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentComparisonScatterOne = 'fulfillment-cs1';\n",
      },
      "feat: cross-context comparison 1",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingComparisonScatterTwo = 'billing-cs2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentComparisonScatterTwo = 'fulfillment-cs2';\n",
      },
      "feat: cross-context comparison 2",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingComparisonScatterThree = 'billing-cs3';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentComparisonScatterThree = 'fulfillment-cs3';\n",
      },
      "feat: cross-context comparison 3",
    );

    const localComparison = getLocalityComparison(
      await COMMANDS["history.compare_locality_models"]!(
        {
          repo: localRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
        },
        { cwd: process.cwd() },
      ),
    );
    const scatteredComparison = getLocalityComparison(
      await COMMANDS["history.compare_locality_models"]!(
        {
          repo: scatteredRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
        },
        { cwd: process.cwd() },
      ),
    );

    expect(localComparison.els.score).toBeGreaterThan(scatteredComparison.els.score);
    expect(localComparison.persistenceCandidate.localityScore).toBeGreaterThan(
      scatteredComparison.persistenceCandidate.localityScore,
    );
    expect(scatteredComparison.persistenceCandidate.persistentCouplingPenalty).toBeGreaterThan(
      localComparison.persistenceCandidate.persistentCouplingPenalty,
    );
  }, 20000);
}
