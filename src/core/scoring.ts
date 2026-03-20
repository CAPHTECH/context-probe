import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureConstraints,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTopologyModel,
  BoundaryLeakFinding,
  CochangeAnalysis,
  CochangeCommit,
  CommandResponse,
  DomainModel,
  ExtractionBackend,
  ExtractionProviderName,
  Fragment,
  InvariantCandidate,
  MetricScore,
  PolicyConfig,
  ProvenanceRef,
  ReviewResolutionLog,
  RuleCandidate,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
  TermTraceLink
} from "./contracts.js";
import { computeAggregateFitness } from "./aggregate-fitness.js";
import { computeBoundaryFitness } from "./boundary-fitness.js";
import { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";
import { evaluateFormula } from "./formula.js";
import { normalizeHistory, scoreEvolutionLocality } from "./history.js";
import { getDomainPolicy } from "./policy.js";
import { confidenceFromSignals, createResponse, toEvidence, toProvenance } from "./response.js";
import { listReviewItems } from "./review.js";
import { buildModelCodeLinks, buildTermTraceLinks } from "./trace.js";
import { detectDirectionViolations, scoreDependencyDirection } from "../analyzers/architecture.js";
import { scoreInterfaceProtocolStability } from "../analyzers/architecture-contracts.js";
import { scoreOperationalAdequacy } from "../analyzers/architecture-operations.js";
import { ingestComplexityExportBundle } from "../analyzers/architecture-cti-ingest.js";
import { normalizeDeliveryObservations } from "../analyzers/architecture-delivery-normalization.js";
import { scoreQualityScenarioFit } from "../analyzers/architecture-scenarios.js";
import {
  ingestDeliveryExportBundle,
  ingestTelemetryExportBundle
} from "../analyzers/architecture-observation-ingest.js";
import type { ResolvedCanonicalSource } from "../analyzers/architecture-source-loader.js";
import { normalizePatternRuntimeObservations } from "../analyzers/architecture-pattern-runtime-normalization.js";
import { normalizeTelemetryObservations } from "../analyzers/architecture-telemetry-normalization.js";
import { scoreTopologyIsolation } from "../analyzers/architecture-topology.js";
import {
  scoreArchitectureEvolutionEfficiency,
  scoreArchitectureEvolutionLocality
} from "../analyzers/architecture-evolution.js";
import { scoreComplexityTax } from "../analyzers/cti.js";
import { scoreBoundaryPurity } from "../analyzers/architecture-purity.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../analyzers/code.js";

const USE_CASE_SIGNALS = [
  /ユースケース/u,
  /シナリオ/u,
  /期待(?:される)?結果/u,
  /受け入れ基準/u,
  /利用者/u,
  /\buse case\b/i,
  /\bscenario\b/i,
  /\bacceptance\b/i
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
  /表示(?:される|されている)/u
];

function computeLeakRatio(leaks: BoundaryLeakFinding[], applicableReferences: number): number {
  if (applicableReferences === 0) {
    return 0;
  }
  return leaks.length / applicableReferences;
}

function toMetricScore(
  metricId: string,
  value: number,
  components: Record<string, number>,
  evidenceRefs: string[],
  confidence: number,
  unknowns: string[]
): MetricScore {
  return {
    metricId,
    value,
    components,
    confidence,
    evidenceRefs,
    unknowns
  };
}

function computeAliasEntropy(aliasesPerTerm: number, termCount: number): number {
  if (termCount === 0) {
    return 1;
  }
  return Math.min(1, aliasesPerTerm / termCount);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(
  entries: Array<{ value: number | undefined; weight: number }>,
  fallback: number
): number {
  const observed = entries.filter((entry) => entry.value !== undefined && Number.isFinite(entry.value));
  if (observed.length === 0) {
    return fallback;
  }
  const totalWeight = observed.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return fallback;
  }
  return observed.reduce((sum, entry) => sum + (entry.value ?? 0) * entry.weight, 0) / totalWeight;
}

function dedupeEvidence<T extends { evidenceId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.evidenceId)) {
      return false;
    }
    seen.add(item.evidenceId);
    return true;
  });
}

function computeUliComponents(terms: Awaited<ReturnType<typeof extractGlossary>>["terms"], links: TermTraceLink[]) {
  const totalTerms = terms.length;
  if (totalTerms === 0) {
    return {
      GC: 0,
      AE: 1,
      TC: 1,
      TL: 0
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
    TL: tracedTerms / totalTerms
  };
}

function buildReviewItemsForCandidates(
  key: "rules" | "invariants",
  candidates: RuleCandidate[] | InvariantCandidate[],
  responseConfidence: number,
  responseUnknowns: string[]
) {
  return listReviewItems({
    status: "ok",
    result: {
      [key]: candidates
    },
    evidence: candidates.flatMap((candidate) => candidate.evidence),
    confidence: responseConfidence,
    unknowns: responseUnknowns,
    diagnostics: [],
    provenance: [],
    version: "1.0"
  });
}

function computeDrfComponents(
  fragments: Fragment[],
  rules: RuleCandidate[],
  invariants: InvariantCandidate[],
  reviewItemCount: number
) {
  const proseFragments = fragments.filter((fragment) => fragment.kind === "paragraph" && fragment.text.trim().length > 0);
  const totalCandidates = rules.length + invariants.length;
  const allCandidates = [...rules, ...invariants];
  const coveredFragments = new Set(allCandidates.flatMap((candidate) => candidate.fragmentIds)).size;
  const signalFragments = proseFragments.filter((fragment) =>
    CONSTRAINT_SIGNALS.some((pattern) => pattern.test(fragment.text))
  ).length;
  const useCaseFragments = proseFragments.filter((fragment) =>
    USE_CASE_SIGNALS.some((pattern) => pattern.test(fragment.text))
  ).length;
  const ambiguousCandidates = allCandidates.filter((candidate) => candidate.unknowns.length > 0).length;
  const lowConfidenceCandidates = allCandidates.filter((candidate) => candidate.confidence < 0.75).length;
  const ambiguityRate = totalCandidates === 0 ? 1 : ambiguousCandidates / totalCandidates;
  const lowConfidenceRate = totalCandidates === 0 ? 1 : lowConfidenceCandidates / totalCandidates;
  const reviewDensity = clamp01(reviewItemCount / Math.max(1, totalCandidates * 2));
  const averageConfidence = average(allCandidates.map((candidate) => candidate.confidence), 0.45);

  const SC =
    proseFragments.length === 0
      ? 0
      : clamp01((0.7 * useCaseFragments) / proseFragments.length + (0.3 * coveredFragments) / proseFragments.length);
  const RC =
    signalFragments === 0
      ? 0
      : clamp01((coveredFragments / signalFragments) * (1 - 0.5 * ambiguityRate));
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
    totalCandidates
  };
}

