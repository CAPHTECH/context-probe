import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../analyzers/code.js";
import { computeAggregateFitness } from "./aggregate-fitness.js";
import { computeBoundaryFitness } from "./boundary-fitness.js";
import type {
  CochangeAnalysis,
  CommandResponse,
  DomainDesignScoreResult,
  DomainDesignShadowRolloutGateEvaluation,
  DomainModel,
  ExtractionBackend,
  ExtractionProviderName,
  Fragment,
  InvariantCandidate,
  PolicyConfig,
  ReviewResolutionLog,
  RuleCandidate,
  TermTraceLink,
} from "./contracts.js";
import { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";
import { evaluateFormula } from "./formula.js";
import {
  compareEvolutionLocalityModels,
  evaluateEvolutionLocalityObservationQuality,
  normalizeHistory,
  scoreEvolutionLocality,
} from "./history.js";
import { getDomainPolicy } from "./policy.js";
import { confidenceFromSignals, createResponse, toEvidence, toProvenance } from "./response.js";
import { listReviewItems } from "./review.js";
import { average, clamp01, computeLeakRatio, dedupeEvidence, toMetricScore } from "./scoring-shared.js";
import { buildModelCodeLinks, buildTermTraceLinks } from "./trace.js";

const USE_CASE_SIGNALS = [
  /ユースケース/u,
  /シナリオ/u,
  /期待(?:される)?結果/u,
  /受け入れ基準/u,
  /利用者/u,
  /\buse case\b/i,
  /\bscenario\b/i,
  /\bacceptance\b/i,
];
const CONSTRAINT_SIGNALS = [
  /なければならない/u,
  /べき/u,
  /常に/u,
  /一致/u,
  /一意/u,
  /整合/u,
  /返(?:る|される)/u,
  /欠落しない/u,
  /再現可能/u,
  /安定(?:する|している)/u,
  /辿れる/u,
  /反映(?:される|されている)/u,
  /付与(?:される|されている)/u,
  /表示(?:される|されている)/u,
];

function persistenceCandidateToMetricComponents(candidate: {
  persistentCouplingPenalty: number;
  clusterPenalty: number;
  pairPenalty: number;
  coherencePenalty: number;
}): Record<string, number> {
  return {
    persistentCouplingPenalty: candidate.persistentCouplingPenalty,
    clusterPenalty: candidate.clusterPenalty,
    pairPenalty: candidate.pairPenalty,
    coherencePenalty: candidate.coherencePenalty,
  };
}

function computeAliasEntropy(aliasesPerTerm: number, termCount: number): number {
  if (termCount === 0) {
    return 1;
  }
  return Math.min(1, aliasesPerTerm / termCount);
}

function computeUliComponents(terms: Awaited<ReturnType<typeof extractGlossary>>["terms"], links: TermTraceLink[]) {
  const totalTerms = terms.length;
  if (totalTerms === 0) {
    return {
      GC: 0,
      AE: 1,
      TC: 1,
      TL: 0,
    };
  }

  const linkByTermId = new Map(links.map((link) => [link.termId, link]));
  const glossaryCovered = terms.filter((term) => {
    const link = linkByTermId.get(term.termId);
    return term.count > 1 || (link?.coverage.codeHits ?? 0) > 0;
  }).length;
  const tracedTerms = links.filter((link) => link.coverage.documentHits > 0 && link.coverage.codeHits > 0).length;
  const collisionTerms = terms.filter((term) => term.collision).length;
  const aliasCount = terms.reduce((sum, term) => sum + term.aliases.length, 0);

  return {
    GC: glossaryCovered / totalTerms,
    AE: computeAliasEntropy(aliasCount, totalTerms),
    TC: collisionTerms / totalTerms,
    TL: tracedTerms / totalTerms,
  };
}

function buildReviewItemsForCandidates(
  key: "rules" | "invariants",
  candidates: RuleCandidate[] | InvariantCandidate[],
  responseConfidence: number,
  responseUnknowns: string[],
) {
  return listReviewItems({
    status: "ok",
    result: {
      [key]: candidates,
    },
    evidence: candidates.flatMap((candidate) => candidate.evidence),
    confidence: responseConfidence,
    unknowns: responseUnknowns,
    diagnostics: [],
    provenance: [],
    version: "1.0",
  });
}

function computeDrfComponents(
  fragments: Fragment[],
  rules: RuleCandidate[],
  invariants: InvariantCandidate[],
  reviewItemCount: number,
) {
  const proseFragments = fragments.filter(
    (fragment) => fragment.kind === "paragraph" && fragment.text.trim().length > 0,
  );
  const totalCandidates = rules.length + invariants.length;
  const allCandidates = [...rules, ...invariants];
  const coveredFragments = new Set(allCandidates.flatMap((candidate) => candidate.fragmentIds)).size;
  const signalFragments = proseFragments.filter((fragment) =>
    CONSTRAINT_SIGNALS.some((pattern) => pattern.test(fragment.text)),
  ).length;
  const useCaseFragments = proseFragments.filter((fragment) =>
    USE_CASE_SIGNALS.some((pattern) => pattern.test(fragment.text)),
  ).length;
  const ambiguousCandidates = allCandidates.filter((candidate) => candidate.unknowns.length > 0).length;
  const lowConfidenceCandidates = allCandidates.filter((candidate) => candidate.confidence < 0.75).length;
  const ambiguityRate = totalCandidates === 0 ? 1 : ambiguousCandidates / totalCandidates;
  const lowConfidenceRate = totalCandidates === 0 ? 1 : lowConfidenceCandidates / totalCandidates;
  const reviewDensity = clamp01(reviewItemCount / Math.max(1, totalCandidates * 2));
  const averageConfidence = average(
    allCandidates.map((candidate) => candidate.confidence),
    0.45,
  );

  const SC =
    proseFragments.length === 0
      ? 0
      : clamp01((0.7 * useCaseFragments) / proseFragments.length + (0.3 * coveredFragments) / proseFragments.length);
  const RC = signalFragments === 0 ? 0 : clamp01((coveredFragments / signalFragments) * (1 - 0.5 * ambiguityRate));
  const IV = clamp01(0.6 * ambiguityRate + 0.4 * lowConfidenceRate);
  const RA = clamp01((1 - reviewDensity) * 0.6 + averageConfidence * 0.4);

  return {
    SC,
    RC,
    IV,
    RA,
    proseFragments: proseFragments.length,
    useCaseFragments,
    signalFragments,
    totalCandidates,
  };
}

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
  const docsExtractionOptions = options.docsRoot
    ? ({
        root: options.docsRoot,
        cwd: repoPath,
        extractor: options.extraction?.extractor ?? "heuristic",
        ...(options.extraction?.provider ? { provider: options.extraction.provider } : {}),
        ...(options.extraction?.providerCommand ? { providerCommand: options.extraction.providerCommand } : {}),
        promptProfile: options.extraction?.promptProfile ?? "default",
        fallback: options.extraction?.fallback ?? "heuristic",
        ...(options.extraction?.reviewLog ? { reviewLog: options.extraction.reviewLog } : {}),
        applyReviewLog: options.extraction?.applyReviewLog ?? false,
      } as const)
    : null;
  let glossaryResultCache: Awaited<ReturnType<typeof extractGlossary>> | undefined;
  let rulesResultCache: Awaited<ReturnType<typeof extractRules>> | undefined;
  let invariantsResultCache: Awaited<ReturnType<typeof extractInvariants>> | undefined;
  let termTraceLinksCache: Awaited<ReturnType<typeof buildTermTraceLinks>> | undefined;
  const getGlossaryResult = async () => {
    if (!docsExtractionOptions) {
      throw new Error("docs extraction requires docsRoot");
    }
    if (!glossaryResultCache) {
      glossaryResultCache = await extractGlossary(docsExtractionOptions);
    }
    return glossaryResultCache;
  };
  const getRulesResult = async () => {
    if (!docsExtractionOptions) {
      throw new Error("docs extraction requires docsRoot");
    }
    if (!rulesResultCache) {
      rulesResultCache = await extractRules(docsExtractionOptions);
    }
    return rulesResultCache;
  };
  const getInvariantsResult = async () => {
    if (!docsExtractionOptions) {
      throw new Error("docs extraction requires docsRoot");
    }
    if (!invariantsResultCache) {
      invariantsResultCache = await extractInvariants(docsExtractionOptions);
    }
    return invariantsResultCache;
  };
  const getTermTraceLinks = async () => {
    if (!options.docsRoot) {
      throw new Error("term trace requires docsRoot");
    }
    if (!termTraceLinksCache) {
      const glossary = await getGlossaryResult();
      termTraceLinksCache = await buildTermTraceLinks({
        docsRoot: options.docsRoot,
        repoRoot: repoPath,
        terms: glossary.terms,
        codeFiles: codebase.scorableSourceFiles,
      });
    }
    return termTraceLinksCache;
  };
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

  let history: CochangeAnalysis | null = null;
  let historySignals = {
    CCL: 0,
    FS: 0,
    SCR: 0,
  };
  let historyConfidence = 0;
  let shadow: DomainDesignScoreResult["shadow"] | undefined;
  let shadowLocalityConfidence = 0;
  const requiresLocalityComparison = options.shadowPersistence || Boolean(options.pilotPersistenceCategory);

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
    history = null;
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

  const mccsComponents = {
    MRP: mrp,
    BLR: leakRatio,
    CLA: cla,
  };
  const elsComponents = historySignals;
  const scores = [];
  if (policy.metrics.DRF) {
    if (!options.docsRoot) {
      unknowns.push("Skipped DRF because `--docs-root` was not provided.");
    } else {
      const [rulesResult, invariantsResult] = await Promise.all([getRulesResult(), getInvariantsResult()]);
      const reviewItems = [
        ...buildReviewItemsForCandidates("rules", rulesResult.rules, rulesResult.confidence, rulesResult.unknowns),
        ...buildReviewItemsForCandidates(
          "invariants",
          invariantsResult.invariants,
          invariantsResult.confidence,
          invariantsResult.unknowns,
        ),
      ];
      const drfComponents = computeDrfComponents(
        rulesResult.fragments,
        rulesResult.rules,
        invariantsResult.invariants,
        reviewItems.length,
      );
      const drfUnknowns = [
        ...rulesResult.unknowns,
        ...invariantsResult.unknowns,
        "SC is an approximation based on use-case signals.",
        "IV is an approximation based on review burden.",
      ];

      if (drfComponents.totalCandidates === 0) {
        drfUnknowns.push("No rules or invariants were extracted, so DRF evidence is insufficient.");
      }
      if (drfComponents.useCaseFragments === 0) {
        drfUnknowns.push("Too little use-case-like text was found, so SC evidence is limited.");
      }

      const drfEvidence = dedupeEvidence([
        ...rulesResult.rules.flatMap((rule) => rule.evidence),
        ...invariantsResult.invariants.flatMap((invariant) => invariant.evidence),
      ]);
      additionalEvidence.push(...drfEvidence);
      diagnostics.push(...rulesResult.diagnostics, ...invariantsResult.diagnostics);

      scores.push(
        toMetricScore(
          "DRF",
          evaluateFormula(policy.metrics.DRF.formula, drfComponents),
          {
            SC: drfComponents.SC,
            RC: drfComponents.RC,
            IV: drfComponents.IV,
            RA: drfComponents.RA,
          },
          drfEvidence.map((entry) => entry.evidenceId),
          confidenceFromSignals([
            rulesResult.confidence,
            invariantsResult.confidence,
            drfComponents.useCaseFragments > 0 ? 0.8 : 0.55,
          ]),
          drfUnknowns,
        ),
      );
    }
  }
  if (policy.metrics.ULI) {
    if (!options.docsRoot) {
      unknowns.push("Skipped ULI because `--docs-root` was not provided.");
    } else {
      const [glossary, links] = await Promise.all([getGlossaryResult(), getTermTraceLinks()]);
      const uliComponents = computeUliComponents(glossary.terms, links);
      const averageTraceConfidence =
        links.length === 0 ? 0.5 : links.reduce((sum, link) => sum + link.confidence, 0) / links.length;
      const uliUnknowns = [...glossary.unknowns];

      if (glossary.terms.length === 0) {
        uliUnknowns.push("No glossary terms were extracted, so ULI evidence is insufficient.");
      }
      if (glossary.terms.every((term) => term.aliases.length === 0)) {
        uliUnknowns.push("Alias Entropy is approximated from alias counts.");
      }

      const termEvidence = glossary.terms.flatMap((term) => term.evidence);
      const traceGapEvidence = links
        .filter((link) => link.coverage.codeHits === 0)
        .map((link) =>
          toEvidence(
            `${link.canonicalTerm} is not traced to code`,
            {
              termId: link.termId,
              docsRoot: options.docsRoot,
            },
            [link.termId],
            0.8,
          ),
        );
      additionalEvidence.push(...termEvidence, ...traceGapEvidence);

      scores.push(
        toMetricScore(
          "ULI",
          evaluateFormula(policy.metrics.ULI.formula, uliComponents),
          uliComponents,
          [...termEvidence, ...traceGapEvidence].map((entry) => entry.evidenceId),
          confidenceFromSignals([glossary.confidence, averageTraceConfidence, glossary.terms.length > 0 ? 0.85 : 0.4]),
          uliUnknowns,
        ),
      );

      diagnostics.push(...glossary.diagnostics);
    }
  }
  if (policy.metrics.BFS) {
    if (!options.docsRoot) {
      unknowns.push("Skipped BFS because `--docs-root` was not provided.");
    } else {
      const [glossary, rulesResult, invariantsResult, links] = await Promise.all([
        getGlossaryResult(),
        getRulesResult(),
        getInvariantsResult(),
        getTermTraceLinks(),
      ]);
      const bfsResult = computeBoundaryFitness({
        model,
        fragments: rulesResult.fragments,
        terms: glossary.terms,
        links,
        rules: rulesResult.rules,
        invariants: invariantsResult.invariants,
        contractUsage,
        leakFindings,
        modelCodeLinks: buildModelCodeLinks(model, codebase.scorableSourceFiles),
      });

      additionalEvidence.push(...bfsResult.evidence);
      diagnostics.push(...bfsResult.diagnostics);
      scores.push(
        toMetricScore(
          "BFS",
          evaluateFormula(policy.metrics.BFS.formula, {
            A: bfsResult.A,
            R: bfsResult.R,
          }),
          {
            A: bfsResult.A,
            R: bfsResult.R,
          },
          bfsResult.evidence.map((entry) => entry.evidenceId),
          bfsResult.confidence,
          bfsResult.unknowns,
        ),
      );
    }
  }
  if (policy.metrics.AFS) {
    if (!options.docsRoot) {
      unknowns.push("Skipped AFS because `--docs-root` was not provided.");
    } else {
      const [glossary, invariantsResult, links] = await Promise.all([
        getGlossaryResult(),
        getInvariantsResult(),
        getTermTraceLinks(),
      ]);
      const afsResult = computeAggregateFitness({
        model,
        fragments: invariantsResult.fragments,
        terms: glossary.terms,
        links,
        invariants: invariantsResult.invariants,
      });

      additionalEvidence.push(...afsResult.evidence);
      diagnostics.push(...afsResult.diagnostics);
      scores.push(
        toMetricScore(
          "AFS",
          evaluateFormula(policy.metrics.AFS.formula, {
            SIC: afsResult.SIC,
            XTC: afsResult.XTC,
          }),
          {
            SIC: afsResult.SIC,
            XTC: afsResult.XTC,
          },
          afsResult.evidence.map((entry) => entry.evidenceId),
          afsResult.confidence,
          afsResult.unknowns,
        ),
      );
    }
  }
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
