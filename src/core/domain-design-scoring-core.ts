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
import { computeDomainDocsMetricScores } from "./domain-design-scoring-docs.js";
import { evaluateDomainLocality } from "./domain-design-scoring-locality.js";
import { persistenceCandidateToMetricComponents } from "./domain-design-scoring-support.js";
import { evaluateFormula } from "./formula.js";
import { getDomainPolicy } from "./policy.js";
import { confidenceFromSignals, createResponse, toEvidence, toProvenance } from "./response.js";
import { computeLeakRatio, dedupeEvidence, toMetricScore } from "./scoring-shared.js";

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
  const leakRatio = computeLeakRatio(leakFindings, contractUsage.applicableReferences);
  const mrp = 1 - leakRatio;
  const cla = contractUsage.adherence;
  const evidence = leakFindings.map((finding) =>
    toEvidence(
      `${finding.sourceContext} -> ${finding.targetContext} internal leak`,
      {
        path: finding.path,
        violationType: finding.violationType,
      },
      [finding.findingId],
      0.95,
    ),
  );
  const diagnostics: string[] = [];
  const unknowns: string[] = [];
  const additionalEvidence = [];
  const mccsConfidence = contractUsage.applicableReferences > 0 ? 0.9 : 0.55;

  if (contractUsage.applicableReferences === 0) {
    unknowns.push("No applicable cross-context references were found, so MCCS evidence is limited.");
  }

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

  const mccsComponents = {
    MRP: mrp,
    BLR: leakRatio,
    CLA: cla,
  };
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
          formulas: {
            ...(policy.metrics.DRF ? { DRF: policy.metrics.DRF.formula } : {}),
            ...(policy.metrics.ULI ? { ULI: policy.metrics.ULI.formula } : {}),
            ...(policy.metrics.BFS ? { BFS: policy.metrics.BFS.formula } : {}),
            ...(policy.metrics.AFS ? { AFS: policy.metrics.AFS.formula } : {}),
          },
        })
      : { scores: [], evidence: [], diagnostics: [], unknowns: [] };
  scores.push(...docsMetrics.scores);
  additionalEvidence.push(...docsMetrics.evidence);
  diagnostics.push(...docsMetrics.diagnostics);
  unknowns.push(...docsMetrics.unknowns);
  if (policy.metrics.MCCS) {
    scores.push(
      toMetricScore(
        "MCCS",
        evaluateFormula(policy.metrics.MCCS.formula, mccsComponents),
        mccsComponents,
        evidence.map((entry) => entry.evidenceId),
        confidenceFromSignals([0.9, mccsConfidence, 0.9]),
        contractUsage.applicableReferences > 0
          ? []
          : ["No cross-context references were observed, so MCCS should be interpreted carefully."],
      ),
    );
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

    const categoryGate = options.pilotGateEvaluation.categories.find(
      (entry) => entry.category === options.pilotPersistenceCategory,
    );
    if (!categoryGate) {
      throw new Error(`No shadow rollout category gate is registered for \`${options.pilotPersistenceCategory}\``);
    }

    const baselineElsValue = elsMetric.value;
    const persistenceCandidateValue = shadow?.localityModels.persistenceCandidate.localityScore ?? baselineElsValue;
    const comparisonAvailable =
      (shadow?.localityModels.persistenceAnalysis.relevantCommitCount ?? 0) > 0 &&
      (shadow?.localityModels.persistenceAnalysis.contextsSeen.length ?? 0) > 0;
    const applied = comparisonAvailable && categoryGate.gate.rolloutDisposition === "replace";
    const pilotFallbackMessage =
      "Persistence pilot fell back to baseline ELS because locality comparison data is unavailable.";

    if (!comparisonAvailable) {
      if (!diagnostics.includes(pilotFallbackMessage)) {
        diagnostics.push(pilotFallbackMessage);
      }
      elsMetric.unknowns = Array.from(new Set([...elsMetric.unknowns, pilotFallbackMessage]));
    }

    if (applied && shadow) {
      elsMetric.value = persistenceCandidateValue;
      elsMetric.components = persistenceCandidateToMetricComponents(shadow.localityModels.persistenceCandidate);
      elsMetric.confidence = shadowLocalityConfidence > 0 ? shadowLocalityConfidence : elsMetric.confidence;
      elsMetric.evidenceRefs = [];
      elsMetric.unknowns = Array.from(
        new Set([
          ...elsMetric.unknowns,
          `ELS fully reflects persistence_candidate pilot output for category \`${options.pilotPersistenceCategory}\` and exposes persistence-derived locality metadata.`,
        ]),
      );
    }

    pilot = {
      category: options.pilotPersistenceCategory,
      applied,
      localitySource: applied ? "persistence_candidate" : "els",
      baselineElsValue,
      persistenceCandidateValue,
      effectiveElsValue: elsMetric.value,
      overallGate: {
        reasons: options.pilotGateEvaluation.reasons,
        replacementVerdict: options.pilotGateEvaluation.replacementVerdict,
        rolloutDisposition: options.pilotGateEvaluation.rolloutDisposition,
      },
      categoryGate: {
        reasons: categoryGate.gate.reasons,
        replacementVerdict: categoryGate.gate.replacementVerdict,
        rolloutDisposition: categoryGate.gate.rolloutDisposition,
      },
    };
  }

  return createResponse(
    {
      domainId: "domain_design",
      metrics: scores,
      leakFindings,
      history,
      crossContextReferences: contractUsage.applicableReferences,
      ...(shadow ? { shadow } : {}),
      ...(pilot ? { pilot } : {}),
    },
    {
      status: diagnostics.length > 0 ? "warning" : "ok",
      evidence: dedupeEvidence([...evidence, ...additionalEvidence]),
      confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
      unknowns: Array.from(new Set(unknowns)),
      diagnostics,
      provenance: [
        toProvenance(repoPath, "domain_design"),
        ...(options.docsRoot ? [toProvenance(options.docsRoot, "domain_design_docs")] : []),
      ],
    },
  );
}
