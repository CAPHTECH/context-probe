import type { CochangeCommit, DomainModel } from "./contracts.js";
import { matchGlobs, toPosixPath } from "./io.js";

export const GIT_LOG_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export interface ContextualizedCommit extends CochangeCommit {
  contexts: string[];
}

export interface HistoryObservationQuality {
  confidence: number;
  unknowns: string[];
}

function classifyContext(filePath: string, model: DomainModel): string | undefined {
  return model.contexts.find((context) => matchGlobs(filePath, context.pathGlobs))?.name;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function parseChangedPath(entry: string): string | null {
  const normalized = entry.trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized
    .split("\t")
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  if (parts.length === 1) {
    const onlyPath = parts[0];
    return onlyPath ? toPosixPath(onlyPath) : null;
  }

  const status = parts[0];
  if (!status) {
    return null;
  }
  if (status.startsWith("R") || status.startsWith("C")) {
    const renamedPath = parts.at(-1);
    return renamedPath ? toPosixPath(renamedPath) : null;
  }

  const nextPath = parts[1];
  return nextPath ? toPosixPath(nextPath) : null;
}

export function contextualizeCommits(commits: CochangeCommit[], model: DomainModel): ContextualizedCommit[] {
  return commits
    .map((commit) => ({
      ...commit,
      contexts: unique(
        commit.files
          .map((filePath) => classifyContext(filePath, model))
          .filter((value): value is string => Boolean(value)),
      ).sort(),
    }))
    .filter((entry) => entry.contexts.length > 0);
}

export function buildHistoryObservationQuality(input: {
  relevantCommitCount: number;
  contextsSeen: string[];
  pairWeightCount?: number;
  hasWeightRange?: boolean;
}): HistoryObservationQuality {
  const unknowns: string[] = [];

  if (input.relevantCommitCount === 0) {
    unknowns.push("No Git commits suitable for evaluation were found.");
  } else if (input.relevantCommitCount < 3) {
    unknowns.push("Git history is still thin, so ELS is provisional.");
  }
  if (input.contextsSeen.length < 2) {
    unknowns.push("Fewer than two contexts were observed in history, so locality evidence is limited.");
  }
  if (input.pairWeightCount !== undefined && input.pairWeightCount === 0) {
    unknowns.push("No cross-context co-change pairs were observed, so topology signals are limited.");
  }
  if (input.pairWeightCount !== undefined && input.pairWeightCount > 0 && input.hasWeightRange === false) {
    unknowns.push("All normalized co-change weights are identical, so natural split levels are limited.");
  }

  const confidenceSignals = [
    input.relevantCommitCount === 0 ? 0.25 : input.relevantCommitCount < 3 ? 0.6 : 0.85,
    input.contextsSeen.length < 2 ? 0.35 : 0.85,
  ];
  if (input.pairWeightCount !== undefined) {
    if (input.relevantCommitCount > 0) {
      confidenceSignals.push(input.pairWeightCount === 0 ? 0.55 : 0.8);
    }
    if (input.pairWeightCount > 0) {
      confidenceSignals.push(input.hasWeightRange === false ? 0.55 : 0.78);
    }
  }

  return {
    confidence: clamp01(average(confidenceSignals, 0.45)),
    unknowns: unique(unknowns),
  };
}
