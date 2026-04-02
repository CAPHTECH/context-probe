import type { FileDependency } from "./contracts.js";
import {
  type AiChangeReviewChangedFile,
  collectBranchDiff,
} from "./ai-change-review-diff.js";
import { parseCodebase } from "../analyzers/code.js";
import { normalizeHistory } from "./history-normalization.js";
import { isSourceFile } from "./io.js";
import { createProgressTracker } from "./progress.js";
import { createResponse, confidenceFromSignals, toEvidence, toProvenance } from "./response.js";
import { dedupeEvidence } from "./scoring-shared.js";

const TEST_FILE_PATTERN = /(?:^|\/)(?:__tests__\/|tests?\/|specs?\/)|\.(?:test|spec)\.[^.]+$/i;

function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERN.test(filePath);
}

function stripKnownExtensions(filePath: string): string {
  return filePath.replace(/\.(?:d\.)?(?:ts|tsx|js|jsx|mts|cts|mjs|cjs|dart)$/i, "");
}

function candidateTestPaths(filePath: string): string[] {
  const stem = stripKnownExtensions(filePath);
  const fileName = stem.split("/").pop() ?? stem;
  const directory = stem.includes("/") ? stem.slice(0, stem.lastIndexOf("/")) : "";
  const base = directory ? `${directory}/${fileName}` : fileName;
  const inPlace = [
    `${base}.test.ts`,
    `${base}.test.tsx`,
    `${base}.test.js`,
    `${base}.spec.ts`,
    `${base}.spec.tsx`,
    `${base}.spec.js`,
    `${base}_test.dart`,
  ];
  const siblingTests = directory
    ? [
        `${directory}/__tests__/${fileName}.test.ts`,
        `${directory}/__tests__/${fileName}.test.tsx`,
        `${directory}/__tests__/${fileName}.test.js`,
        `${directory}/__tests__/${fileName}.spec.ts`,
        `${directory}/__tests__/${fileName}.spec.tsx`,
        `${directory}/__tests__/${fileName}.spec.js`,
      ]
    : [];
  return [...inPlace, ...siblingTests];
}

function countReverseDependencies(dependencies: FileDependency[]): Map<string, number> {
  const counts = new Map<string, Set<string>>();
  for (const dependency of dependencies) {
    if (dependency.targetKind !== "file") {
      continue;
    }
    const sources = counts.get(dependency.target) ?? new Set<string>();
    sources.add(dependency.source);
    counts.set(dependency.target, sources);
  }
  return new Map(Array.from(counts.entries()).map(([path, sources]) => [path, sources.size]));
}

