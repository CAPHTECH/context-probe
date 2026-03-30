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
  renameAndCommit,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryLocalityModelScoringValidationTests(tempRoots: string[]): void {
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

  test("history.compare_locality_models stays invariant under rename-heavy history within the same context", async () => {
    const directRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init direct rename control");
    const renamedRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init rename variant");

    await appendAndCommit(
      directRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRenameControl = 'billing-rename-control';\n",
      },
      "refactor: billing internal cleanup",
    );
    await appendAndCommit(
      directRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRenameControlOne = 'billing-r1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRenameControlOne = 'fulfillment-r1';\n",
      },
      "feat: cross-context rename control 1",
    );
    await appendAndCommit(
      directRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRenameControlTwo = 'billing-r2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRenameControlTwo = 'fulfillment-r2';\n",
      },
      "feat: cross-context rename control 2",
    );

    await renameAndCommit(
      renamedRepo,
      "src/billing/internal/billing-service.ts",
      "src/billing/internal/billing-core.ts",
      "refactor: rename billing service",
    );
    await appendAndCommit(
      renamedRepo,
      {
        "src/billing/internal/billing-core.ts": "\nexport const billingRenameVariantOne = 'billing-r1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRenameVariantOne = 'fulfillment-r1';\n",
      },
      "feat: cross-context rename variant 1",
    );
    await appendAndCommit(
      renamedRepo,
      {
        "src/billing/internal/billing-core.ts": "\nexport const billingRenameVariantTwo = 'billing-r2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentRenameVariantTwo = 'fulfillment-r2';\n",
      },
      "feat: cross-context rename variant 2",
    );

    const directEls = getMetric(
      await COMMANDS["score.compute"]!(
        {
          repo: directRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
          domain: "domain_design",
        },
        { cwd: process.cwd() },
      ),
      "ELS",
    );
    const renamedEls = getMetric(
      await COMMANDS["score.compute"]!(
        {
          repo: renamedRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
          domain: "domain_design",
        },
        { cwd: process.cwd() },
      ),
      "ELS",
    );
    const directComparison = getLocalityComparison(
      await COMMANDS["history.compare_locality_models"]!(
        {
          repo: directRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
        },
        { cwd: process.cwd() },
      ),
    );
    const renamedComparison = getLocalityComparison(
      await COMMANDS["history.compare_locality_models"]!(
        {
          repo: renamedRepo,
          model: ELS_MODEL_PATH,
          policy: POLICY_PATH,
        },
        { cwd: process.cwd() },
      ),
    );

    expect(renamedEls.value).toBeCloseTo(directEls.value, 6);
    expect(renamedComparison.persistenceCandidate.localityScore).toBeCloseTo(
      directComparison.persistenceCandidate.localityScore,
      6,
    );
    expect(renamedComparison.persistenceAnalysis.pairWeights).toEqual(directComparison.persistenceAnalysis.pairWeights);
  }, 20000);

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
