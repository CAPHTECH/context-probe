import { spawn } from "node:child_process";
import { once } from "node:events";

import type { CochangeCommit, PolicyConfig } from "./contracts.js";
import {
  consumeGitHistoryLine,
  createGitHistoryParseState,
  flushParsedCommit,
  type GitHistoryParseState,
  toGitHistoryPathspecs,
} from "./history-shared.js";

export interface NormalizeHistoryOptions {
  includePathGlobs?: string[];
}

async function runGitLog(
  repoPath: string,
  onLine: (line: string) => void,
  options?: NormalizeHistoryOptions,
): Promise<void> {
  const args = [
    "-C",
    repoPath,
    "log",
    "--no-merges",
    "--find-renames",
    "--name-status",
    "--pretty=format:__COMMIT__%n%H%n%s",
  ];
  const pathspecs = toGitHistoryPathspecs(options?.includePathGlobs ?? []);
  if (pathspecs.length > 0) {
    args.push("--", ...pathspecs);
  }
  const child = spawn("git", args, {
    cwd: repoPath,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  let stdoutBuffer = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      onLine(line);
    }
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
  if (stdoutBuffer.length > 0) {
    onLine(stdoutBuffer);
  }
}

export async function normalizeHistory(
  repoPath: string,
  policyConfig: PolicyConfig,
  profileName: string,
  options?: NormalizeHistoryOptions,
): Promise<CochangeCommit[]> {
  const profile = policyConfig.profiles[profileName];
  const ignoreCommitPatterns = (profile?.history_filters?.ignore_commit_patterns ?? []).map(
    (pattern) => new RegExp(pattern),
  );
  const ignorePaths = profile?.history_filters?.ignore_paths ?? [];

  const commits: CochangeCommit[] = [];
  const parseState: GitHistoryParseState = createGitHistoryParseState();
  await runGitLog(
    repoPath,
    (line) => {
      consumeGitHistoryLine(line, parseState, commits, ignoreCommitPatterns, ignorePaths);
    },
    options,
  );
  flushParsedCommit(parseState, commits, ignoreCommitPatterns, ignorePaths);

  return commits;
}
