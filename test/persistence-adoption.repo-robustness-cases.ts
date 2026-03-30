import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import {
  appendAndCommit,
  commitOnBranchAndMerge,
  compareLocality,
  materializeGitFixture,
  renameAndCommit,
} from "./persistence-adoption.repo-helpers.js";

export function createRobustnessAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [
    {
      kind: "robustness",
      id: "rename-heavy-same-context",
      build: async () => {
        const baselineRepo = await materializeGitFixture(tempRoots, "feat: init baseline rename");
        const renamedRepo = await materializeGitFixture(tempRoots, "feat: init renamed variant");

        await appendAndCommit(
          baselineRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingRenameBaseline = 'baseline';\n",
          },
          "refactor: billing baseline",
        );
        await appendAndCommit(
          baselineRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingRenameBaselineOne = 'baseline-r1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameBaselineOne = 'baseline-r1';\n",
          },
          "feat: rename baseline 1",
        );
        await appendAndCommit(
          baselineRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingRenameBaselineTwo = 'baseline-r2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameBaselineTwo = 'baseline-r2';\n",
          },
          "feat: rename baseline 2",
        );

        await renameAndCommit(
          renamedRepo,
          "src/billing/internal/billing-service.ts",
          "src/billing/internal/billing-renamed-service.ts",
          "refactor: rename billing service",
        );
        await appendAndCommit(
          renamedRepo,
          {
            "src/billing/internal/billing-renamed-service.ts":
              "\nexport const billingRenameVariantOne = 'variant-r1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameVariantOne = 'variant-r1';\n",
          },
          "feat: rename variant 1",
        );
        await appendAndCommit(
          renamedRepo,
          {
            "src/billing/internal/billing-renamed-service.ts":
              "\nexport const billingRenameVariantTwo = 'variant-r2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameVariantTwo = 'variant-r2';\n",
          },
          "feat: rename variant 2",
        );

        return {
          baseline: (await compareLocality(baselineRepo)).result,
          variant: (await compareLocality(renamedRepo)).result,
        };
      },
    },
    {
      kind: "robustness",
      id: "merge-only-noise",
      build: async () => {
        const linearRepo = await materializeGitFixture(tempRoots, "feat: init linear control");
        const mergedRepo = await materializeGitFixture(tempRoots, "feat: init merged variant");

        await appendAndCommit(
          linearRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinear = 'billing-merge-linear';\n",
          },
          "refactor: billing merge control",
        );
        await appendAndCommit(
          linearRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearOne = 'billing-m1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearOne = 'fulfillment-m1';\n",
          },
          "feat: merge control 1",
        );
        await appendAndCommit(
          linearRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearTwo = 'billing-m2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearTwo = 'fulfillment-m2';\n",
          },
          "feat: merge control 2",
        );

        await commitOnBranchAndMerge(
          mergedRepo,
          "feature/merge-noise",
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinear = 'billing-merge-linear';\n",
          },
          "refactor: billing merge control",
          "merge: merge billing refactor branch",
        );
        await appendAndCommit(
          mergedRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearOne = 'billing-m1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearOne = 'fulfillment-m1';\n",
          },
          "feat: merge control 1",
        );
        await appendAndCommit(
          mergedRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearTwo = 'billing-m2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearTwo = 'fulfillment-m2';\n",
          },
          "feat: merge control 2",
        );

        return {
          baseline: (await compareLocality(linearRepo)).result,
          variant: (await compareLocality(mergedRepo)).result,
        };
      },
    },
  ];
}
