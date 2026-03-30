import { computeBoundaryFitness } from "./boundary-fitness.js";
import type { DomainDocsMetricContribution, DomainDocsMetricOptionsBase } from "./domain-design-scoring-docs-shared.js";
import { evaluateFormula } from "./formula.js";
import { toMetricScore } from "./scoring-shared.js";
import { buildModelCodeLinks } from "./trace.js";

export async function computeDomainDocsBfsContribution(
  options: DomainDocsMetricOptionsBase,
  formula: string,
): Promise<DomainDocsMetricContribution> {
  if (!options.docsRoot) {
    return {
      scores: [],
      evidence: [],
      diagnostics: [],
      unknowns: ["Skipped BFS because `--docs-root` was not provided."],
    };
  }

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
    reportProgress: options.reportProgress,
  });

  return {
    scores: [
      toMetricScore(
        "BFS",
        evaluateFormula(formula, {
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
    ],
    evidence: bfsResult.evidence,
    diagnostics: bfsResult.diagnostics,
    unknowns: bfsResult.unknowns,
  };
}