export async function computeDomainDesignScores(options: {
  repoPath: string;
  model: DomainModel;
  policyConfig: PolicyConfig;
  profileName: string;
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
}): Promise<
  CommandResponse<{
    domainId: "domain_design";
    metrics: MetricScore[];
    leakFindings: BoundaryLeakFinding[];
    history: CochangeAnalysis | null;
    crossContextReferences: number;
  }>
> {
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
        applyReviewLog: options.extraction?.applyReviewLog ?? false
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
        codeFiles: codebase.scorableSourceFiles
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
        violationType: finding.violationType
      },
      [finding.findingId],
      0.95
    )
  );
  const diagnostics: string[] = [];
  const unknowns: string[] = [];
  const additionalEvidence = [];
  const mccsConfidence = contractUsage.applicableReferences > 0 ? 0.9 : 0.55;

  if (contractUsage.applicableReferences === 0) {
    unknowns.push("定義したコンテキスト間の参照が見つからず MCCS の判定根拠が限定的です");
  }

  let history: CochangeAnalysis | null = null;
  let historySignals = {
    CCL: 0,
    FS: 0,
    SCR: 0
  };
  let historyConfidence = 0;

  try {
    const commits = await normalizeHistory(repoPath, policyConfig, profileName);
    history = scoreEvolutionLocality(commits, model);
    historySignals = {
      CCL: history.crossContextChangeLocality,
      FS: history.featureScatter,
      SCR: history.surpriseCouplingRatio
    };
    if (history.commits.length === 0) {
      historyConfidence = 0.5;
    } else if (history.commits.length < 3) {
      historyConfidence = 0.6;
    } else {
      historyConfidence = 0.9;
    }
    if (history.commits.length === 0) {
      unknowns.push("Git履歴から評価可能なコミットが見つかりませんでした");
    } else if (history.commits.length < 3) {
      unknowns.push("Git履歴がまだ少ないため ELS は暫定値です");
    }
  } catch (error) {
    history = null;
    historyConfidence = 0.2;
    diagnostics.push(
      error instanceof Error ? `履歴解析をスキップしました: ${error.message}` : "履歴解析をスキップしました"
    );
    unknowns.push("履歴解析に必要なGit情報が不足しています");
  }

  const mccsComponents = {
    MRP: mrp,
    BLR: leakRatio,
    CLA: cla
  };
  const elsComponents = historySignals;
  const scores: MetricScore[] = [];
  if (policy.metrics.DRF) {
    if (!options.docsRoot) {
      unknowns.push("`--docs-root` が指定されていないため DRF をスキップしました");
    } else {
      const [rulesResult, invariantsResult] = await Promise.all([getRulesResult(), getInvariantsResult()]);
      const reviewItems = [
        ...buildReviewItemsForCandidates("rules", rulesResult.rules, rulesResult.confidence, rulesResult.unknowns),
        ...buildReviewItemsForCandidates(
          "invariants",
          invariantsResult.invariants,
          invariantsResult.confidence,
          invariantsResult.unknowns
        )
      ];
      const drfComponents = computeDrfComponents(
        rulesResult.fragments,
        rulesResult.rules,
        invariantsResult.invariants,
        reviewItems.length
      );
      const drfUnknowns = [
        ...rulesResult.unknowns,
        ...invariantsResult.unknowns,
        "SC は use case signal ベースの近似です",
        "IV は review burden ベースの近似です"
      ];

      if (drfComponents.totalCandidates === 0) {
        drfUnknowns.push("rule/invariant が抽出されず DRF の判定根拠が不足しています");
      }
      if (drfComponents.useCaseFragments === 0) {
        drfUnknowns.push("ユースケース相当の記述が少なく SC の判定根拠が限定的です");
      }

      const drfEvidence = dedupeEvidence([
        ...rulesResult.rules.flatMap((rule) => rule.evidence),
        ...invariantsResult.invariants.flatMap((invariant) => invariant.evidence)
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
            RA: drfComponents.RA
          },
          drfEvidence.map((entry) => entry.evidenceId),
          confidenceFromSignals([
            rulesResult.confidence,
            invariantsResult.confidence,
            drfComponents.useCaseFragments > 0 ? 0.8 : 0.55
          ]),
          drfUnknowns
        )
      );
    }
  }
  if (policy.metrics.ULI) {
    if (!options.docsRoot) {
      unknowns.push("`--docs-root` が指定されていないため ULI をスキップしました");
    } else {
      const [glossary, links] = await Promise.all([getGlossaryResult(), getTermTraceLinks()]);
      const uliComponents = computeUliComponents(glossary.terms, links);
      const averageTraceConfidence =
        links.length === 0 ? 0.5 : links.reduce((sum, link) => sum + link.confidence, 0) / links.length;
      const uliUnknowns = [...glossary.unknowns];

      if (glossary.terms.length === 0) {
        uliUnknowns.push("glossary term が抽出されず ULI の判定根拠が不足しています");
      }
      if (glossary.terms.every((term) => term.aliases.length === 0)) {
        uliUnknowns.push("Alias Entropy は alias 数ベースの近似です");
      }

      const termEvidence = glossary.terms.flatMap((term) => term.evidence);
      const traceGapEvidence = links
        .filter((link) => link.coverage.codeHits === 0)
        .map((link) =>
          toEvidence(
            `${link.canonicalTerm} is not traced to code`,
            {
              termId: link.termId,
              docsRoot: options.docsRoot
            },
            [link.termId],
            0.8
          )
        );
      additionalEvidence.push(...termEvidence, ...traceGapEvidence);

      scores.push(
        toMetricScore(
          "ULI",
          evaluateFormula(policy.metrics.ULI.formula, uliComponents),
          uliComponents,
          [...termEvidence, ...traceGapEvidence].map((entry) => entry.evidenceId),
          confidenceFromSignals([glossary.confidence, averageTraceConfidence, glossary.terms.length > 0 ? 0.85 : 0.4]),
          uliUnknowns
        )
      );

      diagnostics.push(...glossary.diagnostics);
    }
  }
  if (policy.metrics.BFS) {
    if (!options.docsRoot) {
      unknowns.push("`--docs-root` が指定されていないため BFS をスキップしました");
    } else {
      const [glossary, rulesResult, invariantsResult, links] = await Promise.all([
        getGlossaryResult(),
        getRulesResult(),
        getInvariantsResult(),
        getTermTraceLinks()
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
        modelCodeLinks: buildModelCodeLinks(model, codebase.scorableSourceFiles)
      });

      additionalEvidence.push(...bfsResult.evidence);
      diagnostics.push(...bfsResult.diagnostics);
      scores.push(
        toMetricScore(
          "BFS",
          evaluateFormula(policy.metrics.BFS.formula, {
            A: bfsResult.A,
            R: bfsResult.R
          }),
          {
            A: bfsResult.A,
            R: bfsResult.R
          },
          bfsResult.evidence.map((entry) => entry.evidenceId),
          bfsResult.confidence,
          bfsResult.unknowns
        )
      );
    }
  }
  if (policy.metrics.AFS) {
    if (!options.docsRoot) {
      unknowns.push("`--docs-root` が指定されていないため AFS をスキップしました");
    } else {
      const [glossary, invariantsResult, links] = await Promise.all([
        getGlossaryResult(),
        getInvariantsResult(),
        getTermTraceLinks()
      ]);
      const afsResult = computeAggregateFitness({
        model,
        fragments: invariantsResult.fragments,
        terms: glossary.terms,
        links,
        invariants: invariantsResult.invariants
      });

      additionalEvidence.push(...afsResult.evidence);
      diagnostics.push(...afsResult.diagnostics);
      scores.push(
        toMetricScore(
          "AFS",
          evaluateFormula(policy.metrics.AFS.formula, {
            SIC: afsResult.SIC,
            XTC: afsResult.XTC
          }),
          {
            SIC: afsResult.SIC,
            XTC: afsResult.XTC
          },
          afsResult.evidence.map((entry) => entry.evidenceId),
          afsResult.confidence,
          afsResult.unknowns
        )
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
          : ["コンテキスト間参照が観測されていないため MCCS の解釈に注意が必要です"]
      )
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
        history ? [] : ["履歴解析が完了していないため ELS の信頼度が低い状態です"]
      )
    );
  }

  return createResponse(
    {
      domainId: "domain_design",
      metrics: scores,
      leakFindings,
      history,
      crossContextReferences: contractUsage.applicableReferences
    },
    {
      status: diagnostics.length > 0 ? "warning" : "ok",
      evidence: dedupeEvidence([...evidence, ...additionalEvidence]),
      confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
      unknowns,
      diagnostics,
      provenance: [toProvenance(repoPath, "domain_design"), ...(options.docsRoot ? [toProvenance(options.docsRoot, "domain_design_docs")] : [])]
    }
  );
}

