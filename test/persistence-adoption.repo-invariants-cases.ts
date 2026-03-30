import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import { appendAndCommit, compareLocality, materializeGitFixture } from "./persistence-adoption.repo-helpers.js";
import { compareCommits } from "./persistence-adoption.synthetic-cases.js";

export function createInvariantAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [
    {
      kind: "confidence",
      id: "thin-history",
      requiredUnknownFragment: "thin",
      build: async () => {
        const repoPath = await materializeGitFixture(tempRoots, "feat: init thin benchmark");
        await appendAndCommit(
          repoPath,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingThinOne = 'billing-thin';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentThinOne = 'fulfillment-thin';\n",
          },
          "feat: thin cross-context update",
        );
        return compareLocality(repoPath);
      },
    },
    {
      kind: "determinism",
      id: "commit-order-invariant",
      build: async () => {
        const commits = [
          { hash: "ab1", subject: "ab1", files: ["src/billing/a.ts", "src/fulfillment/a.ts"] },
          { hash: "ab2", subject: "ab2", files: ["src/billing/b.ts", "src/fulfillment/b.ts"] },
          { hash: "ac1", subject: "ac1", files: ["src/billing/c.ts", "src/support/c.ts"] },
          { hash: "a1", subject: "a1", files: ["src/billing/local.ts"] },
          { hash: "s1", subject: "s1", files: ["src/support/local.ts"] },
        ];

        return {
          forward: compareCommits(commits),
          reversed: compareCommits([...commits].reverse()),
        };
      },
    },
  ];
}
