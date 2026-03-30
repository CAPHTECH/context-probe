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

async function runContribution(
  options: DomainDocsMetricOptions,
  metricId: "DRF" | "ULI" | "BFS" | "AFS",
  task: () => Promise<DomainDocsMetricContribution>,
): Promise<DomainDocsMetricContribution> {
  const startedAt = Date.now();
  options.reportProgress?.({
    phase: "docs",
    message: `Computing ${metricId} from document evidence.`,
  });
  const result = await task();
  options.reportProgress?.({
    phase: "docs",
    message: `Computed ${metricId} from document evidence in ${Date.now() - startedAt}ms.`,
    elapsedMs: Date.now() - startedAt,
  });
  return result;
}

export async function computeDomainDocsMetricScores(options: DomainDocsMetricOptions): Promise<{
  scores: MetricScore[];
  evidence: Evidence[];
  diagnostics: string[];
  unknowns: string[];
}> {
  const contributions: DomainDocsMetricContribution[] = [];

  const drfFormula = options.formulas.DRF;
  if (drfFormula) {
    contributions.push(
      await runContribution(options, "DRF", () => computeDomainDocsDrfContribution(options, drfFormula)),
    );
  }
  const uliFormula = options.formulas.ULI;
  if (uliFormula) {
    contributions.push(
      await runContribution(options, "ULI", () => computeDomainDocsUliContribution(options, uliFormula)),
    );
  }
  const bfsFormula = options.formulas.BFS;
  if (bfsFormula) {
    contributions.push(
      await runContribution(options, "BFS", () => computeDomainDocsBfsContribution(options, bfsFormula)),
    );
  }
  const afsFormula = options.formulas.AFS;
  if (afsFormula) {
    contributions.push(
      await runContribution(options, "AFS", () => computeDomainDocsAfsContribution(options, afsFormula)),
    );
  }

  return mergeContributions(contributions);
}
