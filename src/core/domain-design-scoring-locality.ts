import type { CochangeAnalysis, DomainDesignScoreResult, DomainModel, PolicyConfig } from "./contracts.js";
import {
  compareEvolutionLocalityModels,
  evaluateEvolutionLocalityObservationQuality,
  normalizeHistory,
  scoreEvolutionLocality,
} from "./history.js";

interface EvaluateDomainLocalityOptions {
  repoPath: string;
  model: DomainModel;
  policyConfig: PolicyConfig;
  profileName: string;
  requiresLocalityComparison: boolean;
  progressReporter?: (update: { phase: string; message: string }) => void;
}

export interface DomainLocalityEvaluation {
  history: CochangeAnalysis | null;
  historySignals: {
    CCL: number;
    FS: number;
    SCR: number;
  };
  historyConfidence: number;
  shadow?: DomainDesignScoreResult["shadow"];
  shadowLocalityConfidence: number;
  unknowns: string[];
  diagnostics: string[];
}

export async function evaluateDomainLocality(
  options: EvaluateDomainLocalityOptions,
): Promise<DomainLocalityEvaluation> {
  const { repoPath, model, policyConfig, profileName, requiresLocalityComparison, progressReporter } = options;
  const unknowns: string[] = [];
  const diagnostics: string[] = [];
  let history: CochangeAnalysis | null = null;
  let historySignals = {
    CCL: 0,
    FS: 0,
    SCR: 0,
  };
  let historyConfidence = 0;
  let shadow: DomainDesignScoreResult["shadow"] | undefined;
  let shadowLocalityConfidence = 0;

  try {
    const modeledPathCount = new Set(model.contexts.flatMap((entry) => entry.pathGlobs)).size;
    progressReporter?.({
      phase: "history",
      message: `Starting history analysis across ${modeledPathCount} modeled path glob(s).`,
    });
    const commits = await normalizeHistory(repoPath, policyConfig, profileName, {
      includePathGlobs: model.contexts.flatMap((entry) => entry.pathGlobs),
      onProgress: (event) => {
        if (event.phase === "heartbeat") {
          progressReporter?.({
            phase: "history",
            message: `History analysis is still running: ${event.observedCommitCount} commit marker(s) scanned in ${Math.round(
              event.elapsedMs / 1000,
            )}s.`,
          });
          return;
        }
        if (event.phase === "complete") {
          progressReporter?.({
            phase: "history",
            message: `History analysis completed in ${Math.round(event.elapsedMs / 1000)}s with ${event.emittedCommitCount} relevant commit(s).`,
          });
        }
      },
    });
    history = scoreEvolutionLocality(commits, model);
    const historyQuality = evaluateEvolutionLocalityObservationQuality(commits, model);
    historySignals = {
      CCL: history.crossContextChangeLocality,
      FS: history.featureScatter,
      SCR: history.surpriseCouplingRatio,
    };
    historyConfidence = historyQuality.confidence;
    unknowns.push(...historyQuality.unknowns);
    if (requiresLocalityComparison) {
      const localityModels = compareEvolutionLocalityModels(commits, model);
      shadowLocalityConfidence = localityModels.confidence;
      shadow = {
        localityModels: localityModels.comparison,
      };
      unknowns.push(...localityModels.unknowns);
    }
  } catch (error) {
    const modeledPathCount = new Set(model.contexts.flatMap((entry) => entry.pathGlobs)).size;
    historyConfidence = 0.2;
    diagnostics.push(
      error instanceof Error
        ? `Skipped history analysis after scanning ${modeledPathCount} modeled path glob(s): ${error.message}`
        : `Skipped history analysis after scanning ${modeledPathCount} modeled path glob(s).`,
    );
    unknowns.push("Git information required for history analysis is missing.");
    progressReporter?.({
      phase: "history",
      message: error instanceof Error ? `History analysis failed: ${error.message}` : "History analysis failed.",
    });
    if (requiresLocalityComparison) {
      const fallbackLocalityModels = compareEvolutionLocalityModels([], model);
      shadowLocalityConfidence = fallbackLocalityModels.confidence;
      shadow = {
        localityModels: fallbackLocalityModels.comparison,
      };
      unknowns.push(...fallbackLocalityModels.unknowns);
      unknowns.push("Locality comparison fell back to the baseline ELS because Git history is unavailable.");
    }
  }

  return {
    history,
    historySignals,
    historyConfidence,
    ...(shadow ? { shadow } : {}),
    shadowLocalityConfidence,
    unknowns,
    diagnostics,
  };
}
