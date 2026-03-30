import type { CochangeAnalysis, CochangeCommit, DomainModel } from "./contracts.js";
import {
  buildHistoryObservationQuality,
  clamp01,
  contextualizeCommits,
  type HistoryObservationQuality,
  unique,
} from "./history-shared.js";

export function evaluateEvolutionLocalityObservationQuality(
  commits: CochangeCommit[],
  model: DomainModel,
): HistoryObservationQuality {
  const contextualized = contextualizeCommits(commits, model);
  const contextsSeen = unique(contextualized.flatMap((commit) => commit.contexts)).sort();
  return buildHistoryObservationQuality({
    relevantCommitCount: contextualized.length,
    contextsSeen,
  });
}

export function scoreEvolutionLocality(commits: CochangeCommit[], model: DomainModel): CochangeAnalysis {
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
      contextsSeen: [],
    };
  }

  const crossContextCommits = relevant.filter((entry) => entry.contexts.length > 1).length;
  const localCommits = relevant.length - crossContextCommits;
  const totalContextTouches = relevant.reduce((sum, entry) => sum + entry.contexts.length, 0);
  const averageContextsPerCommit = totalContextTouches / relevant.length;
  const contextsSeen = unique(relevant.flatMap((entry) => entry.contexts)).sort();
  const maxContexts = Math.max(1, contextsSeen.length);
  const featureScatter = maxContexts <= 1 ? 0 : Math.min(1, (averageContextsPerCommit - 1) / (maxContexts - 1));
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
    contextsSeen,
  };
}

export function computeEvolutionLocalityScore(analysis: CochangeAnalysis): number {
  return clamp01(
    0.4 * analysis.crossContextChangeLocality +
      0.3 * (1 - analysis.featureScatter) +
      0.3 * (1 - analysis.surpriseCouplingRatio),
  );
}
