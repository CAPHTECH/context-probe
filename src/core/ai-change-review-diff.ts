import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { parseAiChangeReviewDiffHunks, parseAiChangeReviewNameStatusLine } from "./ai-change-review-diff-parser.js";
import type { AiChangeReviewChangedFile } from "./ai-change-review-diff-types.js";

export type { AiChangeReviewChangedFile, AiChangeReviewHunk } from "./ai-change-review-diff-types.js";

const execFile = promisify(execFileCallback);

async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

async function getMergeBase(repoPath: string, baseBranch: string, headBranch: string): Promise<string> {
  return runGit(repoPath, ["merge-base", baseBranch, headBranch]);
}

export async function collectBranchDiff(input: { repoPath: string; baseBranch: string; headBranch: string }): Promise<{
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
    const entry = parseAiChangeReviewNameStatusLine(line);
    if (!entry) {
      continue;
    }
    filesByPath.set(entry.path, entry);
  }

  if (filesByPath.size === 0) {
    return { mergeBase, files: [] };
  }

  const diffOutput = await runGit(repoPath, ["diff", "--unified=0", "--find-renames", "--no-color", diffRange]);
  parseAiChangeReviewDiffHunks(diffOutput, filesByPath);

  return {
    mergeBase,
    files: Array.from(filesByPath.values()).sort((left, right) => left.path.localeCompare(right.path)),
  };
}
