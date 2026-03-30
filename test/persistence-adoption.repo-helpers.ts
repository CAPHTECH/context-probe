import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import type { ComparisonEnvelope } from "./persistence-adoption.helpers.js";
import { ELS_BASE_ENTRY, ELS_MODEL_PATH, POLICY_PATH } from "./persistence-adoption.helpers.js";

const execFile = promisify(execFileCallback);

export async function compareLocality(repoPath: string, modelPath = ELS_MODEL_PATH): Promise<ComparisonEnvelope> {
  const response = await COMMANDS["history.compare_locality_models"]!(
    {
      repo: repoPath,
      model: modelPath,
      policy: POLICY_PATH,
    },
    { cwd: process.cwd() },
  );

  return {
    result: response.result as ComparisonEnvelope["result"],
    confidence: response.confidence,
    unknowns: response.unknowns,
  };
}

export async function materializeGitFixture(tempRoots: string[], initialCommitMessage: string): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([ELS_BASE_ENTRY]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, ELS_BASE_ENTRY);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

export async function buildThreeContextRepo(
  tempRoots: string[],
  initialCommitMessage: string,
): Promise<{ repoPath: string; modelPath: string }> {
  const repoPath = await materializeGitFixture(tempRoots, initialCommitMessage);
  const modelPath = path.join(repoPath, "three-context-model.yaml");
  await writeFile(
    modelPath,
    [
      'version: "1.0"',
      "contexts:",
      "  - name: Billing",
      "    pathGlobs:",
      '      - "src/billing/**"',
      "  - name: Fulfillment",
      "    pathGlobs:",
      '      - "src/fulfillment/**"',
      "  - name: Support",
      "    pathGlobs:",
      '      - "src/support/**"',
    ].join("\n"),
    "utf8",
  );
  return { repoPath, modelPath };
}

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

async function commitAll(repoPath: string, message: string): Promise<void> {
  await runGit(repoPath, ["add", "-A"]);
  await runGitWithIdentity(repoPath, ["commit", "-m", message]);
}

async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await execFile("git", ["branch", "--show-current"], { cwd: repoPath });
  return stdout.trim();
}

async function runGit(repoPath: string, args: string[]): Promise<void> {
  await execFile("git", args, { cwd: repoPath });
}

async function runGitWithIdentity(repoPath: string, args: string[]): Promise<void> {
  await execFile("git", ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", ...args], {
    cwd: repoPath,
  });
}