function buildHistoryHotspotState(commits: Array<{ files: string[] }>): {
  counts: Map<string, number>;
  watchlist: Set<string>;
} {
  const counts = new Map<string, number>();
  for (const commit of commits) {
    if (commit.files.length < 2) {
      continue;
    }
    for (const file of commit.files) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return {
    counts,
    watchlist: new Set(ranked.slice(0, Math.min(3, ranked.length)).map(([filePath]) => filePath)),
  };
}

function buildTargetSummary(path: string, reasons: string[], hasRenameOrDeleteBlastRadius = false): string {
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
  reasons: string[];
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
  reasons: string[];
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

function hasCompanionTest(input: {
  path: string;
  repoFiles: Set<string>;
  changedFiles: Set<string>;
}): boolean {
  if (isTestFile(input.path)) {
    return true;
  }
  const candidates = candidateTestPaths(input.path);
  return candidates.some((candidate) => input.changedFiles.has(candidate) || input.repoFiles.has(candidate));
}

export async function computeAiChangeReviewScores(options: {
  repoPath: string;
  baseBranch: string;
  headBranch: string;
  policyConfig: import("./contracts.js").PolicyConfig;
  profileName: string;
  progressReporter?: (update: { phase: string; message: string }) => void;
}): Promise<import("./contracts.js").CommandResponse<import("./contracts.js").AiChangeReviewScoreResult>> {
  const startedAt = Date.now();
  const progress = createProgressTracker(options.progressReporter);
  const diagnostics: string[] = [];
  const evidence: import("./contracts.js").Evidence[] = [];

  const diff = await progress.withProgress(
    "ai_change_review",
    `Collecting branch diff ${options.baseBranch}..${options.headBranch}.`,
    () =>
      collectBranchDiff({
        repoPath: options.repoPath,
        baseBranch: options.baseBranch,
        headBranch: options.headBranch,
      }),
  );

  const codebase = await progress.withProgress("ai_change_review", `Parsing codebase for ${options.repoPath}.`, () =>
    parseCodebase(options.repoPath),
  );
  const reverseDependencyCounts = countReverseDependencies(codebase.dependencies);
  const repoFiles = new Set(codebase.sourceFiles);
  const changedFiles = new Set(diff.files.map((file) => file.path));
  const historyStartedAt = Date.now();
  const history =
    diff.files.length === 0
      ? []
      : await progress.withProgress("history", `Analyzing history hotspots for ${diff.files.length} changed file(s).`, () =>
          normalizeHistory(options.repoPath, options.policyConfig, options.profileName),
        );
  const historyMs = Date.now() - historyStartedAt;
  const historyState = buildHistoryHotspotState(history);
  const reviewTargets: import("./contracts.js").AiChangeReviewTarget[] = [];
  for (const [index, file] of diff.files.entries()) {
    const reasons: import("./contracts.js").AiChangeReviewReason[] = [];
    const reverseDependencyCount = reverseDependencyCounts.get(file.path) ?? 0;
    const historyHotspotCount = historyState.counts.get(file.path) ?? 0;
    const hasUnsupportedFileType = !isSourceFile(file.path);
    const hasRenameOrDeleteBlastRadius =
      (file.changeType === "renamed" || file.changeType === "deleted") && reverseDependencyCount > 0;

    if (reverseDependencyCount >= 3) {
      reasons.push("wide_blast_radius");
    }
    if (historyHotspotCount >= 2 || historyState.watchlist.has(file.path)) {
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
        repoFiles,
        changedFiles,
      })
    ) {
      reasons.push("test_gap");
    }

    const needsManualReview = hasUnsupportedFileType || file.hunks.length === 0;
    if (reasons.length === 0 && !hasRenameOrDeleteBlastRadius && !needsManualReview) {
      continue;
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
    evidence.push(...targetEvidence);
    reviewTargets.push({
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
    });
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
  if (diff.files.length === 0) {
    confidenceSignals.push(1);
  }

  return createResponse(
    {
      domainId: "ai_change_review",
      metrics: [],
      diffSummary: {
        baseBranch: options.baseBranch,
        headBranch: options.headBranch,
        mergeBase: diff.mergeBase,
        changedFileCount: diff.files.length,
        changedHunkCount: diff.files.reduce((sum, file) => sum + file.hunks.length, 0),
        analyzedFileCount: diff.files.filter((file) => isSourceFile(file.path)).length,
      },
      reviewTargets,
    },
    {
      status: reviewTargets.length > 0 || diagnostics.length > 0 ? "warning" : "ok",
      evidence: dedupeEvidence(evidence),
      confidence: confidenceFromSignals(confidenceSignals.length > 0 ? confidenceSignals : [0.92]),
      unknowns: [],
      diagnostics,
      progress: progress.progress,
      provenance: [
        toProvenance(options.repoPath, "ai_change_review"),
        toProvenance(options.repoPath, `base=${options.baseBranch}`),
        toProvenance(options.repoPath, `head=${options.headBranch}`),
        toProvenance(options.repoPath, `merge_base=${diff.mergeBase}`),
      ],
      meta: {
        runtime: {
          totalMs: Date.now() - startedAt,
          stages: {
            historyMs,
            analysisMs: Date.now() - startedAt - historyMs,
          },
        },
      },
    },
  );
}
