import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import {
  appendAndCommit,
  compareLocality,
  materializeGitFixture,
  renameAndCommit,
} from "./persistence-adoption.repo-helpers.js";

export function createRenameHeavyRobustnessAcceptanceCase(tempRoots: string[]): AcceptanceCase {
  return {
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
          "src/billing/internal/billing-renamed-service.ts": "\nexport const billingRenameVariantOne = 'variant-r1';\n",
          "src/fulfillment/internal/fulfillment-service.ts":
            "\nexport const fulfillmentRenameVariantOne = 'variant-r1';\n",
        },
        "feat: rename variant 1",
      );
      await appendAndCommit(
        renamedRepo,
        {
          "src/billing/internal/billing-renamed-service.ts": "\nexport const billingRenameVariantTwo = 'variant-r2';\n",
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
  };
}
