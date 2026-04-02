import path from "node:path";

import { parseCodebase } from "../analyzers/code.js";
import { type AiChangeReviewChangedFile, collectBranchDiff } from "./ai-change-review-diff.js";
import type { FileDependency, PolicyConfig } from "./contracts.js";
import { normalizeHistory } from "./history-normalization.js";
import type { ProgressTracker } from "./progress.js";

const TEST_FILE_PATTERN = /(?:^|\/)(?:__tests__\/|tests?\/|specs?\/)|\.(?:test|spec)\.[^.]+$/i;
const HISTORY_HOTSPOT_MIN_COMMITS = 3;
const TEST_COMPANION_EXTENSIONS = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"] as const;
const TEST_COMPANION_SUFFIXES = ["test", "spec"] as const;

export interface AiChangeReviewHistoryState {
  counts: Map<string, number>;
  watchlist: Set<string>;
}

export interface AiChangeReviewContext {
  repoPath: string;
  baseBranch: string;
  headBranch: string;
  mergeBase: string;
  files: AiChangeReviewChangedFile[];
  reverseDependencySources: Map<string, Set<string>>;
  reverseDependencyCounts: Map<string, number>;
  repoFiles: Set<string>;
  changedFiles: Set<string>;
  historyState: AiChangeReviewHistoryState;
  historyMs: number;
}

function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERN.test(filePath);
}

function stripKnownExtensions(filePath: string): string {
  return filePath.replace(new RegExp(`\\.(?:d\\.)?(?:${TEST_COMPANION_EXTENSIONS.join("|")}|dart)$`, "i"), "");
}

function candidateTestPaths(filePath: string): string[] {
  const stem = stripKnownExtensions(filePath);
  const fileName = stem.split("/").pop() ?? stem;
  const directory = stem.includes("/") ? stem.slice(0, stem.lastIndexOf("/")) : "";
  const base = directory ? `${directory}/${fileName}` : fileName;
  const inPlace = TEST_COMPANION_SUFFIXES.flatMap((suffix) =>
    TEST_COMPANION_EXTENSIONS.map((extension) => `${base}.${suffix}.${extension}`),
  );
  inPlace.push(`${base}_test.dart`);
  const siblingTests = directory
    ? TEST_COMPANION_SUFFIXES.flatMap((suffix) =>
        TEST_COMPANION_EXTENSIONS.map((extension) => `${directory}/__tests__/${fileName}.${suffix}.${extension}`),
      )
    : [];
  return [...inPlace, ...siblingTests];
}

function buildSignalPathAliases(signalPaths: string[]): Map<string, Set<string>> {
  const aliases = new Map<string, Set<string>>();
  for (const signalPath of signalPaths) {
    const normalizedSignalPath = signalPath.replace(/\\/g, "/");
    const strippedSignalPath = stripKnownExtensions(normalizedSignalPath);
    const candidates = new Set([normalizedSignalPath, strippedSignalPath]);
    if (strippedSignalPath.endsWith("/index")) {
      candidates.add(strippedSignalPath.slice(0, -"/index".length));
    }
    for (const candidate of candidates) {
      const mapped = aliases.get(candidate) ?? new Set<string>();
      mapped.add(normalizedSignalPath);
      aliases.set(candidate, mapped);
    }
  }
  return aliases;
}

function resolveMissingDependencySignalPaths(
  dependency: FileDependency,
  signalPathAliases: Map<string, Set<string>>,
): string[] {
  if (!dependency.specifier.startsWith(".")) {
    return [];
  }
  const sourceDirectory = dependency.source.includes("/") ? path.posix.dirname(dependency.source) : ".";
  const normalizedSpecifier = path.posix.normalize(path.posix.join(sourceDirectory, dependency.specifier));
  const strippedSpecifier = stripKnownExtensions(normalizedSpecifier);
  const candidateSpecifiers = new Set([normalizedSpecifier, strippedSpecifier]);
  if (strippedSpecifier.endsWith("/index")) {
    candidateSpecifiers.add(strippedSpecifier.slice(0, -"/index".length));
  }
  const signalPaths = new Set<string>();
  for (const candidateSpecifier of candidateSpecifiers) {
    for (const signalPath of signalPathAliases.get(candidateSpecifier) ?? []) {
      signalPaths.add(signalPath);
    }
  }
  return Array.from(signalPaths);
}

