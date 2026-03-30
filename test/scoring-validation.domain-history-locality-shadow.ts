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

export function registerDomainHistoryLocalityShadowScoringValidationTests(tempRoots: string[]): void {
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
}
