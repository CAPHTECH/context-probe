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
import { createProgressTracker } from "./progress.js";
import { toMetricScore } from "./scoring-shared.js";

export async function computeDomainDesignScores(options: {
  repoPath: string;
  model: DomainModel;
  policyConfig: PolicyConfig;
  profileName: string;
  progressReporter?: (update: { phase: string; message: string }) => void;
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
  const progress = createProgressTracker(options.progressReporter);
  const policy = getDomainPolicy(policyConfig, profileName, "domain_design");
  const codebase = await progress.withProgress("domain_design", `Parsing codebase for ${repoPath}.`, () =>
    parseCodebase(repoPath),
  );
  const docsLoaders = createDomainDesignDocsLoaders({
    repoPath,
    docsRoot: options.docsRoot,
    reportProgress: progress.reportProgress,
    extraction: options.extraction,
    codebase,
  });
  const contractUsage = await progress.withProgress("domain_design", `Detecting contract usage in ${repoPath}.`, () =>
    detectContractUsage(codebase, model),
  );
  const leakFindings = await progress.withProgress("domain_design", `Detecting boundary leaks in ${repoPath}.`, () =>
    detectBoundaryLeaks(codebase, model),
  );
  const diagnostics: string[] = [];
  const unknowns: string[] = [];
  const additionalEvidence = [];

  const requiresLocalityComparison = options.shadowPersistence || Boolean(options.pilotPersistenceCategory);
  const locality = await progress.withProgress(
    "history",
    `Analyzing Git history for modeled paths in ${repoPath}.`,
    () =>
      evaluateDomainLocality({
        repoPath,
        model,
        policyConfig,
        profileName,
        requiresLocalityComparison,
        progressReporter: progress.reportProgress,
      }),
  );
  const { history, historySignals, historyConfidence, shadow, shadowLocalityConfidence } = locality;
  unknowns.push(...locality.unknowns);
  diagnostics.push(...locality.diagnostics);

  const elsComponents = historySignals;
  const scores = [];
  const docsMetrics =
    docsLoaders && options.docsRoot
      ? await progress.withProgress("docs", `Computing document-derived metrics from ${options.docsRoot}.`, () =>
          computeDomainDocsMetricScores({
            docsRoot: options.docsRoot,
            model,
            codeFiles: codebase.scorableSourceFiles,
            contractUsage,
            leakFindings,
            getGlossaryResult: async () =>
              progress.withProgress("docs", `Extracting glossary evidence from ${options.docsRoot}.`, () =>
                docsLoaders.getGlossaryResult(),
              ),
            getRulesResult: async () =>
              progress.withProgress("docs", `Extracting rule evidence from ${options.docsRoot}.`, () =>
                docsLoaders.getRulesResult(),
              ),
            getInvariantsResult: async () =>
              progress.withProgress("docs", `Extracting invariant evidence from ${options.docsRoot}.`, () =>
                docsLoaders.getInvariantsResult(),
              ),
            getTermTraceLinks: async () => docsLoaders.getTermTraceLinks(),
            reportProgress: progress.reportProgress,
            formulas: buildDomainDocsMetricFormulas(policy),
          }),
        )
      : { scores: [], evidence: [], diagnostics: [], unknowns: [] };
  scores.push(...docsMetrics.scores);
  additionalEvidence.push(...docsMetrics.evidence);
  diagnostics.push(...docsMetrics.diagnostics);
  unknowns.push(...docsMetrics.unknowns);
  const mccsPolicy = policy.metrics.MCCS;
  if (mccsPolicy) {
    const mccs = await progress.withProgress("domain_design", "Computing MCCS.", () =>
      buildMccsMetric({
        metricPolicy: mccsPolicy,
        contractUsage,
        leakFindings,
      }),
    );
    scores.push(mccs.metric);
    additionalEvidence.push(...mccs.evidence);
    unknowns.push(...mccs.unknowns);
  }
  const elsPolicy = policy.metrics.ELS;
  if (elsPolicy) {
    scores.push(
      await progress.withProgress("history", "Computing ELS.", () =>
        toMetricScore(
          "ELS",
          evaluateFormula(elsPolicy.formula, elsComponents),
          elsComponents,
          [],
          historyConfidence,
          history ? [] : ["History analysis did not complete, so ELS confidence is low."],
        ),
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

    const pilotResolution = await progress.withProgress("domain_design", "Resolving persistence pilot.", () =>
      resolveDomainPersistencePilot({
        metric: elsMetric,
        shadow,
        shadowLocalityConfidence,
        ...(options.pilotPersistenceCategory ? { pilotPersistenceCategory: options.pilotPersistenceCategory } : {}),
        ...(options.pilotGateEvaluation ? { pilotGateEvaluation: options.pilotGateEvaluation } : {}),
      }),
    );
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
    progress: progress.progress,
    unknowns,
    evidence: additionalEvidence,
    ...(options.docsRoot ? { docsRoot: options.docsRoot } : {}),
  });
}
