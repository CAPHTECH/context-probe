import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import type { CochangeCommit, PolicyConfig } from "./contracts.js";
import { GIT_LOG_MAX_BUFFER_BYTES, parseChangedPath, unique } from "./history-shared.js";

const execFile = promisify(execFileCallback);

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

  const { stdout } = await execFile(
    "git",
    ["-C", repoPath, "log", "--no-merges", "--find-renames", "--name-status", "--pretty=format:__COMMIT__%n%H%n%s"],
    {
      cwd: repoPath,
      maxBuffer: GIT_LOG_MAX_BUFFER_BYTES,
    },
  );

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
