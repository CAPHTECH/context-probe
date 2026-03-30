import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  commitOnBranchAndMerge,
  ELS_BASE_ENTRY,
  ELS_MODEL_PATH,
  getLocalityComparison,
  getMetric,
  MCCS_BAD_ENTRY,
  MCCS_GOOD_ENTRY,
  MCCS_MODEL_PATH,
  materializeGitFixture,
  POLICY_PATH,
  renameAndCommit,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryScoringValidationTests(tempRoots: string[]): void {
  test("MCCS is higher for contract-compliant repositories than for leaking repositories", async () => {
    const goodRepo = await materializeGitFixture(MCCS_GOOD_ENTRY, tempRoots, "feat: init good mccs");
    const badRepo = await materializeGitFixture(MCCS_BAD_ENTRY, tempRoots, "feat: init bad mccs");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    const goodMccs = getMetric(goodResponse, "MCCS");
    const badMccs = getMetric(badResponse, "MCCS");

    expect(goodMccs.value).toBeGreaterThan(badMccs.value);
    expect(goodMccs.value).toBe(1);
    expect(badMccs.value).toBe(0);
  }, 20000);

  test("ELS is higher for localized histories than for scattered histories", async () => {
    const localRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init local history");
    const scatteredRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init scattered history");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRevisionOne = 'billing-1';\n",
      },
      "feat: billing update 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRevisionOne = 'fulfillment-1';\n",
      },
      "feat: fulfillment update 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRevisionTwo = 'billing-2';\n",
      },
      "feat: billing update 2",
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterOne = 'billing-a';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterOne = 'fulfillment-a';\n",
      },
      "feat: cross-context update 1",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterTwo = 'billing-b';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterTwo = 'fulfillment-b';\n",
      },
      "feat: cross-context update 2",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterThree = 'billing-c';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentScatterThree = 'fulfillment-c';\n",
      },
      "feat: cross-context update 3",
    );

    const localResponse = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const scatteredResponse = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    const localEls = getMetric(localResponse, "ELS");
    const scatteredEls = getMetric(scatteredResponse, "ELS");

    expect(localEls.value).toBeGreaterThan(scatteredEls.value);
    expect(localEls.value).toBeGreaterThanOrEqual(0.7);
    expect(scatteredEls.value).toBeLessThanOrEqual(0.1);
  }, 20000);

  test("score.compute shadow rollout preserves ELS and exposes persistence ordering", async () => {
    const localRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init local shadow");
    const scatteredRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init scattered shadow");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingShadowOne = 'billing-shadow-1';\n",
      },
      "feat: billing shadow 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentShadowOne = 'fulfillment-shadow-1';\n",
      },
      "feat: fulfillment shadow 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingShadowTwo = 'billing-shadow-2';\n",
      },
      "feat: billing shadow 2",
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingShadowScatterOne = 'billing-shadow-s1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentShadowScatterOne = 'fulfillment-shadow-s1';\n",
      },
      "feat: cross-context shadow 1",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingShadowScatterTwo = 'billing-shadow-s2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentShadowScatterTwo = 'fulfillment-shadow-s2';\n",
      },
      "feat: cross-context shadow 2",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingShadowScatterThree = 'billing-shadow-s3';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentShadowScatterThree = 'fulfillment-shadow-s3';\n",
      },
      "feat: cross-context shadow 3",
    );

    const localBaseline = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const localShadow = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "shadow-persistence": true,
      },
      { cwd: process.cwd() },
    );
    const scatteredShadow = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "shadow-persistence": true,
      },
      { cwd: process.cwd() },
    );

    const localBaselineEls = getMetric(localBaseline, "ELS");
    const localShadowEls = getMetric(localShadow, "ELS");
    const localShadowResult = localShadow.result as {
      shadow?: {
        localityModels: {
          persistenceCandidate: { localityScore: number };
        };
      };
    };
    const scatteredShadowResult = scatteredShadow.result as {
      shadow?: {
        localityModels: {
          persistenceCandidate: { localityScore: number };
        };
      };
    };

    expect(localShadowEls.value).toBeCloseTo(localBaselineEls.value, 8);
    expect(localShadowResult.shadow?.localityModels.persistenceCandidate.localityScore ?? 0).toBeGreaterThan(
      scatteredShadowResult.shadow?.localityModels.persistenceCandidate.localityScore ?? 0,
    );
  }, 20000);

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
