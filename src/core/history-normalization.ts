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
  onProgress?: (event: {
    phase: "start" | "heartbeat" | "complete" | "error";
    elapsedMs: number;
    observedCommitCount: number;
    emittedCommitCount: number;
    includePathGlobCount: number;
  }) => void;
  progressIntervalMs?: number;
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
  const startTime = Date.now();
  const includePathGlobCount = toGitHistoryPathspecs(options?.includePathGlobs ?? []).length;
  const progressIntervalMs = options?.progressIntervalMs ?? 5000;
  let observedCommitCount = 0;
  let lastProgressAt = startTime;

  options?.onProgress?.({
    phase: "start",
    elapsedMs: 0,
    observedCommitCount,
    emittedCommitCount: commits.length,
    includePathGlobCount,
  });

  try {
    await runGitLog(
      repoPath,
      (line) => {
        if (line === "__COMMIT__") {
          observedCommitCount += 1;
        }
        consumeGitHistoryLine(line, parseState, commits, ignoreCommitPatterns, ignorePaths);
        if (options?.onProgress && Date.now() - lastProgressAt >= progressIntervalMs) {
          lastProgressAt = Date.now();
          options.onProgress({
            phase: "heartbeat",
            elapsedMs: lastProgressAt - startTime,
            observedCommitCount,
            emittedCommitCount: commits.length,
            includePathGlobCount,
          });
        }
      },
      options,
    );
    flushParsedCommit(parseState, commits, ignoreCommitPatterns, ignorePaths);
  } catch (error) {
    options?.onProgress?.({
      phase: "error",
      elapsedMs: Date.now() - startTime,
      observedCommitCount,
      emittedCommitCount: commits.length,
      includePathGlobCount,
    });
    throw error;
  }

  options?.onProgress?.({
    phase: "complete",
    elapsedMs: Date.now() - startTime,
    observedCommitCount,
    emittedCommitCount: commits.length,
    includePathGlobCount,
  });

  return commits;
}
