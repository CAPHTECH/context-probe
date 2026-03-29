import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import type {
  CochangeAnalysis,
  CochangeCommit,
  CochangePersistenceCandidateScore,
  CochangePairWeight,
  CochangePersistenceAnalysis,
  CochangeStabilityCluster,
  DomainModel,
  EvolutionLocalityModelComparison,
  PolicyConfig
} from "./contracts.js";
import { matchGlobs, toPosixPath } from "./io.js";

const execFile = promisify(execFileCallback);
const GIT_LOG_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

interface ContextualizedCommit extends CochangeCommit {
  contexts: string[];
}

interface HistoryObservationQuality {
  confidence: number;
  unknowns: string[];
}

function classifyContext(filePath: string, model: DomainModel): string | undefined {
  return model.contexts.find((context) => matchGlobs(filePath, context.pathGlobs))?.name;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function parseChangedPath(entry: string): string | null {
  const normalized = entry.trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split("\t").map((value) => value.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  if (parts.length === 1) {
    return toPosixPath(parts[0]!);
  }

  const status = parts[0]!;
  if (status.startsWith("R") || status.startsWith("C")) {
    return toPosixPath(parts[parts.length - 1]!);
  }

  return toPosixPath(parts[1]!);
}

export async function normalizeHistory(
  repoPath: string,
  policyConfig: PolicyConfig,
  profileName: string
): Promise<CochangeCommit[]> {
  const profile = policyConfig.profiles[profileName];
  const ignoreCommitPatterns = (profile?.history_filters?.ignore_commit_patterns ?? []).map(
    (pattern) => new RegExp(pattern)
  );
  const ignorePaths = profile?.history_filters?.ignore_paths ?? [];

  const { stdout } = await execFile(
    "git",
    ["-C", repoPath, "log", "--no-merges", "--find-renames", "--name-status", "--pretty=format:__COMMIT__%n%H%n%s"],
    {
      cwd: repoPath,
      maxBuffer: GIT_LOG_MAX_BUFFER_BYTES
    }
  );

  const commits: CochangeCommit[] = [];
  const blocks = stdout.split("__COMMIT__\n").map((block) => block.trim()).filter(Boolean);

  for (const block of blocks) {
    const [hash, subject = "", ...files] = block.split("\n");
    if (!hash) {
      continue;
    }
    if (ignoreCommitPatterns.some((pattern) => pattern.test(subject))) {
      continue;
    }
    const normalizedFiles = files
      .map((entry) => parseChangedPath(entry))
      .filter((value): value is string => Boolean(value))
      .filter((entry) => !ignorePaths.includes(entry));
    const uniqueFiles = unique(normalizedFiles);

    if (uniqueFiles.length === 0) {
      continue;
    }

    commits.push({
      hash,
      subject,
      files: uniqueFiles
    });
  }

  return commits;
}

function contextualizeCommits(commits: CochangeCommit[], model: DomainModel): ContextualizedCommit[] {
  return commits
    .map((commit) => ({
      ...commit,
      contexts: unique(
        commit.files
          .map((filePath) => classifyContext(filePath, model))
          .filter((value): value is string => Boolean(value))
      ).sort()
    }))
    .filter((entry) => entry.contexts.length > 0);
}

function buildHistoryObservationQuality(input: {
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
    input.contextsSeen.length < 2 ? 0.35 : 0.85
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
    unknowns: unique(unknowns)
  };
}

export function evaluateEvolutionLocalityObservationQuality(
  commits: CochangeCommit[],
  model: DomainModel
): HistoryObservationQuality {
  const contextualized = contextualizeCommits(commits, model);
  const contextsSeen = unique(contextualized.flatMap((commit) => commit.contexts)).sort();
  return buildHistoryObservationQuality({
    relevantCommitCount: contextualized.length,
    contextsSeen
  });
}

export function scoreEvolutionLocality(
  commits: CochangeCommit[],
  model: DomainModel
): CochangeAnalysis {
  const relevant = contextualizeCommits(commits, model);

  if (relevant.length === 0) {
    return {
      commits: [],
      crossContextCommits: 0,
      localCommits: 0,
      averageContextsPerCommit: 0,
      surpriseCouplingRatio: 0,
      crossContextChangeLocality: 0,
      featureScatter: 0,
      contextsSeen: []
    };
  }

  const crossContextCommits = relevant.filter((entry) => entry.contexts.length > 1).length;
  const localCommits = relevant.length - crossContextCommits;
  const totalContextTouches = relevant.reduce((sum, entry) => sum + entry.contexts.length, 0);
  const averageContextsPerCommit = totalContextTouches / relevant.length;
  const contextsSeen = unique(relevant.flatMap((entry) => entry.contexts)).sort();
  const maxContexts = Math.max(1, contextsSeen.length);
  const featureScatter =
    maxContexts <= 1 ? 0 : Math.min(1, (averageContextsPerCommit - 1) / (maxContexts - 1));
  const surpriseCouplingRatio = crossContextCommits / relevant.length;
  const crossContextChangeLocality = localCommits / relevant.length;

  return {
    commits,
    crossContextCommits,
    localCommits,
    averageContextsPerCommit,
    surpriseCouplingRatio,
    crossContextChangeLocality,
    featureScatter,
    contextsSeen
  };
}

function computeEvolutionLocalityScore(analysis: CochangeAnalysis): number {
  return clamp01(
    0.4 * analysis.crossContextChangeLocality +
      0.3 * (1 - analysis.featureScatter) +
      0.3 * (1 - analysis.surpriseCouplingRatio)
  );
}

function buildPairWeights(relevant: ContextualizedCommit[]): CochangePairWeight[] {
  const contextTouchCount = new Map<string, number>();
  const pairCount = new Map<string, number>();

  for (const commit of relevant) {
    for (const context of commit.contexts) {
      contextTouchCount.set(context, (contextTouchCount.get(context) ?? 0) + 1);
    }

    for (let index = 0; index < commit.contexts.length; index += 1) {
      for (let next = index + 1; next < commit.contexts.length; next += 1) {
        const left = commit.contexts[index]!;
        const right = commit.contexts[next]!;
        const key = `${left}::${right}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(pairCount.entries())
    .map(([key, rawCount]) => {
      const [left = "", right = ""] = key.split("::");
      const leftTouches = contextTouchCount.get(left) ?? 0;
      const rightTouches = contextTouchCount.get(right) ?? 0;
      const denominator = leftTouches + rightTouches - rawCount;
      return {
        left,
        right,
        rawCount,
        jaccard: denominator === 0 ? 0 : clamp01(rawCount / denominator)
      };
    })
    .sort(
      (left, right) =>
        right.jaccard - left.jaccard ||
        right.rawCount - left.rawCount ||
        left.left.localeCompare(right.left) ||
        left.right.localeCompare(right.right)
    );
}

function componentKey(contexts: string[]): string {
  return contexts.join("::");
}

function connectedComponents(
  contextsSeen: string[],
  pairWeights: CochangePairWeight[],
  threshold: number
): string[][] {
  if (contextsSeen.length === 0) {
    return [];
  }

  const parent = new Map<string, string>(contextsSeen.map((context) => [context, context]));
  const size = new Map<string, number>(contextsSeen.map((context) => [context, 1]));

  const find = (value: string): string => {
    let current = value;
    while (parent.get(current) !== current) {
      current = parent.get(current)!;
    }

    let compress = value;
    while (parent.get(compress) !== current) {
      const next = parent.get(compress)!;
      parent.set(compress, current);
      compress = next;
    }

    return current;
  };

  const union = (left: string, right: string) => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) {
      return;
    }
    const leftSize = size.get(leftRoot) ?? 1;
    const rightSize = size.get(rightRoot) ?? 1;
    if (leftSize < rightSize || (leftSize === rightSize && leftRoot.localeCompare(rightRoot) > 0)) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    parent.set(rightRoot, leftRoot);
    size.set(leftRoot, leftSize + rightSize);
  };

  for (const pair of pairWeights) {
    if (pair.jaccard < threshold) {
      continue;
    }
    union(pair.left, pair.right);
  }

  const groups = new Map<string, string[]>();
  for (const context of contextsSeen) {
    const root = find(context);
    const members = groups.get(root) ?? [];
    members.push(context);
    groups.set(root, members);
  }

  return Array.from(groups.values())
    .map((members) => members.sort())
    .filter((members) => members.length > 1)
    .sort((left, right) => right.length - left.length || componentKey(left).localeCompare(componentKey(right)));
}

function deriveStableClusters(
  contextsSeen: string[],
  pairWeights: CochangePairWeight[]
): {
  stableChangeClusters: CochangeStabilityCluster[];
  naturalSplitLevels: number[];
  noiseRatio: number;
  hasWeightRange: boolean;
} {
  if (contextsSeen.length < 2 || pairWeights.length === 0) {
    return {
      stableChangeClusters: [],
      naturalSplitLevels: [],
      noiseRatio: 0,
      hasWeightRange: true
    };
  }

  const thresholds = unique(pairWeights.map((pair) => pair.jaccard)).sort((left, right) => right - left);
  const active = new Map<string, { contexts: string[]; birth: number }>();
  const completed: CochangeStabilityCluster[] = [];

  for (const threshold of thresholds) {
    const components = connectedComponents(contextsSeen, pairWeights, threshold);
    const currentKeys = new Set(components.map((members) => componentKey(members)));

    for (const members of components) {
      const key = componentKey(members);
      if (!active.has(key)) {
        active.set(key, {
          contexts: members,
          birth: threshold
        });
      }
    }

    for (const [key, entry] of Array.from(active.entries())) {
      if (currentKeys.has(key)) {
        continue;
      }
      completed.push({
        contexts: entry.contexts,
        birth: entry.birth,
        death: threshold,
        stability: clamp01(entry.birth - threshold)
      });
      active.delete(key);
    }
  }

  for (const entry of active.values()) {
    completed.push({
      contexts: entry.contexts,
      birth: entry.birth,
      death: 0,
      stability: clamp01(entry.birth)
    });
  }

  const stableChangeClusters = completed
    .sort(
      (left, right) =>
        right.stability - left.stability ||
        right.contexts.length - left.contexts.length ||
        componentKey(left.contexts).localeCompare(componentKey(right.contexts))
    )
    .slice(0, 5);
  const naturalSplitLevels = unique(stableChangeClusters.map((cluster) => cluster.birth)).sort((left, right) => right - left);

  return {
    stableChangeClusters,
    naturalSplitLevels,
    noiseRatio: computeNoiseRatio(completed),
    hasWeightRange: thresholds.length > 1
  };
}

function computeNoiseRatio(stableChangeClusters: CochangeStabilityCluster[]): number {
  const stabilityMass = stableChangeClusters.reduce((sum, cluster) => sum + cluster.stability, 0);
  if (stabilityMass === 0) {
    return 0;
  }

  const topMass = stableChangeClusters
    .slice()
    .sort((left, right) => right.stability - left.stability)
    .slice(0, 3)
    .reduce((sum, cluster) => sum + cluster.stability, 0);
  return clamp01(1 - topMass / stabilityMass);
}

export function analyzeCochangePersistence(
  commits: CochangeCommit[],
  model: DomainModel
): { analysis: CochangePersistenceAnalysis; confidence: number; unknowns: string[] } {
  const relevant = contextualizeCommits(commits, model);
  const contextsSeen = unique(relevant.flatMap((commit) => commit.contexts)).sort();
  const pairWeights = buildPairWeights(relevant);
  const { stableChangeClusters, naturalSplitLevels, noiseRatio, hasWeightRange } = deriveStableClusters(
    contextsSeen,
    pairWeights
  );
  const quality = buildHistoryObservationQuality({
    relevantCommitCount: relevant.length,
    contextsSeen,
    pairWeightCount: pairWeights.length,
    hasWeightRange
  });

  return {
    analysis: {
      relevantCommitCount: relevant.length,
      contextsSeen,
      pairWeights,
      stableChangeClusters,
      naturalSplitLevels,
      noiseRatio
    },
    confidence: quality.confidence,
    unknowns: quality.unknowns
  };
}

function computeClusterPenalty(
  strongestCluster: CochangeStabilityCluster | null,
  contextCount: number
): number {
  if (!strongestCluster || contextCount < 2) {
    return 0;
  }
  const spanFactor = clamp01((strongestCluster.contexts.length - 1) / (contextCount - 1));
  return clamp01(strongestCluster.stability * spanFactor);
}

export function scorePersistenceLocalityCandidate(
  commits: CochangeCommit[],
  model: DomainModel
): {
  analysis: CochangePersistenceAnalysis;
  candidate: CochangePersistenceCandidateScore;
  confidence: number;
  unknowns: string[];
} {
  const result = analyzeCochangePersistence(commits, model);
  if (result.analysis.relevantCommitCount === 0 || result.analysis.contextsSeen.length === 0) {
    const fallbackElsScore = computeEvolutionLocalityScore(scoreEvolutionLocality(commits, model));
    return {
      analysis: result.analysis,
      candidate: {
        localityScore: fallbackElsScore,
        persistentCouplingPenalty: clamp01(1 - fallbackElsScore),
        strongestPair: null,
        strongestCluster: null,
        clusterPenalty: 0,
        pairPenalty: 0,
        coherencePenalty: 0
      },
      confidence: result.confidence,
      unknowns: result.unknowns
    };
  }
  const strongestPair = result.analysis.pairWeights[0] ?? null;
  const strongestCluster = result.analysis.stableChangeClusters[0] ?? null;
  const clusterPenalty = computeClusterPenalty(strongestCluster, result.analysis.contextsSeen.length);
  const pairPenalty = strongestPair?.jaccard ?? 0;
  const coherencePenalty = strongestPair ? clamp01((1 - result.analysis.noiseRatio) * pairPenalty) : 0;
  const persistentCouplingPenalty = clamp01(
    0.6 * clusterPenalty + 0.3 * pairPenalty + 0.1 * coherencePenalty
  );

  return {
    analysis: result.analysis,
    candidate: {
      localityScore: clamp01(1 - persistentCouplingPenalty),
      persistentCouplingPenalty,
      strongestPair,
      strongestCluster,
      clusterPenalty,
      pairPenalty,
      coherencePenalty
    },
    confidence: result.confidence,
    unknowns: result.unknowns
  };
}

export function compareEvolutionLocalityModels(
  commits: CochangeCommit[],
  model: DomainModel
): {
  comparison: EvolutionLocalityModelComparison;
  confidence: number;
  unknowns: string[];
} {
  const elsAnalysis = scoreEvolutionLocality(commits, model);
  const persistence = scorePersistenceLocalityCandidate(commits, model);
  const elsScore = computeEvolutionLocalityScore(elsAnalysis);

  return {
    comparison: {
      els: {
        score: elsScore,
        components: {
          CCL: elsAnalysis.crossContextChangeLocality,
          FS: elsAnalysis.featureScatter,
          SCR: elsAnalysis.surpriseCouplingRatio
        }
      },
      persistenceCandidate: persistence.candidate,
      persistenceAnalysis: persistence.analysis,
      delta: persistence.candidate.localityScore - elsScore
    },
    confidence: persistence.confidence,
    unknowns: persistence.unknowns
  };
}
