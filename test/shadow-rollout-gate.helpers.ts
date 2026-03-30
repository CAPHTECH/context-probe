import { appendFile } from "node:fs/promises";
import path from "node:path";

export const FIXTURE_REPO = path.resolve("fixtures/domain-design/sample-repo");
export const FIXTURE_MODEL = path.resolve("fixtures/domain-design/model.yaml");
export const FIXTURE_POLICY = path.resolve("fixtures/policies/default.yaml");
export const REGISTRY_PATH = path.resolve("fixtures/validation/shadow-rollout/registry.yaml");

export async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string,
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    await appendFile(path.join(repoPath, relativePath), content, "utf8");
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  await run("git", ["add", "-A"], { cwd: repoPath });
  await run("git", ["commit", "-m", message], { cwd: repoPath });
}
