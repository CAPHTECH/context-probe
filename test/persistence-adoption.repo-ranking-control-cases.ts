import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import { appendAndCommit, compareLocality, materializeGitFixture } from "./persistence-adoption.repo-helpers.js";
import { balancedPersistentPairCommits, compareCommits, hubCommits } from "./persistence-adoption.synthetic-cases.js";

export function createRankingControlAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [
    {
      kind: "control",
      evidenceLevel: "repo_backed",
      id: "localized-vs-scattered",
      build: async () => {
        const localRepo = await materializeGitFixture(tempRoots, "feat: init localized benchmark");
        const scatteredRepo = await materializeGitFixture(tempRoots, "feat: init scattered benchmark");

        await appendAndCommit(
          localRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingLocalizedOne = 'billing-l1';\n",
          },
          "feat: billing localized 1",
        );
        await appendAndCommit(
          localRepo,
          {
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentLocalizedOne = 'fulfillment-l1';\n",
          },
          "feat: fulfillment localized 1",
        );
        await appendAndCommit(
          localRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingLocalizedTwo = 'billing-l2';\n",
          },
          "feat: billing localized 2",
        );

        await appendAndCommit(
          scatteredRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingScatteredOne = 'billing-s1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentScatteredOne = 'fulfillment-s1';\n",
          },
          "feat: cross-context scattered 1",
        );
        await appendAndCommit(
          scatteredRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingScatteredTwo = 'billing-s2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentScatteredTwo = 'fulfillment-s2';\n",
          },
          "feat: cross-context scattered 2",
        );
        await appendAndCommit(
          scatteredRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingScatteredThree = 'billing-s3';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentScatteredThree = 'fulfillment-s3';\n",
          },
          "feat: cross-context scattered 3",
        );

        return {
          better: (await compareLocality(localRepo)).result,
          worse: (await compareLocality(scatteredRepo)).result,
        };
      },
    },
    {
      kind: "control",
      evidenceLevel: "synthetic",
      id: "hub-vs-balanced-pair",
      build: async () => ({
        better: compareCommits(hubCommits()).result,
        worse: compareCommits(balancedPersistentPairCommits()).result,
      }),
    },
  ];
}
