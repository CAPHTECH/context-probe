import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { COMMANDS } from "../src/commands.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const execFile = promisify(execFileCallback);

export async function cleanupValidationTempRoots(tempRoots: string[]): Promise<void> {
  await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
}

export async function materializeGitFixture(
  entry: string,
  tempRoots: string[],
  initialCommitMessage: string,
): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([entry]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, entry);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

export async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string,
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    const targetPath = path.join(repoPath, relativePath);
    const current = await readFile(targetPath, "utf8");
    await writeFile(targetPath, `${current}${content}`, "utf8");
  }

  await execFile("git", ["add", "."], { cwd: repoPath });
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", "commit", "-m", message],
    { cwd: repoPath },
  );
}

export async function renameAndCommit(
  repoPath: string,
  fromPath: string,
  toPath: string,
  message: string,
): Promise<void> {
  await execFile("git", ["mv", fromPath, toPath], { cwd: repoPath });
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", "commit", "-m", message],
    { cwd: repoPath },
  );
}

export async function commitOnBranchAndMerge(
  repoPath: string,
  branchName: string,
  updates: Record<string, string>,
  commitMessage: string,
  mergeMessage: string,
): Promise<void> {
  const { stdout } = await execFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoPath });
  const baseBranch = stdout.trim();

  await execFile("git", ["checkout", "-b", branchName], { cwd: repoPath });
  await appendAndCommit(repoPath, updates, commitMessage);
  await execFile("git", ["checkout", baseBranch], { cwd: repoPath });
  await execFile(
    "git",
    [
      "-c",
      "user.email=tester@example.com",
      "-c",
      "user.name=Context Probe Tester",
      "merge",
      "--no-ff",
      branchName,
      "-m",
      mergeMessage,
    ],
    { cwd: repoPath },
  );
}

export async function writeJsonFixture<T>(tempRoots: string[], fileName: string, payload: T): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([]);
  tempRoots.push(tempRoot);
  const targetPath = path.join(tempRoot, fileName);
  await writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
  return targetPath;
}

export function shellQuote(value: string): string {
  return JSON.stringify(value);
}

export function getMetric(
  response: Awaited<ReturnType<NonNullable<(typeof COMMANDS)["score.compute"]>>>,
  metricId: string,
) {
  const result = response.result as {
    metrics: Array<{
      metricId: string;
      value: number;
      components: Record<string, number>;
      confidence: number;
      unknowns: string[];
    }>;
  };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}
