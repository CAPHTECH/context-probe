import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import {
  appendAndCommit,
  commitOnBranchAndMerge,
  compareLocality,
  materializeGitFixture,
} from "./persistence-adoption.repo-helpers.js";

export function createMergeOnlyRobustnessAcceptanceCase(tempRoots: string[]): AcceptanceCase {
  return {
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
  };
}
