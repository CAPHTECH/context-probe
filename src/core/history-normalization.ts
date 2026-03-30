import { spawn } from "node:child_process";
import { once } from "node:events";

import type { CochangeCommit, PolicyConfig } from "./contracts.js";
import { parseChangedPath, unique } from "./history-shared.js";

async function runGitLog(repoPath: string): Promise<string> {
  const child = spawn(
    "git",
    ["-C", repoPath, "log", "--no-merges", "--find-renames", "--name-status", "--pretty=format:__COMMIT__%n%H%n%s"],
    {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const closePromise = once(child, "close") as Promise<[number | null, NodeJS.Signals | null]>;
  const errorPromise = once(child, "error").then(([error]) => {
    throw error;
  });
  const [code, signal] = await Promise.race([closePromise, errorPromise]);

  if (code !== 0) {
    const details =
      stderr.trim() || `git log exited with code ${code ?? "unknown"}${signal ? ` signal ${signal}` : ""}.`;
    throw new Error(details);
  }

  return stdout;
}

export async function normalizeHistory(
  repoPath: string,
  policyConfig: PolicyConfig,
  profileName: string,
): Promise<CochangeCommit[]> {
  const profile = policyConfig.profiles[profileName];
  const ignoreCommitPatterns = (profile?.history_filters?.ignore_commit_patterns ?? []).map(
    (pattern) => new RegExp(pattern),
  );
  const ignorePaths = profile?.history_filters?.ignore_paths ?? [];

  const stdout = await runGitLog(repoPath);

  const commits: CochangeCommit[] = [];
  const blocks = stdout
    .split("__COMMIT__\n")
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const [hash, subject = "", ...files] = block.split("\n");
    if (!hash) {
      continue;
    }
    if (ignoreCommitPatterns.some((pattern) => pattern.test(subject))) {
      continue;
    }
    const normalizedFiles = files
      .map((entry) => parseChangedPath(entry))
      .filter((value): value is string => Boolean(value))
      .filter((entry) => !ignorePaths.includes(entry));
    const uniqueFiles = unique(normalizedFiles);

    if (uniqueFiles.length === 0) {
      continue;
    }

    commits.push({
      hash,
      subject,
      files: uniqueFiles,
    });
  }

  return commits;
}
