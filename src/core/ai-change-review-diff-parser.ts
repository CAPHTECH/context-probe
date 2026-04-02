import type {
  AiChangeReviewChangedFile,
  AiChangeReviewDiffCursor,
  AiChangeReviewHunk,
} from "./ai-change-review-diff-types.js";
import type { AiChangeReviewChangeType } from "./contracts.js";
import { toPosixPath } from "./io.js";

function normalizeAiChangeReviewRepoPath(input: string): string {
  return toPosixPath(input);
}

function normalizeAiChangeReviewPatchPath(input: string): string {
  return toPosixPath(input.replace(/^[ab]\//, ""));
}

export function createAiChangeReviewDiffCursor(): AiChangeReviewDiffCursor {
  return {
    currentPath: undefined,
    pendingOldPath: undefined,
    pendingNewPath: undefined,
  };
}

export function parseAiChangeReviewNameStatusLine(line: string): AiChangeReviewChangedFile | null {
  const parts = line.split("\t");
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
      path: normalizeAiChangeReviewRepoPath(path),
      previousPath: normalizeAiChangeReviewRepoPath(previousPath),
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
  const changeType: AiChangeReviewChangeType = status === "A" ? "added" : status === "D" ? "deleted" : "modified";
  return {
    path: normalizeAiChangeReviewRepoPath(path),
    changeType,
    hunks: [],
    changedLines: 0,
    representativeLine: 1,
  };
}

export function parseAiChangeReviewHunkHeader(line: string): AiChangeReviewHunk | null {
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

function beginDiffFile(line: string, cursor: AiChangeReviewDiffCursor): void {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  cursor.pendingOldPath = match?.[1] ? normalizeAiChangeReviewRepoPath(match[1]) : undefined;
  cursor.pendingNewPath = match?.[2] ? normalizeAiChangeReviewRepoPath(match[2]) : undefined;
  cursor.currentPath = cursor.pendingNewPath ?? cursor.pendingOldPath;
}

function recordRenamePath(line: string, prefix: "rename from " | "rename to ", cursor: AiChangeReviewDiffCursor): void {
  const path = normalizeAiChangeReviewRepoPath(line.slice(prefix.length));
  if (prefix === "rename from ") {
    cursor.pendingOldPath = path;
    return;
  }
  cursor.pendingNewPath = path;
  cursor.currentPath = path;
}

function recordFilePath(line: string, prefix: "--- " | "+++ ", cursor: AiChangeReviewDiffCursor): void {
  const raw = line.slice(prefix.length);
  if (raw === "/dev/null") {
    return;
  }
  const path = normalizeAiChangeReviewPatchPath(raw);
  if (prefix === "--- ") {
    cursor.pendingOldPath = path;
    return;
  }
  cursor.pendingNewPath = path;
  cursor.currentPath = cursor.pendingNewPath ?? cursor.pendingOldPath;
}

function resolveCurrentFile(
  filesByPath: Map<string, AiChangeReviewChangedFile>,
  cursor: AiChangeReviewDiffCursor,
): AiChangeReviewChangedFile | undefined {
  const fileKey = cursor.currentPath ?? cursor.pendingNewPath ?? cursor.pendingOldPath;
  if (!fileKey) {
    return undefined;
  }
  return filesByPath.get(fileKey) ?? filesByPath.get(cursor.pendingOldPath ?? "");
}

export function applyAiChangeReviewDiffLine(
  line: string,
  filesByPath: Map<string, AiChangeReviewChangedFile>,
  cursor: AiChangeReviewDiffCursor,
): void {
  if (line.startsWith("diff --git ")) {
    beginDiffFile(line, cursor);
    return;
  }
  if (line.startsWith("rename from ")) {
    recordRenamePath(line, "rename from ", cursor);
    return;
  }
  if (line.startsWith("rename to ")) {
    recordRenamePath(line, "rename to ", cursor);
    return;
  }
  if (line.startsWith("--- ")) {
    recordFilePath(line, "--- ", cursor);
    return;
  }
  if (line.startsWith("+++ ")) {
    recordFilePath(line, "+++ ", cursor);
    return;
  }

  const hunk = parseAiChangeReviewHunkHeader(line);
  if (!hunk) {
    return;
  }
  const entry = resolveCurrentFile(filesByPath, cursor);
  if (!entry) {
    return;
  }
  entry.hunks.push(hunk);
  entry.changedLines += hunk.oldCount + hunk.newCount;
  if (entry.hunks.length === 1) {
    entry.representativeLine = hunk.representativeLine;
  }
}

export function parseAiChangeReviewDiffHunks(
  diffText: string,
  filesByPath: Map<string, AiChangeReviewChangedFile>,
): void {
  const cursor = createAiChangeReviewDiffCursor();
  for (const line of diffText.split("\n")) {
    applyAiChangeReviewDiffLine(line, filesByPath, cursor);
  }
}
