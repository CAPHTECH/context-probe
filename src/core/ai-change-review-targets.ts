import type { AiChangeReviewContext } from "./ai-change-review-context.js";
import { hasCompanionTest } from "./ai-change-review-context.js";
import type { AiChangeReviewChangedFile } from "./ai-change-review-diff-types.js";
import type { AiChangeReviewReason, AiChangeReviewTarget } from "./contracts/ai-change-review.js";
import type { Evidence } from "./contracts.js";
import { isSourceFile } from "./io.js";
import { confidenceFromSignals, toEvidence } from "./response.js";

const HISTORY_HOTSPOT_MIN_COMMITS = 3;

function getSignalPaths(file: AiChangeReviewChangedFile): string[] {
  return Array.from(new Set([file.path, file.previousPath].filter((value): value is string => Boolean(value))));
}

function countSignalSources(signalPaths: string[], reverseDependencySources: Map<string, Set<string>>): number {
  const sources = new Set<string>();
  for (const signalPath of signalPaths) {
    for (const sourcePath of reverseDependencySources.get(signalPath) ?? []) {
      sources.add(sourcePath);
    }
  }
  return sources.size;
}

function countHistoryHotspots(signalPaths: string[], historyCounts: Map<string, number>): number {
  return signalPaths.reduce((total, signalPath) => total + (historyCounts.get(signalPath) ?? 0), 0);
}

function isHistoryWatchlistHit(signalPaths: string[], watchlist: Set<string>): boolean {
  return signalPaths.some((signalPath) => watchlist.has(signalPath));
}

function buildTargetSummary(
  path: string,
  reasons: AiChangeReviewReason[],
  hasRenameOrDeleteBlastRadius = false,
): string {
  const segments: string[] = [];
  if (hasRenameOrDeleteBlastRadius) {
    segments.push("renames or removes a file that still has downstream dependencies");
  }
  if (reasons.includes("wide_blast_radius")) {
    segments.push("touches a high-dependency file");
  }
  if (reasons.includes("history_hotspot")) {
    segments.push("overlaps with a history hotspot");
  }
  if (reasons.includes("test_gap")) {
    segments.push("does not have a nearby changed or co-located test");
  }
  if (reasons.includes("large_change")) {
    segments.push("contains a large diff surface");
  }
  return segments.length > 0 ? `${path} ${segments.join(" and ")}.` : `${path} should be reviewed manually.`;
}

function buildManualReviewSummary(path: string, changeType: AiChangeReviewChangedFile["changeType"]): string {
  if (changeType === "renamed" || changeType === "deleted") {
    return `${path} renames or removes a file shape that should be reviewed manually.`;
  }
  return `${path} uses an unsupported or low-confidence review path and should be checked manually.`;
}

function determinePriority(input: {
  reasons: AiChangeReviewReason[];
  changeType: AiChangeReviewChangedFile["changeType"];
  reverseDependencyCount: number;
}): "high" | "medium" {
  if (
    (input.reasons.includes("wide_blast_radius") && input.reasons.includes("history_hotspot")) ||
    ((input.changeType === "renamed" || input.changeType === "deleted") && input.reverseDependencyCount > 0)
  ) {
    return "high";
  }
  return "medium";
}

function buildTargetConfidence(input: {
  reasons: AiChangeReviewReason[];
  representativeLine: number;
  hunkCount: number;
  changeType: AiChangeReviewChangedFile["changeType"];
}): number {
  const signals = [
    input.representativeLine > 0 ? 0.92 : 0.55,
    input.hunkCount > 0 ? 0.9 : input.changeType === "renamed" ? 0.72 : 0.65,
    input.reasons.length > 0 ? 0.88 : 0.6,
  ];
  return confidenceFromSignals(signals);
}