export async function computeArchitectureScores(options: {
  repoPath: string;
  constraints: ArchitectureConstraints;
  policyConfig: PolicyConfig;
  profileName: string;
  scenarioCatalog?: ArchitectureScenarioCatalog;
  scenarioObservations?: ScenarioObservationSet;
  scenarioObservationSource?: ResolvedCanonicalSource<ScenarioObservationSet>;
  scenarioObservationSourceRequested?: boolean;
  topologyModel?: ArchitectureTopologyModel;
  boundaryMap?: ArchitectureBoundaryMap;
  runtimeObservations?: TopologyRuntimeObservationSet;
  deliveryObservations?: ArchitectureDeliveryObservationSet;
  deliveryRawObservations?: ArchitectureDeliveryRawObservationSet;
  deliveryExport?: ArchitectureDeliveryExportBundle;
  deliverySource?: ResolvedCanonicalSource<ArchitectureDeliveryExportBundle>;
  deliverySourceRequested?: boolean;
  deliveryNormalizationProfile?: ArchitectureDeliveryNormalizationProfile;
  telemetryObservations?: ArchitectureTelemetryObservationSet;
  telemetryRawObservations?: ArchitectureTelemetryRawObservationSet;
  telemetryExport?: ArchitectureTelemetryExportBundle;
  telemetrySource?: ResolvedCanonicalSource<ArchitectureTelemetryExportBundle>;
  telemetrySourceRequested?: boolean;
  telemetryNormalizationProfile?: ArchitectureTelemetryNormalizationProfile;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet;
  patternRuntimeRawObservations?: ArchitecturePatternRuntimeRawObservationSet;
  patternRuntimeRawRequested?: boolean;
  patternRuntimeNormalizationProfile?: ArchitecturePatternRuntimeNormalizationProfile;
  patternRuntimeNormalizationProfileRequested?: boolean;
  complexityExport?: ArchitectureComplexityExportBundle;
  complexitySource?: ResolvedCanonicalSource<ArchitectureComplexityExportBundle>;
  complexitySourceRequested?: boolean;
  additionalProvenance?: ProvenanceRef[];
}): Promise<
  CommandResponse<{
    domainId: "architecture_design";
    metrics: MetricScore[];
    violations: ReturnType<typeof detectDirectionViolations>;
  }>
