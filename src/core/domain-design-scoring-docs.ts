import type { detectBoundaryLeaks, detectContractUsage } from "../analyzers/code.js";
import { computeAggregateFitness } from "./aggregate-fitness.js";
import { computeBoundaryFitness } from "./boundary-fitness.js";
import type { DomainModel, Evidence, MetricScore, TermTraceLink } from "./contracts.js";
import type { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";
import {
  buildReviewItemsForCandidates,
  computeDrfComponents,
  computeUliComponents,
} from "./domain-design-scoring-support.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals, toEvidence } from "./response.js";
import { dedupeEvidence, toMetricScore } from "./scoring-shared.js";
import { buildModelCodeLinks } from "./trace.js";

type GlossaryExtractionResult = Awaited<ReturnType<typeof extractGlossary>>;
type RulesExtractionResult = Awaited<ReturnType<typeof extractRules>>;
type InvariantsExtractionResult = Awaited<ReturnType<typeof extractInvariants>>;

interface DomainDocsMetricOptions {
  docsRoot: string | undefined;
  model: DomainModel;
  codeFiles: string[];
  contractUsage: ReturnType<typeof detectContractUsage>;
  leakFindings: ReturnType<typeof detectBoundaryLeaks>;
  getGlossaryResult: () => Promise<GlossaryExtractionResult>;
  getRulesResult: () => Promise<RulesExtractionResult>;
  getInvariantsResult: () => Promise<InvariantsExtractionResult>;
  getTermTraceLinks: () => Promise<TermTraceLink[]>;
  formulas: Partial<Record<"DRF" | "ULI" | "BFS" | "AFS", string>>;
}

export async function computeDomainDocsMetricScores(options: DomainDocsMetricOptions): Promise<{
  scores: MetricScore[];
  evidence: Evidence[];
  diagnostics: string[];
  unknowns: string[];
}> {
  const scores: MetricScore[] = [];
  const evidence: Evidence[] = [];
  const diagnostics: string[] = [];
  const unknowns: string[] = [];

  if (options.formulas.DRF) {
    if (!options.docsRoot) {
      unknowns.push("Skipped DRF because `--docs-root` was not provided.");
    } else {
      const [rulesResult, invariantsResult] = await Promise.all([
        options.getRulesResult(),
        options.getInvariantsResult(),
      ]);
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
      evidence.push(...drfEvidence);
      diagnostics.push(...rulesResult.diagnostics, ...invariantsResult.diagnostics);

      scores.push(
        toMetricScore(
          "DRF",
          evaluateFormula(options.formulas.DRF, drfComponents),
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

  if (options.formulas.ULI) {
    if (!options.docsRoot) {
      unknowns.push("Skipped ULI because `--docs-root` was not provided.");
    } else {
      const [glossary, links] = await Promise.all([options.getGlossaryResult(), options.getTermTraceLinks()]);
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
      evidence.push(...termEvidence, ...traceGapEvidence);

      scores.push(
        toMetricScore(
          "ULI",
          evaluateFormula(options.formulas.ULI, uliComponents),
          uliComponents,
          [...termEvidence, ...traceGapEvidence].map((entry) => entry.evidenceId),
          confidenceFromSignals([glossary.confidence, averageTraceConfidence, glossary.terms.length > 0 ? 0.85 : 0.4]),
          uliUnknowns,
        ),
      );

      diagnostics.push(...glossary.diagnostics);
    }
  }

  if (options.formulas.BFS) {
    if (!options.docsRoot) {
      unknowns.push("Skipped BFS because `--docs-root` was not provided.");
    } else {
      const [glossary, rulesResult, invariantsResult, links] = await Promise.all([
        options.getGlossaryResult(),
        options.getRulesResult(),
        options.getInvariantsResult(),
        options.getTermTraceLinks(),
      ]);
      const bfsResult = computeBoundaryFitness({
        model: options.model,
        fragments: rulesResult.fragments,
        terms: glossary.terms,
        links,
        rules: rulesResult.rules,
        invariants: invariantsResult.invariants,
        contractUsage: options.contractUsage,
        leakFindings: options.leakFindings,
        modelCodeLinks: buildModelCodeLinks(options.model, options.codeFiles),
      });

      evidence.push(...bfsResult.evidence);
      diagnostics.push(...bfsResult.diagnostics);
      scores.push(
        toMetricScore(
          "BFS",
          evaluateFormula(options.formulas.BFS, {
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

  if (options.formulas.AFS) {
    if (!options.docsRoot) {
      unknowns.push("Skipped AFS because `--docs-root` was not provided.");
    } else {
      const [glossary, invariantsResult, links] = await Promise.all([
        options.getGlossaryResult(),
        options.getInvariantsResult(),
        options.getTermTraceLinks(),
      ]);
      const afsResult = computeAggregateFitness({
        model: options.model,
        fragments: invariantsResult.fragments,
        terms: glossary.terms,
        links,
        invariants: invariantsResult.invariants,
      });

      evidence.push(...afsResult.evidence);
      diagnostics.push(...afsResult.diagnostics);
      scores.push(
        toMetricScore(
          "AFS",
          evaluateFormula(options.formulas.AFS, {
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

  return {
    scores,
    evidence: dedupeEvidence(evidence),
    diagnostics,
    unknowns,
  };
}
