import type { DomainDocsMetricContribution, DomainDocsMetricOptionsBase } from "./domain-design-scoring-docs-shared.js";
import { computeUliComponents } from "./domain-design-scoring-support.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals, toEvidence } from "./response.js";
import { toMetricScore } from "./scoring-shared.js";

export async function computeDomainDocsUliContribution(
  options: DomainDocsMetricOptionsBase,
  formula: string,
): Promise<DomainDocsMetricContribution> {
  if (!options.docsRoot) {
    return {
      scores: [],
      evidence: [],
      diagnostics: [],
      unknowns: ["Skipped ULI because `--docs-root` was not provided."],
    };
  }

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

  return {
    scores: [
      toMetricScore(
        "ULI",
        evaluateFormula(formula, uliComponents),
        uliComponents,
        [...termEvidence, ...traceGapEvidence].map((entry) => entry.evidenceId),
        confidenceFromSignals([glossary.confidence, averageTraceConfidence, glossary.terms.length > 0 ? 0.85 : 0.4]),
        uliUnknowns,
      ),
    ],
    evidence: [...termEvidence, ...traceGapEvidence],
    diagnostics: [...glossary.diagnostics],
    unknowns: uliUnknowns,
  };
}
