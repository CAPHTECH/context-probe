import { computeAggregateFitness } from "./aggregate-fitness.js";
import type { DomainDocsMetricContribution, DomainDocsMetricOptionsBase } from "./domain-design-scoring-docs-shared.js";
import { evaluateFormula } from "./formula.js";
import { toMetricScore } from "./scoring-shared.js";

export async function computeDomainDocsAfsContribution(
  options: DomainDocsMetricOptionsBase,
  formula: string,
): Promise<DomainDocsMetricContribution> {
  if (!options.docsRoot) {
    return {
      scores: [],
      evidence: [],
      diagnostics: [],
      unknowns: ["Skipped AFS because `--docs-root` was not provided."],
    };
  }

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

  return {
    scores: [
      toMetricScore(
        "AFS",
        evaluateFormula(formula, {
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
    ],
    evidence: afsResult.evidence,
    diagnostics: afsResult.diagnostics,
    unknowns: afsResult.unknowns,
  };
}
