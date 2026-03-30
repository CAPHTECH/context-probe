import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { commitAll, getCurrentBranch, runGit, runGitWithIdentity } from "./persistence-adoption.repo-helpers-shared.js";

export async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string,
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    const targetPath = path.join(repoPath, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const current = await readFile(targetPath, "utf8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw error;
    });
    await writeFile(targetPath, `${current}${content}`, "utf8");
  }

  await commitAll(repoPath, message);
}

export async function applySupportLocalityBaseline(repoPath: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/support/internal/support-service.ts": "export const supportService = () => 'support-baseline';\n",
    },
    "feat: add support context",
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": "\nexport const billingRepoLocal = 'billing-local';\n",
    },
    "feat: billing local baseline",
  );
  await appendAndCommit(
    repoPath,
    {
      "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRepoLocal = 'fulfillment-local';\n",
    },
    "feat: fulfillment local baseline",
  );
}

export async function applyStablePairPattern(repoPath: string, prefix: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}StableBillingOne = "${prefix}-ab1";\n`,
      "src/fulfillment/internal/fulfillment-service.ts": `\nexport const ${prefix}StableFulfillmentOne = "${prefix}-ab1";\n`,
    },
    `feat: ${prefix} stable pair 1`,
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}StableBillingTwo = "${prefix}-ab2";\n`,
      "src/fulfillment/internal/fulfillment-service.ts": `\nexport const ${prefix}StableFulfillmentTwo = "${prefix}-ab2";\n`,
    },
    `feat: ${prefix} stable pair 2`,
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}StableBillingThree = "${prefix}-ab3";\n`,
      "src/fulfillment/internal/fulfillment-service.ts": `\nexport const ${prefix}StableFulfillmentThree = "${prefix}-ab3";\n`,
    },
    `feat: ${prefix} stable pair 3`,
  );
}

export async function applyRotatingPairPattern(repoPath: string, prefix: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingFulfillmentOne = "${prefix}-ab1";\n`,
      "src/fulfillment/internal/fulfillment-service.ts": `\nexport const ${prefix}FulfillmentBillingOne = "${prefix}-ab1";\n`,
    },
    `feat: ${prefix} rotating pair ab`,
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingSupportOne = "${prefix}-ac1";\n`,
      "src/support/internal/support-service.ts": `\nexport const ${prefix}SupportBillingOne = "${prefix}-ac1";\n`,
    },
    `feat: ${prefix} rotating pair ac`,
  );
  await appendAndCommit(
    repoPath,
    {
      "src/fulfillment/internal/fulfillment-service.ts": `\nexport const ${prefix}FulfillmentSupportOne = "${prefix}-bc1";\n`,
      "src/support/internal/support-service.ts": `\nexport const ${prefix}SupportFulfillmentOne = "${prefix}-bc1";\n`,
    },
    `feat: ${prefix} rotating pair bc`,
  );
}

export async function applyPartiallyConcentratedPattern(repoPath: string, prefix: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingFulfillmentOne = "${prefix}-ab1";\n`,
      "src/fulfillment/internal/fulfillment-service.ts": `\nexport const ${prefix}FulfillmentBillingOne = "${prefix}-ab1";\n`,
    },
    `feat: ${prefix} concentrated pair 1`,
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingFulfillmentTwo = "${prefix}-ab2";\n`,
      "src/fulfillment/internal/fulfillment-service.ts": `\nexport const ${prefix}FulfillmentBillingTwo = "${prefix}-ab2";\n`,
    },
    `feat: ${prefix} concentrated pair 2`,
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingSupportOne = "${prefix}-ac1";\n`,
      "src/support/internal/support-service.ts": `\nexport const ${prefix}SupportBillingOne = "${prefix}-ac1";\n`,
    },
    `feat: ${prefix} concentrated spillover`,
  );
}

export async function renameAndCommit(
  repoPath: string,
  fromPath: string,
  toPath: string,
  message: string,
): Promise<void> {
  await rename(path.join(repoPath, fromPath), path.join(repoPath, toPath));
  await commitAll(repoPath, message);
}

export async function commitOnBranchAndMerge(
  repoPath: string,
  branchName: string,
  updates: Record<string, string>,
  commitMessage: string,
  mergeMessage: string,
): Promise<void> {
  const currentBranch = await getCurrentBranch(repoPath);
  await runGit(repoPath, ["checkout", "-b", branchName]);
  await appendAndCommit(repoPath, updates, commitMessage);
  await runGit(repoPath, ["checkout", currentBranch]);
  await runGitWithIdentity(repoPath, ["merge", "--no-ff", branchName, "-m", mergeMessage]);
}
