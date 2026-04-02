import type { AiChangeReviewChangeType } from "./contracts.js";

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

export interface AiChangeReviewDiffCursor {
  currentPath: string | undefined;
  pendingOldPath: string | undefined;
  pendingNewPath: string | undefined;
}
