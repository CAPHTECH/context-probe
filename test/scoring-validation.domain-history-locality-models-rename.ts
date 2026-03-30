import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  ELS_BASE_ENTRY,
  ELS_MODEL_PATH,
  getLocalityComparison,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
  renameAndCommit,
} from "./scoring-validation.helpers.js";

export function registerDomainHistoryLocalityRenameScoringValidationTests(tempRoots: string[]): void {
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
}
