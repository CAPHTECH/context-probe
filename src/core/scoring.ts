import type {
  ArchitectureConstraints,
  BoundaryLeakFinding,
  CochangeAnalysis,
  CommandResponse,
  DomainModel,
  ExtractionBackend,
  ExtractionProviderName,
  MetricScore,
  PolicyConfig,
  ReviewResolutionLog,
  TermTraceLink
} from "./contracts.js";
import { extractGlossary } from "./document-extractors.js";
import { evaluateFormula } from "./formula.js";
import { normalizeHistory, scoreEvolutionLocality } from "./history.js";
import { getDomainPolicy } from "./policy.js";
import { confidenceFromSignals, createResponse, toEvidence, toProvenance } from "./response.js";
import { buildTermTraceLinks } from "./trace.js";
import { detectDirectionViolations, scoreDependencyDirection } from "../analyzers/architecture.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../analyzers/code.js";

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
  if (policy.metrics.ULI) {
    if (!options.docsRoot) {
      unknowns.push("`--docs-root` が指定されていないため ULI をスキップしました");
    } else {
      const glossary = await extractGlossary({
        root: options.docsRoot,
        cwd: repoPath,
        extractor: options.extraction?.extractor ?? "heuristic",
        ...(options.extraction?.provider ? { provider: options.extraction.provider } : {}),
        ...(options.extraction?.providerCommand ? { providerCommand: options.extraction.providerCommand } : {}),
        promptProfile: options.extraction?.promptProfile ?? "default",
        fallback: options.extraction?.fallback ?? "heuristic",
        ...(options.extraction?.reviewLog ? { reviewLog: options.extraction.reviewLog } : {}),
        applyReviewLog: options.extraction?.applyReviewLog ?? false
      });
      const links = await buildTermTraceLinks({
        docsRoot: options.docsRoot,
        repoRoot: repoPath,
        terms: glossary.terms
      });
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
      evidence: [...evidence, ...additionalEvidence],
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
  const scores: MetricScore[] = [];
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

  return createResponse(
    {
      domainId: "architecture_design",
      metrics: scores,
      violations
    },
    {
      evidence,
      confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
      unknowns: scores.flatMap((score) => score.unknowns),
      provenance: [toProvenance(repoPath, "architecture_design")]
    }
  );
}
