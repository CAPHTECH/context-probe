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
  const { repoPath, model, policyConfig, profileName, requiresLocalityComparison } = options;
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
    const commits = await normalizeHistory(repoPath, policyConfig, profileName);
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
    historyConfidence = 0.2;
    diagnostics.push(
      error instanceof Error ? `Skipped history analysis: ${error.message}` : "Skipped history analysis",
    );
    unknowns.push("Git information required for history analysis is missing.");
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
