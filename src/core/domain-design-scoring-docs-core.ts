import type { Evidence, MetricScore } from "./contracts.js";
import { computeDomainDocsAfsContribution } from "./domain-design-scoring-docs-afs.js";
import { computeDomainDocsBfsContribution } from "./domain-design-scoring-docs-bfs.js";
import { computeDomainDocsDrfContribution } from "./domain-design-scoring-docs-drf.js";
import type { DomainDocsMetricContribution, DomainDocsMetricOptionsBase } from "./domain-design-scoring-docs-shared.js";
import { computeDomainDocsUliContribution } from "./domain-design-scoring-docs-uli.js";
import { dedupeEvidence } from "./scoring-shared.js";

interface DomainDocsMetricOptions extends DomainDocsMetricOptionsBase {
  formulas: Partial<Record<"DRF" | "ULI" | "BFS" | "AFS", string>>;
}

function mergeContributions(contributions: DomainDocsMetricContribution[]) {
  return {
    scores: contributions.flatMap((contribution) => contribution.scores),
    evidence: dedupeEvidence(contributions.flatMap((contribution) => contribution.evidence)),
    diagnostics: contributions.flatMap((contribution) => contribution.diagnostics),
    unknowns: contributions.flatMap((contribution) => contribution.unknowns),
  };
}

export async function computeDomainDocsMetricScores(options: DomainDocsMetricOptions): Promise<{
  scores: MetricScore[];
  evidence: Evidence[];
  diagnostics: string[];
  unknowns: string[];
}> {
  const contributions: DomainDocsMetricContribution[] = [];

  if (options.formulas.DRF) {
    contributions.push(await computeDomainDocsDrfContribution(options, options.formulas.DRF));
  }
  if (options.formulas.ULI) {
    contributions.push(await computeDomainDocsUliContribution(options, options.formulas.ULI));
  }
  if (options.formulas.BFS) {
    contributions.push(await computeDomainDocsBfsContribution(options, options.formulas.BFS));
  }
  if (options.formulas.AFS) {
    contributions.push(await computeDomainDocsAfsContribution(options, options.formulas.AFS));
  }

  return mergeContributions(contributions);
}
