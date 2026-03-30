import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  ELS_BASE_ENTRY,
  ELS_MODEL_PATH,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryLocalityScoringValidationTests(tempRoots: string[]): void {
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
}
