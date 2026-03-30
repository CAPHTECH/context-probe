import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import type { AcceptanceCase, ComparisonEnvelope } from "./persistence-adoption.helpers.js";
import { ELS_BASE_ENTRY, ELS_MODEL_PATH, POLICY_PATH } from "./persistence-adoption.helpers.js";
import {
  balancedPersistentPairCommits,
  compareCommits,
  hubCommits,
  partiallyConcentratedCommits,
  rotatingPairCommits,
  stablePairCommits,
} from "./persistence-adoption.synthetic-cases.js";

const execFile = promisify(execFileCallback);

async function compareLocality(repoPath: string, modelPath = ELS_MODEL_PATH): Promise<ComparisonEnvelope> {
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

async function materializeGitFixture(tempRoots: string[], initialCommitMessage: string): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([ELS_BASE_ENTRY]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, ELS_BASE_ENTRY);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

async function buildThreeContextRepo(
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

async function appendAndCommit(repoPath: string, updates: Record<string, string>, message: string): Promise<void> {
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

async function applySupportLocalityBaseline(repoPath: string): Promise<void> {
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

async function applyStablePairPattern(repoPath: string, prefix: string): Promise<void> {
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

async function applyRotatingPairPattern(repoPath: string, prefix: string): Promise<void> {
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

async function applyPartiallyConcentratedPattern(repoPath: string, prefix: string): Promise<void> {
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

async function renameAndCommit(repoPath: string, fromPath: string, toPath: string, message: string): Promise<void> {
  await rename(path.join(repoPath, fromPath), path.join(repoPath, toPath));
  await commitAll(repoPath, message);
}

async function commitOnBranchAndMerge(
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

export function createAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
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
    {
      kind: "advantage",
      evidenceLevel: "synthetic",
      id: "rotating-pairs-vs-stable-pair",
      build: async () => ({
        better: compareCommits(rotatingPairCommits()).result,
        worse: compareCommits(stablePairCommits()).result,
      }),
    },
    {
      kind: "advantage",
      evidenceLevel: "synthetic",
      id: "partially-concentrated-vs-stable-pair",
      build: async () => ({
        better: compareCommits(partiallyConcentratedCommits()).result,
        worse: compareCommits(stablePairCommits()).result,
      }),
    },
    {
      kind: "advantage",
      evidenceLevel: "repo_backed",
      id: "repo-backed-rotating-pairs-vs-stable-pair",
      build: async () => {
        const stable = await buildThreeContextRepo(tempRoots, "feat: init stable pair repo");
        const rotating = await buildThreeContextRepo(tempRoots, "feat: init rotating pair repo");

        await applySupportLocalityBaseline(stable.repoPath);
        await applySupportLocalityBaseline(rotating.repoPath);
        await applyStablePairPattern(stable.repoPath, "stable");
        await applyRotatingPairPattern(rotating.repoPath, "rotating");

        return {
          better: (await compareLocality(rotating.repoPath, rotating.modelPath)).result,
          worse: (await compareLocality(stable.repoPath, stable.modelPath)).result,
        };
      },
    },
    {
      kind: "advantage",
      evidenceLevel: "repo_backed",
      id: "repo-backed-partially-concentrated-vs-stable-pair",
      build: async () => {
        const stable = await buildThreeContextRepo(tempRoots, "feat: init stable partial repo");
        const partial = await buildThreeContextRepo(tempRoots, "feat: init partial concentration repo");

        await applySupportLocalityBaseline(stable.repoPath);
        await applySupportLocalityBaseline(partial.repoPath);
        await applyStablePairPattern(stable.repoPath, "stable-partial");
        await applyPartiallyConcentratedPattern(partial.repoPath, "partial");

        return {
          better: (await compareLocality(partial.repoPath, partial.modelPath)).result,
          worse: (await compareLocality(stable.repoPath, stable.modelPath)).result,
        };
      },
    },
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
