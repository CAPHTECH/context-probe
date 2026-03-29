import { execFile as execFileCallback } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export async function createTemporaryWorkspace(entries: string[]): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-workspace-"));

  for (const entry of entries) {
    const sourcePath = path.resolve(entry);
    const targetPath = path.join(tempRoot, entry);
    await cp(sourcePath, targetPath, { recursive: true });
  }

  return tempRoot;
}

export async function initializeTemporaryGitRepo(repoPath: string, commitMessage: string): Promise<void> {
  await execFile("git", ["init"], { cwd: repoPath });
  await execFile("git", ["add", "."], { cwd: repoPath });
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", "commit", "-m", commitMessage],
    { cwd: repoPath },
  );
}

export async function createTemporaryGitRepoFromFixture(fixturePath: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-"));
  await cp(fixturePath, tempRoot, { recursive: true });

  await execFile("git", ["init"], { cwd: tempRoot });
  await execFile("git", ["config", "user.email", "tester@example.com"], { cwd: tempRoot });
  await execFile("git", ["config", "user.name", "Context Probe Tester"], { cwd: tempRoot });
  await execFile("git", ["add", "."], { cwd: tempRoot });
  await execFile("git", ["commit", "-m", "feat: initial"], { cwd: tempRoot });

  const billingFile = path.join(tempRoot, "src/billing/contracts/invoice-contract.ts");
  const fulfillmentFile = path.join(tempRoot, "src/fulfillment/internal/fulfillment-service.ts");
  await writeFile(
    billingFile,
    "export interface InvoiceContract {\n  id: string;\n  total: number;\n  currency: string;\n}\n",
    "utf8",
  );
  await writeFile(
    fulfillmentFile,
    `import type { InvoiceContract } from "../../billing/contracts/invoice-contract";
import { BillingInvoiceEntity } from "../../billing/internal/billing-invoice-entity";

export function mapInvoice(contract: InvoiceContract): BillingInvoiceEntity {
  return new BillingInvoiceEntity(\`\${contract.id}:\${contract.currency}\`, contract.total);
}
`,
    "utf8",
  );
  await execFile("git", ["add", "."], { cwd: tempRoot });
  await execFile("git", ["commit", "-m", "feat: cross-context update"], { cwd: tempRoot });

  return tempRoot;
}

export async function cleanupTemporaryRepo(repoPath: string): Promise<void> {
  await rm(repoPath, { recursive: true, force: true });
}
