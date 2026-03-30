import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../analyzers/code.js";
import type {
  CommandResponse,
  DomainDesignScoreResult,
  DomainDesignShadowRolloutGateEvaluation,
  DomainModel,
  ExtractionBackend,
  ExtractionProviderName,
  PolicyConfig,
  ReviewResolutionLog,
} from "./contracts.js";
import { createDomainDesignDocsLoaders } from "./domain-design-scoring-context.js";
import { buildDomainDocsMetricFormulas } from "./domain-design-scoring-core-docs.js";
import { computeDomainDocsMetricScores } from "./domain-design-scoring-docs.js";
import { evaluateDomainLocality } from "./domain-design-scoring-locality.js";
import { buildMccsMetric } from "./domain-design-scoring-mccs.js";
import { resolveDomainPersistencePilot } from "./domain-design-scoring-pilot.js";
import { buildDomainDesignScoreResponse } from "./domain-design-scoring-response.js";
import { evaluateFormula } from "./formula.js";
import { getDomainPolicy } from "./policy.js";
import { toMetricScore } from "./scoring-shared.js";

export async function computeDomainDesignScores(options: {
  repoPath: string;
  model: DomainModel;
  policyConfig: PolicyConfig;
  profileName: string;
  shadowPersistence?: boolean;
  pilotPersistenceCategory?: string;
  pilotGateEvaluation?: DomainDesignShadowRolloutGateEvaluation;
  docsRoot?: string;
  extraction?: {
    extractor: ExtractionBackend;
    provider?: ExtractionProviderName;
    providerCommand?: string;
    promptProfile?: string;
    fallback?: "heuristic" | "none";
    reviewLog?: ReviewResolutionLog;
    applyReviewLog?: boolean;
  };
}): Promise<CommandResponse<DomainDesignScoreResult>> {
  const { repoPath, model, policyConfig, profileName } = options;
  const policy = getDomainPolicy(policyConfig, profileName, "domain_design");
  const codebase = await parseCodebase(repoPath);
  const docsLoaders = createDomainDesignDocsLoaders({
    repoPath,
    docsRoot: options.docsRoot,
    extraction: options.extraction,
    codebase,
  });
  const contractUsage = detectContractUsage(codebase, model);
  const leakFindings = detectBoundaryLeaks(codebase, model);
  const diagnostics: string[] = [];
  const unknowns: string[] = [];
  const additionalEvidence = [];

  const requiresLocalityComparison = options.shadowPersistence || Boolean(options.pilotPersistenceCategory);
  const locality = await evaluateDomainLocality({
    repoPath,
    model,
    policyConfig,
    profileName,
    requiresLocalityComparison,
  });
  const { history, historySignals, historyConfidence, shadow, shadowLocalityConfidence } = locality;
  unknowns.push(...locality.unknowns);
  diagnostics.push(...locality.diagnostics);

  const elsComponents = historySignals;
  const scores = [];
  const docsMetrics =
    docsLoaders && options.docsRoot
      ? await computeDomainDocsMetricScores({
          docsRoot: options.docsRoot,
          model,
          codeFiles: codebase.scorableSourceFiles,
          contractUsage,
          leakFindings,
          getGlossaryResult: docsLoaders.getGlossaryResult,
          getRulesResult: docsLoaders.getRulesResult,
          getInvariantsResult: docsLoaders.getInvariantsResult,
          getTermTraceLinks: docsLoaders.getTermTraceLinks,
          formulas: buildDomainDocsMetricFormulas(policy),
        })
      : { scores: [], evidence: [], diagnostics: [], unknowns: [] };
  scores.push(...docsMetrics.scores);
  additionalEvidence.push(...docsMetrics.evidence);
  diagnostics.push(...docsMetrics.diagnostics);
  unknowns.push(...docsMetrics.unknowns);
  if (policy.metrics.MCCS) {
    const mccs = buildMccsMetric({
      metricPolicy: policy.metrics.MCCS,
      contractUsage,
      leakFindings,
    });
    scores.push(mccs.metric);
    additionalEvidence.push(...mccs.evidence);
    unknowns.push(...mccs.unknowns);
  }
  if (policy.metrics.ELS) {
    scores.push(
      toMetricScore(
        "ELS",
        evaluateFormula(policy.metrics.ELS.formula, elsComponents),
        elsComponents,
        [],
        historyConfidence,
        history ? [] : ["History analysis did not complete, so ELS confidence is low."],
      ),
    );
  }

  let pilot: DomainDesignScoreResult["pilot"] | undefined;
  if (options.pilotPersistenceCategory) {
    if (!options.pilotGateEvaluation) {
      throw new Error("pilotPersistenceCategory requires pilotGateEvaluation");
    }
    const elsMetric = scores.find((metric) => metric.metricId === "ELS");
    if (!elsMetric) {
      throw new Error("ELS metric is required for persistence pilot mode");
    }

    const pilotResolution = resolveDomainPersistencePilot({
      metric: elsMetric,
      shadow,
      shadowLocalityConfidence,
      pilotPersistenceCategory: options.pilotPersistenceCategory,
      pilotGateEvaluation: options.pilotGateEvaluation,
    });
    diagnostics.push(...pilotResolution.diagnostics);
    pilot = pilotResolution.pilot;
  }

  return buildDomainDesignScoreResponse({
    repoPath,
    scores,
    leakFindings,
    history,
    contractUsage,
    shadow,
    pilot,
    diagnostics,
    unknowns,
    evidence: additionalEvidence,
    ...(options.docsRoot ? { docsRoot: options.docsRoot } : {}),
  });
}
