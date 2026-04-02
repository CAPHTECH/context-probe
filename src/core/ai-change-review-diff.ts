import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import type { AiChangeReviewChangeType } from "./contracts.js";
import { toPosixPath } from "./io.js";

const execFile = promisify(execFileCallback);

export interface AiChangeReviewHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  representativeLine: number;
}

export interface AiChangeReviewChangedFile {
  path: string;
  previousPath?: string;
  changeType: AiChangeReviewChangeType;
  hunks: AiChangeReviewHunk[];
  changedLines: number;
  representativeLine: number;
}

function normalizePath(input: string): string {
  return toPosixPath(input.replace(/^a\//, "").replace(/^b\//, ""));
}

function parseNameStatusLine(line: string): AiChangeReviewChangedFile | null {
  const parts = line
    .split("\t")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (parts.length < 2) {
    return null;
  }

  const status = parts[0] ?? "";
  if (status.startsWith("R")) {
    const previousPath = parts[1];
    const path = parts[2];
    if (!previousPath || !path) {
      return null;
    }
    return {
      path: normalizePath(path),
      previousPath: normalizePath(previousPath),
      changeType: "renamed",
      hunks: [],
      changedLines: 0,
      representativeLine: 1,
    };
  }

  const path = parts[1];
  if (!path) {
    return null;
  }
  const changeType: AiChangeReviewChangeType =
    status === "A" ? "added" : status === "D" ? "deleted" : "modified";
  return {
    path: normalizePath(path),
    changeType,
    hunks: [],
    changedLines: 0,
    representativeLine: 1,
  };
}

function parseHunkHeader(line: string): AiChangeReviewHunk | null {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line.trim());
  if (!match) {
    return null;
  }
  const oldStart = Number.parseInt(match[1] ?? "0", 10);
  const oldCount = Number.parseInt(match[2] ?? "1", 10);
  const newStart = Number.parseInt(match[3] ?? "0", 10);
  const newCount = Number.parseInt(match[4] ?? "1", 10);
  return {
    oldStart,
    oldCount,
    newStart,
    newCount,
    representativeLine: newCount > 0 ? newStart : oldStart,
  };
}

function parseDiffHunks(diffText: string, filesByPath: Map<string, AiChangeReviewChangedFile>): void {
  let currentPath: string | undefined;
  let pendingOldPath: string | undefined;
  let pendingNewPath: string | undefined;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      pendingOldPath = match?.[1] ? normalizePath(match[1]) : undefined;
      pendingNewPath = match?.[2] ? normalizePath(match[2]) : undefined;
      currentPath = pendingNewPath ?? pendingOldPath;
      continue;
    }
    if (line.startsWith("rename from ")) {
      pendingOldPath = normalizePath(line.slice("rename from ".length));
      continue;
    }
    if (line.startsWith("rename to ")) {
      pendingNewPath = normalizePath(line.slice("rename to ".length));
      currentPath = pendingNewPath;
      continue;
    }
    if (line.startsWith("--- ")) {
      const raw = line.slice(4).trim();
      if (raw !== "/dev/null") {
        pendingOldPath = normalizePath(raw);
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      const raw = line.slice(4).trim();
      if (raw !== "/dev/null") {
        pendingNewPath = normalizePath(raw);
      }
      currentPath = pendingNewPath ?? pendingOldPath;
      continue;
    }

    const hunk = parseHunkHeader(line);
    if (!hunk) {
      continue;
    }
    const fileKey = currentPath ?? pendingNewPath ?? pendingOldPath;
    if (!fileKey) {
      continue;
    }
    const entry = filesByPath.get(fileKey) ?? filesByPath.get(pendingOldPath ?? "");
    if (!entry) {
      continue;
    }
    entry.hunks.push(hunk);
    entry.changedLines += hunk.oldCount + hunk.newCount;
    if (entry.hunks.length === 1) {
      entry.representativeLine = hunk.representativeLine;
    }
  }
}

async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

export async function getMergeBase(repoPath: string, baseBranch: string, headBranch: string): Promise<string> {
  return runGit(repoPath, ["merge-base", baseBranch, headBranch]);
}

export async function collectBranchDiff(input: {
  repoPath: string;
  baseBranch: string;
  headBranch: string;
}): Promise<{
  mergeBase: string;
  files: AiChangeReviewChangedFile[];
}> {
  const { repoPath, baseBranch, headBranch } = input;
  const mergeBase = await getMergeBase(repoPath, baseBranch, headBranch);
  const diffRange = `${mergeBase}..${headBranch}`;

  const statusOutput = await runGit(repoPath, ["diff", "--name-status", "--find-renames", diffRange]);
  const filesByPath = new Map<string, AiChangeReviewChangedFile>();
  for (const line of statusOutput.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const entry = parseNameStatusLine(line);
    if (!entry) {
      continue;
    }
    filesByPath.set(entry.path, entry);
  }

  if (filesByPath.size === 0) {
    return { mergeBase, files: [] };
  }

  const diffOutput = await runGit(repoPath, ["diff", "--unified=0", "--find-renames", "--no-color", diffRange]);
  parseDiffHunks(diffOutput, filesByPath);

  return {
    mergeBase,
    files: Array.from(filesByPath.values()).sort((left, right) => left.path.localeCompare(right.path)),
  };
}