function collectReverseDependencySources(
  dependencies: FileDependency[],
  signalPaths: string[],
): Map<string, Set<string>> {
  const counts = new Map<string, Set<string>>();
  const signalPathAliases = buildSignalPathAliases(signalPaths);
  for (const dependency of dependencies) {
    if (dependency.targetKind === "external") {
      continue;
    }
    const dependencyTargets =
      dependency.targetKind === "file"
        ? [dependency.target]
        : resolveMissingDependencySignalPaths(dependency, signalPathAliases);
    for (const dependencyTarget of dependencyTargets) {
      const sources = counts.get(dependencyTarget) ?? new Set<string>();
      sources.add(dependency.source);
      counts.set(dependencyTarget, sources);
    }
  }
  return counts;
}

function buildHistoryHotspotState(commits: Array<{ files: string[] }>): AiChangeReviewHistoryState {
  const counts = new Map<string, number>();
  for (const commit of commits) {
    if (commit.files.length === 0) {
      continue;
    }
    for (const file of commit.files) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return {
    counts,
    watchlist: new Set(
      ranked
        .filter(([, count]) => count >= HISTORY_HOTSPOT_MIN_COMMITS)
        .slice(0, Math.min(3, ranked.length))
        .map(([filePath]) => filePath),
    ),
  };
}

export function hasCompanionTest(input: { path: string; repoFiles: Set<string>; changedFiles: Set<string> }): boolean {
  if (isTestFile(input.path)) {
    return true;
  }
  const candidates = candidateTestPaths(input.path);
  return candidates.some((candidate) => input.changedFiles.has(candidate) || input.repoFiles.has(candidate));
}

export async function collectAiChangeReviewContext(options: {
  repoPath: string;
  baseBranch: string;
  headBranch: string;
  policyConfig: PolicyConfig;
  profileName: string;
  progress: ProgressTracker;
}): Promise<AiChangeReviewContext> {
  const diff = await options.progress.withProgress(
    "ai_change_review",
    `Collecting branch diff ${options.baseBranch}..${options.headBranch}.`,
    () =>
      collectBranchDiff({
        repoPath: options.repoPath,
        baseBranch: options.baseBranch,
        headBranch: options.headBranch,
      }),
  );

  const changedFiles = new Set(diff.files.map((file) => file.path));
  const signalPaths = Array.from(
    new Set(
      diff.files.flatMap((file) => [file.path, file.previousPath].filter((value): value is string => Boolean(value))),
    ),
  );
  const historyPathGlobs = signalPaths;
  let historyMs = 0;
  const [codebase, history] = await Promise.all([
    options.progress.withProgress("ai_change_review", `Parsing codebase for ${options.repoPath}.`, () =>
      parseCodebase(options.repoPath),
    ),
    diff.files.length === 0
      ? Promise.resolve([])
      : options.progress.withProgress(
          "history",
          `Analyzing history hotspots for ${diff.files.length} changed file(s).`,
          async () => {
            const historyStartedAt = Date.now();
            const result = await normalizeHistory(options.repoPath, options.policyConfig, options.profileName, {
              includePathGlobs: historyPathGlobs,
            });
            historyMs = Date.now() - historyStartedAt;
            return result;
          },
        ),
  ]);
  const reverseDependencySources = collectReverseDependencySources(codebase.dependencies, signalPaths);
  const reverseDependencyCounts = new Map(
    Array.from(reverseDependencySources.entries()).map(([filePath, sources]) => [filePath, sources.size]),
  );
  const repoFiles = new Set(codebase.sourceFiles);

  return {
    repoPath: options.repoPath,
    baseBranch: options.baseBranch,
    headBranch: options.headBranch,
    mergeBase: diff.mergeBase,
    files: diff.files,
    reverseDependencySources,
    reverseDependencyCounts,
    repoFiles,
    changedFiles,
    historyState: buildHistoryHotspotState(history),
    historyMs,
  };
}