> {
  const { repoPath, constraints, policyConfig, profileName } = options;
  const policy = getDomainPolicy(policyConfig, profileName, "architecture_design");
  const codebase = await parseCodebase(repoPath);
  const directionScore = scoreDependencyDirection(codebase, constraints);
  const purityScore = scoreBoundaryPurity(codebase, constraints);
  const protocolScore = await scoreInterfaceProtocolStability({
    root: repoPath,
    codebase,
    constraints
  });
  const scenarioObservationsInput = options.scenarioObservations ?? options.scenarioObservationSource?.data;
  const scenarioScore = scoreQualityScenarioFit({
    ...(options.scenarioCatalog ? { catalog: options.scenarioCatalog } : {}),
    ...(scenarioObservationsInput ? { observations: scenarioObservationsInput } : {})
  });
  const topologyScore = scoreTopologyIsolation({
    ...(options.topologyModel ? { topology: options.topologyModel } : {}),
    ...(options.runtimeObservations ? { observations: options.runtimeObservations } : {})
  });
  const topologyValue = policy.metrics.TIS
    ? evaluateFormula(policy.metrics.TIS.formula, {
        FI: topologyScore.FI,
        RC: topologyScore.RC,
        SDR: topologyScore.SDR
      })
    : 0.40 * topologyScore.FI + 0.30 * topologyScore.RC + 0.30 * (1 - topologyScore.SDR);
  const telemetryExportBundle = options.telemetryExport ?? options.telemetrySource?.data;
  const telemetryExportIngestResult = telemetryExportBundle
    ? ingestTelemetryExportBundle(telemetryExportBundle)
    : undefined;
  const usableTelemetryRaw = Boolean(options.telemetryRawObservations && options.telemetryNormalizationProfile);
  const usablePatternRuntimeRaw = Boolean(
    options.patternRuntimeRawObservations && options.patternRuntimeNormalizationProfile
  );
  const patternRuntimeNormalizationResult =
    options.patternRuntimeObservations
      ? undefined
      : options.patternRuntimeRawObservations || options.patternRuntimeNormalizationProfile
        ? normalizePatternRuntimeObservations({
            ...(options.patternRuntimeRawObservations ? { raw: options.patternRuntimeRawObservations } : {}),
            ...(options.patternRuntimeNormalizationProfile
              ? { profile: options.patternRuntimeNormalizationProfile }
              : {})
          })
        : undefined;
  const telemetryRawInput = options.telemetryObservations
    ? undefined
    : usableTelemetryRaw
      ? options.telemetryRawObservations
      : telemetryExportBundle
        ? telemetryExportIngestResult?.telemetryRawObservations
        : options.telemetryRawObservations;
  const patternRuntimeInput = options.patternRuntimeObservations
    ?? (usablePatternRuntimeRaw ? patternRuntimeNormalizationResult?.patternRuntimeObservations : undefined)
    ?? telemetryExportIngestResult?.patternRuntimeObservations;
  const telemetryNormalizationResult =
    options.telemetryObservations
      ? undefined
      : telemetryRawInput || options.telemetryNormalizationProfile
        ? normalizeTelemetryObservations({
            ...(telemetryRawInput ? { raw: telemetryRawInput } : {}),
            ...(options.telemetryNormalizationProfile
              ? { profile: options.telemetryNormalizationProfile }
              : {})
          })
        : undefined;
  const operationsScore = scoreOperationalAdequacy({
    ...(options.telemetryObservations
      ? { telemetry: options.telemetryObservations }
      : telemetryNormalizationResult
        ? { telemetry: telemetryNormalizationResult.telemetry }
        : {}),
    ...(patternRuntimeInput ? { patternRuntime: patternRuntimeInput } : {}),
    topologyIsolationBridge: topologyValue
  });
  const deliveryExportBundle = options.deliveryExport ?? options.deliverySource?.data;
  const deliveryExportIngestResult = deliveryExportBundle
    ? ingestDeliveryExportBundle(deliveryExportBundle)
    : undefined;
  const usableDeliveryRaw = Boolean(options.deliveryRawObservations && options.deliveryNormalizationProfile);
  const deliveryRawInput = options.deliveryObservations
    ? undefined
    : usableDeliveryRaw
      ? options.deliveryRawObservations
      : deliveryExportBundle
        ? deliveryExportIngestResult?.deliveryRawObservations
        : options.deliveryRawObservations;
  const deliveryNormalizationResult =
    options.deliveryObservations
      ? undefined
      : deliveryRawInput || options.deliveryNormalizationProfile
        ? normalizeDeliveryObservations({
            ...(deliveryRawInput ? { raw: deliveryRawInput } : {}),
            ...(options.deliveryNormalizationProfile
              ? { profile: options.deliveryNormalizationProfile }
              : {})
          })
        : undefined;
  const complexityExportBundle = options.complexityExport ?? options.complexitySource?.data;
  const complexityExportIngestResult = complexityExportBundle
    ? ingestComplexityExportBundle({
        bundle: complexityExportBundle,
        ...(options.constraints.complexity ? { existing: options.constraints.complexity } : {})
      })
    : undefined;
  const complexityScore = scoreComplexityTax({
    codebase,
    constraints: complexityExportIngestResult
      ? {
          ...constraints,
          complexity: complexityExportIngestResult.complexity
        }
      : constraints
  });
  let architectureCommits: CochangeCommit[] = [];
  let architectureHistoryDiagnostics: string[] = [];
  try {
    architectureCommits = await normalizeHistory(repoPath, policyConfig, profileName);
  } catch (error) {
    architectureHistoryDiagnostics = [
      error instanceof Error ? `architecture 履歴解析をスキップしました: ${error.message}` : "architecture 履歴解析をスキップしました"
    ];
  }
  const evolutionLocalityScore = scoreArchitectureEvolutionLocality({
    commits: architectureCommits,
    constraints,
    ...(options.boundaryMap ? { boundaryMap: options.boundaryMap } : {})
  });
  const localityValue = policy.metrics.AELS
    ? evaluateFormula(policy.metrics.AELS.formula, {
        CrossBoundaryCoChange: evolutionLocalityScore.CrossBoundaryCoChange,
        WeightedPropagationCost: evolutionLocalityScore.WeightedPropagationCost,
        WeightedClusteringCost: evolutionLocalityScore.WeightedClusteringCost
      })
    : 0.40 * (1 - evolutionLocalityScore.CrossBoundaryCoChange) +
        0.30 * (1 - evolutionLocalityScore.WeightedPropagationCost) +
        0.30 * (1 - evolutionLocalityScore.WeightedClusteringCost);
  const evolutionEfficiencyScore = scoreArchitectureEvolutionEfficiency({
    ...(options.deliveryObservations
      ? { deliveryObservations: options.deliveryObservations }
      : deliveryNormalizationResult
        ? { deliveryObservations: deliveryNormalizationResult.deliveryObservations }
        : {}),
    locality: localityValue,
    localityConfidence: evolutionLocalityScore.confidence,
    localityUnknowns: evolutionLocalityScore.unknowns
  });
  const violations = detectDirectionViolations(codebase, constraints);
  const evidence = violations.map((violation) =>
    toEvidence(
      `${violation.sourceLayer} -> ${violation.targetLayer} direction violation`,
      {
        source: violation.source,
        target: violation.target
      },
      undefined,
      0.95
    )
  );
  const purityEvidence = purityScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        path: finding.path,
        ...(finding.source ? { source: finding.source } : {}),
        ...(finding.target ? { target: finding.target } : {}),
        ...(finding.sourceLayer ? { sourceLayer: finding.sourceLayer } : {}),
        ...(finding.targetLayer ? { targetLayer: finding.targetLayer } : {})
      },
      undefined,
      finding.confidence
    )
  );
  const protocolEvidence = protocolScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        path: finding.path,
        ...(finding.symbol ? { symbol: finding.symbol } : {})
      },
      undefined,
      finding.confidence
    )
  );
  const scenarioEvidence = scenarioScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        scenarioId: finding.scenarioId,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
        source: finding.source
      },
      undefined,
      finding.confidence
    )
  );
  const scenarioSourceEvidence = (options.scenarioObservationSource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "scenario_observation_source"
      },
      undefined,
      finding.confidence
    )
  );
  const topologyEvidence = topologyScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.nodeId ? { nodeId: finding.nodeId } : {}),
        ...(finding.source ? { source: finding.source } : {}),
        ...(finding.target ? { target: finding.target } : {})
      },
      undefined,
      finding.confidence
    )
  );
  const operationsEvidence = operationsScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.bandId ? { bandId: finding.bandId } : {}),
        ...(finding.component ? { component: finding.component } : {}),
        ...(finding.patternFamily ? { patternFamily: finding.patternFamily } : {}),
        ...(finding.signal ? { signal: finding.signal } : {}),
        ...(finding.source ? { source: finding.source } : {})
      },
      undefined,
      finding.confidence
    )
  );
  const telemetrySourceEvidence = (options.telemetrySource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "telemetry_source"
      },
      undefined,
      finding.confidence
    )
  );
  const telemetryNormalizationEvidence = (telemetryNormalizationResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        bandId: finding.bandId,
        component: finding.component,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {})
      },
      undefined,
      finding.confidence
    )
  );
  const patternRuntimeNormalizationEvidence = (patternRuntimeNormalizationResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        block: finding.block,
        rawSignal: finding.rawSignal,
        scoreSignal: finding.scoreSignal,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
        source: "pattern_runtime_raw_normalized"
      },
      undefined,
      finding.confidence
    )
  );
  const telemetryExportEvidence = (telemetryExportIngestResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.bandId ? { bandId: finding.bandId } : {}),
        ...(finding.component ? { component: finding.component } : {}),
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.sourceSystem ? { sourceSystem: finding.sourceSystem } : {}),
        ...(finding.window ? { window: finding.window } : {}),
        source: "telemetry_export"
      },
      undefined,
      finding.confidence
    )
  );
  const deliverySourceEvidence = (options.deliverySource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "delivery_source"
      },
      undefined,
      finding.confidence
    )
  );
  const deliveryNormalizationEvidence = (deliveryNormalizationResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        component: finding.component,
        scoreComponent: finding.scoreComponent,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
        source: "raw_normalized"
      },
      undefined,
      finding.confidence
    )
  );
  const complexitySourceEvidence = (options.complexitySource?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: "complexity_source"
      },
      undefined,
      finding.confidence
    )
  );
  const deliveryExportEvidence = (deliveryExportIngestResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.component ? { component: finding.component } : {}),
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.sourceSystem ? { sourceSystem: finding.sourceSystem } : {}),
        source: "delivery_export"
      },
      undefined,
      finding.confidence
    )
  );
  const complexityExportEvidence = (complexityExportIngestResult?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        component: finding.component,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.sourceSystem ? { sourceSystem: finding.sourceSystem } : {}),
        source: "complexity_export"
      },
      undefined,
      finding.confidence
    )
  );
  const complexityEvidence = complexityScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        component: finding.component,
        observed: finding.observed,
        normalized: finding.normalized,
        source: finding.source
      },
      undefined,
      finding.confidence
    )
  );
  const evolutionEvidence = evolutionLocalityScore.findings.concat(evolutionEfficiencyScore.findings).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.commitHash ? { commitHash: finding.commitHash } : {}),
        ...(finding.component ? { component: finding.component } : {})
      },
      undefined,
      finding.confidence
    )
  );
  const deliveryInputEvidence = options.deliveryObservations
    ? [
        toEvidence(
          "delivery observations の normalized score をそのまま利用しています",
          {
            source: "normalized_input"
          },
          undefined,
            0.84
          )
        ]
    : options.deliveryRawObservations
      ? [
          toEvidence(
            "raw delivery observations を normalization profile で score 化して利用しています",
            {
              source: "raw_normalized"
            },
            undefined,
            0.82
          )
        ]
      : options.deliveryExport
      ? [
          toEvidence(
            "delivery export を EES の delivery input として取り込みました",
            {
              source: "delivery_export"
            },
            undefined,
            0.8
          )
        ]
      : options.deliverySource
        ? [
            toEvidence(
              `delivery source (${options.deliverySource.sourceType}) から canonical export を取り込みました`,
              {
                source: "delivery_source",
                sourceType: options.deliverySource.sourceType,
                ...(options.deliverySource.resolvedPath ? { sourcePath: options.deliverySource.resolvedPath } : {}),
                ...(options.deliverySource.command ? { command: options.deliverySource.command } : {})
              },
              undefined,
              0.78
            )
          ]
        : deliveryNormalizationResult
        ? [
            toEvidence(
              "raw delivery observations を normalization profile で score 化して利用しています",
              {
                source: "raw_normalized"
              },
              undefined,
              0.82
            )
          ]
        : [];
  const telemetryInputEvidence = options.telemetryObservations
    ? [
        toEvidence(
          "telemetry observations の normalized score をそのまま利用しています",
          {
            source: "normalized_input"
          },
          undefined,
            0.84
          )
        ]
      : options.telemetryRawObservations
        ? [
            toEvidence(
              "raw telemetry observations を normalization profile で score 化して利用しています",
              {
                source: "raw_normalized"
              },
              undefined,
              0.82
            )
          ]
        : options.telemetryExport
      ? [
          toEvidence(
            "telemetry export を OAS の CommonOps input として取り込みました",
            {
              source: "telemetry_export"
            },
            undefined,
            0.8
          )
        ]
        : options.telemetrySource
          ? [
              toEvidence(
                `telemetry source (${options.telemetrySource.sourceType}) から canonical export を取り込みました`,
                {
                  source: "telemetry_source",
                  sourceType: options.telemetrySource.sourceType,
                  ...(options.telemetrySource.resolvedPath ? { sourcePath: options.telemetrySource.resolvedPath } : {}),
                  ...(options.telemetrySource.command ? { command: options.telemetrySource.command } : {})
                },
                undefined,
                0.78
              )
            ]
        : telemetryNormalizationResult
          ? [
              toEvidence(
                "raw telemetry observations を normalization profile で score 化して利用しています",
                {
                  source: "raw_normalized"
                },
                undefined,
                0.82
              )
            ]
          : [];
  const scores: MetricScore[] = [];
  if (policy.metrics.QSF) {
    const qsfUnknowns = [
      ...scenarioScore.unknowns,
      ...(options.scenarioObservationSource?.unknowns ?? []),
      ...(options.scenarioObservations && options.scenarioObservationSourceRequested
        ? ["scenario-observations が指定されているため scenario observation source は優先されません"]
        : [])
    ];
    scores.push(
      toMetricScore(
        "QSF",
        evaluateFormula(policy.metrics.QSF.formula, {
          QSF: scenarioScore.QSF
        }),
        {
          scenario_count: scenarioScore.scenarioCount,
          weighted_coverage: scenarioScore.weightedCoverage,
          average_normalized_score: scenarioScore.averageNormalizedScore,
          QSF: scenarioScore.QSF
        },
        [...scenarioSourceEvidence, ...scenarioEvidence].map((entry) => entry.evidenceId),
        confidenceFromSignals(
          options.scenarioObservationSource
            ? [scenarioScore.confidence, options.scenarioObservationSource.confidence]
            : [scenarioScore.confidence]
        ),
        Array.from(new Set(qsfUnknowns))
      )
    );
  }
  if (policy.metrics.DDS) {
    scores.push(
      toMetricScore(
        "DDS",
        evaluateFormula(policy.metrics.DDS.formula, {
          IDR: directionScore.IDR,
          LRC: directionScore.LRC,
          APM: directionScore.APM
        }),
        {
          IDR: directionScore.IDR,
          LRC: directionScore.LRC,
          APM: directionScore.APM
        },
        evidence.map((entry) => entry.evidenceId),
        directionScore.applicableEdges > 0 ? 0.9 : 0.55,
        directionScore.applicableEdges > 0 ? [] : ["層に分類できる依存が不足しています"]
      )
    );
  }
  if (policy.metrics.BPS) {
    scores.push(
      toMetricScore(
        "BPS",
        evaluateFormula(policy.metrics.BPS.formula, {
          ALR: purityScore.ALR,
          FCC: purityScore.FCC,
          SICR: purityScore.SICR
        }),
        {
          ALR: purityScore.ALR,
          FCC: purityScore.FCC,
          SICR: purityScore.SICR
        },
        purityEvidence.map((entry) => entry.evidenceId),
        purityScore.confidence,
        purityScore.unknowns
      )
    );
  }
  if (policy.metrics.IPS) {
    scores.push(
      toMetricScore(
        "IPS",
        evaluateFormula(policy.metrics.IPS.formula, {
          CBC: protocolScore.CBC,
          BCR: protocolScore.BCR,
          SLA: protocolScore.SLA
        }),
        {
          CBC: protocolScore.CBC,
          BCR: protocolScore.BCR,
          SLA: protocolScore.SLA
        },
        protocolEvidence.map((entry) => entry.evidenceId),
        protocolScore.confidence,
        protocolScore.unknowns
      )
    );
  }
  if (policy.metrics.TIS) {
    scores.push(
      toMetricScore(
        "TIS",
        evaluateFormula(policy.metrics.TIS.formula, {
          FI: topologyScore.FI,
          RC: topologyScore.RC,
          SDR: topologyScore.SDR
        }),
        {
          FI: topologyScore.FI,
          RC: topologyScore.RC,
          SDR: topologyScore.SDR
        },
        topologyEvidence.map((entry) => entry.evidenceId),
        topologyScore.confidence,
        topologyScore.unknowns
      )
    );
  }
  if (policy.metrics.OAS) {
    const oasEvidenceRefs = [
      ...telemetrySourceEvidence,
      ...telemetryInputEvidence,
      ...telemetryExportEvidence,
      ...telemetryNormalizationEvidence,
      ...patternRuntimeNormalizationEvidence,
      ...operationsEvidence
    ].map((entry) => entry.evidenceId);
    const oasUnknowns = [
      ...(options.telemetrySource?.unknowns ?? []),
      ...(telemetryNormalizationResult?.unknowns ?? []),
      ...(telemetryExportIngestResult?.unknowns ?? []),
      ...(patternRuntimeNormalizationResult?.unknowns ?? []),
      ...operationsScore.unknowns,
      ...(options.telemetryObservations &&
      (options.telemetryRawObservations ||
        options.telemetryNormalizationProfile ||
        options.telemetryExport ||
        options.telemetrySourceRequested)
        ? ["telemetry-observations が指定されているため raw/export/source telemetry input は優先されません"]
        : []),
      ...(options.telemetryRawObservations && options.telemetryExport
        ? ["telemetry-raw-observations が指定されているため telemetry export は優先されません"]
        : []),
      ...(options.telemetrySourceRequested &&
      (options.telemetryObservations ||
        (options.telemetryRawObservations && options.telemetryNormalizationProfile) ||
        options.telemetryExport)
        ? ["高優先度の telemetry input があるため telemetry source は利用されません"]
        : []),
      ...(options.patternRuntimeObservations && telemetryExportIngestResult?.patternRuntimeObservations
        ? ["pattern-runtime-observations が指定されているため telemetry export 内の patternRuntime は優先されません"]
        : []),
      ...(options.patternRuntimeObservations &&
      options.patternRuntimeRawRequested &&
      options.patternRuntimeNormalizationProfileRequested
        ? ["pattern-runtime-observations が指定されているため raw pattern runtime input は優先されません"]
        : []),
      ...(usablePatternRuntimeRaw && telemetryExportIngestResult?.patternRuntimeObservations
        ? ["raw pattern runtime input が指定されているため telemetry export 内の patternRuntime は優先されません"]
        : [])
    ];
    scores.push(
      toMetricScore(
        "OAS",
        evaluateFormula(policy.metrics.OAS.formula, {
          CommonOps: operationsScore.CommonOps,
          PatternRuntime: operationsScore.PatternRuntime
        }),
        {
          CommonOps: operationsScore.CommonOps,
          PatternRuntime: operationsScore.PatternRuntime,
          band_count: operationsScore.bandCount,
          weighted_band_coverage: operationsScore.weightedBandCoverage
        },
        oasEvidenceRefs,
        confidenceFromSignals(
          [
            operationsScore.confidence,
            ...(patternRuntimeNormalizationResult
              ? [patternRuntimeNormalizationResult.confidence]
              : []),
            ...(telemetryNormalizationResult
              ? [telemetryNormalizationResult.confidence]
              : options.telemetrySource
                ? [options.telemetrySource.confidence, telemetryExportIngestResult?.confidence ?? 0.8]
                : telemetryExportIngestResult
                  ? [telemetryExportIngestResult.confidence]
                : [0.85])
          ]
        ),
        Array.from(new Set(oasUnknowns))
      )
    );
  }
  if (policy.metrics.CTI) {
    scores.push(
      toMetricScore(
        "CTI",
        evaluateFormula(policy.metrics.CTI.formula, complexityScore.components),
        complexityScore.components,
        [...complexitySourceEvidence, ...complexityExportEvidence, ...complexityEvidence].map((entry) => entry.evidenceId),
        confidenceFromSignals(
          complexityExportIngestResult
            ? options.complexitySource
              ? [complexityScore.confidence, complexityExportIngestResult.confidence, options.complexitySource.confidence]
              : [complexityScore.confidence, complexityExportIngestResult.confidence]
            : [complexityScore.confidence]
        ),
        Array.from(
          new Set([
            ...(options.complexitySource?.unknowns ?? []),
            ...(complexityExportIngestResult?.unknowns ?? []),
            ...complexityScore.unknowns,
            ...(options.complexityExport && options.complexitySourceRequested
              ? ["complexity-export が指定されているため complexity source は優先されません"]
              : [])
          ])
        )
      )
    );
  }
  if (policy.metrics.AELS) {
    scores.push(
      toMetricScore(
        "AELS",
        localityValue,
        {
          CrossBoundaryCoChange: evolutionLocalityScore.CrossBoundaryCoChange,
          WeightedPropagationCost: evolutionLocalityScore.WeightedPropagationCost,
          WeightedClusteringCost: evolutionLocalityScore.WeightedClusteringCost
        },
        evolutionEvidence.map((entry) => entry.evidenceId),
        evolutionLocalityScore.confidence,
        evolutionLocalityScore.unknowns
      )
    );
  }
  if (policy.metrics.EES) {
    const eesUnknowns = [
      ...(options.deliverySource?.unknowns ?? []),
      ...(deliveryExportIngestResult?.unknowns ?? []),
      ...(deliveryNormalizationResult?.unknowns ?? []),
      ...evolutionEfficiencyScore.unknowns,
      ...(options.deliveryObservations &&
      (options.deliveryRawObservations ||
        options.deliveryNormalizationProfile ||
        options.deliveryExport ||
        options.deliverySourceRequested)
        ? ["delivery-observations が指定されているため raw/export/source delivery input は優先されません"]
        : []),
      ...(options.deliveryRawObservations && options.deliveryExport
        ? ["delivery-raw-observations が指定されているため delivery export は優先されません"]
        : []),
      ...(options.deliverySourceRequested &&
      (options.deliveryObservations ||
        (options.deliveryRawObservations && options.deliveryNormalizationProfile) ||
        options.deliveryExport)
        ? ["高優先度の delivery input があるため delivery source は利用されません"]
        : [])
    ];
    scores.push(
      toMetricScore(
        "EES",
        evaluateFormula(policy.metrics.EES.formula, {
          Delivery: evolutionEfficiencyScore.Delivery,
          Locality: evolutionEfficiencyScore.Locality
        }),
        {
          Delivery: evolutionEfficiencyScore.Delivery,
          Locality: evolutionEfficiencyScore.Locality
        },
        [
          ...deliverySourceEvidence,
          ...deliveryInputEvidence,
          ...deliveryExportEvidence,
          ...deliveryNormalizationEvidence,
          ...evolutionEvidence
        ].map((entry) => entry.evidenceId),
        confidenceFromSignals(
          [
            evolutionEfficiencyScore.confidence,
            ...(deliveryNormalizationResult
              ? [deliveryNormalizationResult.confidence]
              : options.deliverySource
                ? [options.deliverySource.confidence, deliveryExportIngestResult?.confidence ?? 0.8]
                : deliveryExportIngestResult
                  ? [deliveryExportIngestResult.confidence]
                : [0.85])
          ]
        ),
        Array.from(new Set(eesUnknowns))
      )
    );
  }
  if (policy.metrics.APSI) {
    const scoreMap = new Map(scores.map((score) => [score.metricId, score]));
    const qsfMetric = scoreMap.get("QSF");
    const ddsMetric = scoreMap.get("DDS");
    const bpsMetric = scoreMap.get("BPS");
    const ipsMetric = scoreMap.get("IPS");
    const tisMetric = scoreMap.get("TIS");
    const oasMetric = scoreMap.get("OAS");
    const eesMetric = scoreMap.get("EES");
    const ctiMetric = scoreMap.get("CTI");
    const PCS = weightedAverage(
      [
        { value: ddsMetric?.value, weight: 0.4 },
        { value: bpsMetric?.value, weight: 0.35 },
        { value: ipsMetric?.value, weight: 0.25 }
      ],
      0.5
    );
    const OAS = oasMetric?.value ?? tisMetric?.value ?? 0.5;
    const apsiComponents = {
      QSF: qsfMetric?.value ?? 0.5,
      PCS,
      OAS,
      EES: eesMetric?.value ?? 0.5,
      CTI: ctiMetric?.value ?? 0.5
    };
    const apsiUnknowns = ["PCS は DDS/BPS/IPS の proxy 合成です"];
    if (!qsfMetric) {
      apsiUnknowns.push("QSF が未計算のため APSI は中立値 0.5 を使っています");
    }
    if (!ddsMetric || !bpsMetric || !ipsMetric) {
      apsiUnknowns.push("DDS/BPS/IPS の一部が未計算のため PCS は部分的な proxy です");
    }
    if (!oasMetric && tisMetric) {
      apsiUnknowns.push("OAS は TIS の proxy 合成です");
    }
    if (!oasMetric && !tisMetric) {
      apsiUnknowns.push("OAS と TIS が未計算のため APSI は中立値 0.5 を使っています");
    }
    if (!eesMetric) {
      apsiUnknowns.push("EES が未計算のため APSI は中立値 0.5 を使っています");
    }
    if (!ctiMetric) {
      apsiUnknowns.push("CTI が未計算のため APSI は中立値 0.5 を使っています");
    }
    if (profileName !== "default") {
      apsiUnknowns.push(`APSI は ${profileName} policy profile の比較重みを使っています`);
    }
    scores.push(
      toMetricScore(
        "APSI",
        evaluateFormula(policy.metrics.APSI.formula, apsiComponents),
        apsiComponents,
        Array.from(
          new Set(
            [qsfMetric, ddsMetric, bpsMetric, ipsMetric, oasMetric, tisMetric, eesMetric, ctiMetric]
              .flatMap((metric) => metric?.evidenceRefs ?? [])
          )
        ),
        confidenceFromSignals(
          [qsfMetric, ddsMetric, bpsMetric, ipsMetric, oasMetric, tisMetric, eesMetric, ctiMetric]
            .flatMap((metric) => (metric ? [metric.confidence] : []))
        ),
        Array.from(new Set(apsiUnknowns))
      )
    );
  }

  return createResponse(
    {
      domainId: "architecture_design",
      metrics: scores,
      violations
    },
    {
      status: architectureHistoryDiagnostics.length > 0 ? "warning" : "ok",
      evidence: [
        ...scenarioSourceEvidence,
        ...scenarioEvidence,
        ...evidence,
        ...purityEvidence,
        ...protocolEvidence,
        ...topologyEvidence,
        ...telemetrySourceEvidence,
        ...telemetryInputEvidence,
        ...telemetryExportEvidence,
        ...telemetryNormalizationEvidence,
        ...patternRuntimeNormalizationEvidence,
        ...operationsEvidence,
        ...deliverySourceEvidence,
        ...deliveryInputEvidence,
        ...deliveryExportEvidence,
        ...deliveryNormalizationEvidence,
        ...complexitySourceEvidence,
        ...complexityExportEvidence,
        ...complexityEvidence,
        ...evolutionEvidence
      ],
      confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
      unknowns: Array.from(new Set(scores.flatMap((score) => score.unknowns))),
      diagnostics: architectureHistoryDiagnostics,
      provenance: [
        toProvenance(repoPath, "architecture_design"),
        toProvenance(repoPath, `profile=${profileName}`),
        ...(options.additionalProvenance ?? [])
      ]
    }
  );
}
