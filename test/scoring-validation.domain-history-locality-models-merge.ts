import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  commitOnBranchAndMerge,
  ELS_BASE_ENTRY,
  ELS_MODEL_PATH,
  getLocalityComparison,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryLocalityMergeScoringValidationTests(tempRoots: string[]): void {
  test("history.compare_locality_models ignores merge-only noise when non-merge commits are unchanged", async () => {
    const linearRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init linear merge control");
    const mergedRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init merged comparison");

    await appendAndCommit(
      linearRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingMergeControl = 'billing-merge-control';\n",
      },
      "refactor: billing merge control",
    );
    await appendAndCommit(
      linearRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingMergeOne = 'billing-m1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentMergeOne = 'fulfillment-m1';\n",
      },
      "feat: cross-context merge control 1",
    );
    await appendAndCommit(
      linearRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingMergeTwo = 'billing-m2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentMergeTwo = 'fulfillment-m2';\n",
      },
      "feat: cross-context merge control 2",
    );

    await commitOnBranchAndMerge(
      mergedRepo,
      "merge-noise",
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingMergeControl = 'billing-merge-control';\n",
      },
      "refactor: billing merge control",
      "merge: merge billing refactor branch",
    );
    await appendAndCommit(
      mergedRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingMergeOne = 'billing-m1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentMergeOne = 'fulfillment-m1';\n",
      },
      "feat: cross-context merge control 1",
    );
    await appendAndCommit(
      mergedRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingMergeTwo = 'billing-m2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentMergeTwo = 'fulfillment-m2';\n",
      },
      "feat: cross-context merge control 2",
    );

    const linearEls = getMetric(
      await COMMANDS["score.compute"]!(
        {
          repo: linearRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
          domain: "domain_design",
        },
        { cwd: process.cwd() },
      ),
      "ELS",
    );
    const mergedEls = getMetric(
      await COMMANDS["score.compute"]!(
        {
          repo: mergedRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
          domain: "domain_design",
        },
        { cwd: process.cwd() },
      ),
      "ELS",
    );
    const linearComparison = getLocalityComparison(
      await COMMANDS["history.compare_locality_models"]!(
        {
          repo: linearRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
        },
        { cwd: process.cwd() },
      ),
    );
    const mergedComparison = getLocalityComparison(
      await COMMANDS["history.compare_locality_models"]!(
        {
          repo: mergedRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
        },
        { cwd: process.cwd() },
      ),
    );

    expect(mergedEls.value).toBeCloseTo(linearEls.value, 6);
    expect(mergedComparison.persistenceCandidate.localityScore).toBeCloseTo(
      linearComparison.persistenceCandidate.localityScore,
      6,
    );
    expect(mergedComparison.persistenceAnalysis.pairWeights).toEqual(linearComparison.persistenceAnalysis.pairWeights);
  }, 20000);
}
