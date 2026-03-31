import { cp, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createTemporaryGitRepoFromFixture } from "./helpers.js";
import { appendAndCommit, FIXTURE_MODEL, FIXTURE_POLICY, FIXTURE_REPO } from "./shadow-rollout-gate.helpers.js";

export interface ShadowRolloutBatchWorkspace {
  baselineRepo: string;
  scatteredRepo: string;
  specRoot: string;
  batchSpecPath: string;
  copiedModelPath: string;
  copiedPolicyPath: string;
}

export async function createShadowRolloutBatchWorkspace(): Promise<ShadowRolloutBatchWorkspace> {
  const baselineRepo = await createTemporaryGitRepoFromFixture(FIXTURE_REPO);
  const scatteredRepo = await createTemporaryGitRepoFromFixture(FIXTURE_REPO);
  const specRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-shadow-batch-"));
  const batchSpecPath = path.join(specRoot, "batch-spec.yaml");
  const copiedModelPath = path.join(specRoot, "model.yaml");
  const copiedPolicyPath = path.join(specRoot, "policy.yaml");

  await cp(FIXTURE_MODEL, copiedModelPath);
  await cp(FIXTURE_POLICY, copiedPolicyPath);

  return { baselineRepo, scatteredRepo, specRoot, batchSpecPath, copiedModelPath, copiedPolicyPath };
}

export async function seedScatteredRepo(repoPath: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/billing/contracts/invoice-contract.ts": "\nexport interface ShadowScatteredInvoiceOne { id: string; }\n",
      "src/fulfillment/internal/fulfillment-service.ts": "\nexport const shadowScatteredOne = 'scattered-1';\n",
    },
    "feat: scattered cross-context 1",
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/contracts/invoice-contract.ts": "\nexport interface ShadowScatteredInvoiceTwo { id: string; }\n",
      "src/fulfillment/internal/fulfillment-service.ts": "\nexport const shadowScatteredTwo = 'scattered-2';\n",
    },
    "feat: scattered cross-context 2",
  );
}

export async function writeShadowRolloutBatchSpec(workspace: ShadowRolloutBatchWorkspace): Promise<void> {
  await writeFile(
    workspace.batchSpecPath,
    [
      'version: "1.0"',
      'policy: "./policy.yaml"',
      "tieTolerance: 0.02",
      "entries:",
      "  - repoId: baseline",
      '    label: "Baseline"',
      '    category: "stable"',
      `    repo: "${workspace.baselineRepo}"`,
      '    model: "./model.yaml"',
      "  - repoId: scattered",
      '    label: "Scattered"',
      '    category: "risky"',
      `    repo: "${workspace.scatteredRepo}"`,
      '    model: "./model.yaml"',
    ].join("\n"),
    "utf8",
  );
}