function scoreAiChangeReviewFile(
  file: AiChangeReviewChangedFile,
  context: AiChangeReviewContext,
  index: number,
): { target: AiChangeReviewTarget; evidence: Evidence[] } | null {
  const reasons: AiChangeReviewReason[] = [];
  const signalPaths = getSignalPaths(file);
  const reverseDependencyCount = countSignalSources(signalPaths, context.reverseDependencySources);
  const historyHotspotCount = countHistoryHotspots(signalPaths, context.historyState.counts);
  const hasHistoryWatchlistHit = isHistoryWatchlistHit(signalPaths, context.historyState.watchlist);
  const hasUnsupportedFileType = !isSourceFile(file.path);
  const hasRenameOrDeleteBlastRadius =
    (file.changeType === "renamed" || file.changeType === "deleted") && reverseDependencyCount > 0;

  if (reverseDependencyCount >= 3) {
    reasons.push("wide_blast_radius");
  }
  if (historyHotspotCount >= HISTORY_HOTSPOT_MIN_COMMITS || hasHistoryWatchlistHit) {
    reasons.push("history_hotspot");
  }
  if ((file.changedLines >= 30 || file.hunks.length >= 3) && !reasons.includes("large_change")) {
    reasons.push("large_change");
  }
  if (
    !hasUnsupportedFileType &&
    file.changeType !== "deleted" &&
    !hasCompanionTest({
      path: file.path,
      repoFiles: context.repoFiles,
      changedFiles: context.changedFiles,
    })
  ) {
    reasons.push("test_gap");
  }

  const needsManualReview = hasUnsupportedFileType || file.hunks.length === 0;
  if (reasons.length === 0 && !hasRenameOrDeleteBlastRadius && !needsManualReview) {
    return null;
  }

  const targetId = `ACR-${index + 1}`;
  const summary =
    reasons.length > 0 || hasRenameOrDeleteBlastRadius
      ? buildTargetSummary(file.path, reasons, hasRenameOrDeleteBlastRadius)
      : buildManualReviewSummary(file.path, file.changeType);
  const confidence = buildTargetConfidence({
    reasons,
    representativeLine: file.representativeLine,
    hunkCount: file.hunks.length,
    changeType: file.changeType,
  });
  const targetEvidence = reasons.map((reason) =>
    toEvidence(
      `${file.path} triggered ${reason}.`,
      {
        source: "ai_change_review",
        path: file.path,
        line: file.representativeLine,
        reason,
        changeType: file.changeType,
        reverseDependencyCount,
        historyHotspotCount,
        hunkCount: file.hunks.length,
        changedLines: file.changedLines,
      },
      [targetId],
      confidence,
    ),
  );
  if (reasons.length === 0) {
    targetEvidence.push(
      toEvidence(
        `${file.path} requires manual review because the diff could not be classified confidently.`,
        {
          source: "ai_change_review",
          path: file.path,
          line: file.representativeLine,
          changeType: file.changeType,
          reverseDependencyCount,
        },
        [targetId],
        confidence,
      ),
    );
  }

  return {
    target: {
      targetId,
      path: file.path,
      line: file.representativeLine,
      priority:
        reasons.length > 0 || hasRenameOrDeleteBlastRadius
          ? determinePriority({
              reasons,
              changeType: file.changeType,
              reverseDependencyCount,
            })
          : "low",
      reasons,
      summary,
      confidence,
      evidenceRefs: targetEvidence.map((entry) => entry.evidenceId),
      changeType: file.changeType,
    },
    evidence: targetEvidence,
  };
}

export function scoreAiChangeReviewTargets(context: AiChangeReviewContext): {
  reviewTargets: AiChangeReviewTarget[];
  evidence: Evidence[];
  confidenceSignals: number[];
  diagnostics: string[];
} {
  const reviewTargets: AiChangeReviewTarget[] = [];
  const evidence: Evidence[] = [];

  for (const [index, file] of context.files.entries()) {
    const scored = scoreAiChangeReviewFile(file, context, index);
    if (!scored) {
      continue;
    }
    reviewTargets.push(scored.target);
    evidence.push(...scored.evidence);
  }

  reviewTargets.sort((left, right) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
    const byPriority = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (byPriority !== 0) {
      return byPriority;
    }
    const byConfidence = left.confidence - right.confidence;
    if (byConfidence !== 0) {
      return byConfidence;
    }
    return left.path.localeCompare(right.path);
  });

  const confidenceSignals = reviewTargets.map((target) => target.confidence);

  return {
    reviewTargets,
    evidence,
    confidenceSignals,
    diagnostics: [],
  };
}
