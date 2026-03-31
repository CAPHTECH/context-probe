import {
  type AggregateInvariantMapping,
  collectAggregateTargets,
  localizationScore,
} from "./aggregate-fitness-shared.js";
import { buildFragmentContextMentions, collectStatementContexts, collectTermContexts } from "./boundary-fitness.js";
import type {
  AggregateDefinition,
  DomainModel,
  Fragment,
  GlossaryTerm,
  InvariantCandidate,
  TermTraceLink,
} from "./contracts.js";
import { INVARIANT_ACCEPTANCE_AMBIGUITY } from "./document-extractor-text-review.js";
import type { ProgressReporter } from "./progress.js";

export function mapAggregateInvariants(input: {
  aggregateDefinitions: AggregateDefinition[];
  fragments: Fragment[];
  terms: GlossaryTerm[];
  links: TermTraceLink[];
  invariants: InvariantCandidate[];
  model: DomainModel;
  unknowns: string[];
  reportProgress?: ProgressReporter;
}): {
  mappings: AggregateInvariantMapping[];
  consideredInvariants: InvariantCandidate[];
  skippedInvariants: InvariantCandidate[];
} {
  const fragmentContextMentions = buildFragmentContextMentions(input.fragments, input.model);
  const linkByTermId = new Map(input.links.map((link) => [link.termId, link]));
  input.reportProgress?.({
    phase: "docs",
    message: "AFS: collecting glossary term contexts for aggregate mapping.",
  });
  const mappedTerms = input.terms
    .map((term) => ({
      labels: [term.canonicalTerm, ...(term.aliases ?? [])],
      contexts: collectTermContexts(term, linkByTermId.get(term.termId), fragmentContextMentions, input.model),
    }))
    .filter((entry) => entry.contexts.length > 0);
  let lastHeartbeatAt = Date.now();
  const mappings: AggregateInvariantMapping[] = [];
  const consideredInvariants: InvariantCandidate[] = [];
  const skippedInvariants: InvariantCandidate[] = [];

  for (const [index, invariant] of input.invariants.entries()) {
    const now = Date.now();
    if (now - lastHeartbeatAt >= 5000) {
      input.reportProgress?.({
        phase: "docs",
        message: `AFS: mapped ${index}/${input.invariants.length} invariant candidate(s).`,
        elapsedMs: now - lastHeartbeatAt,
      });
      lastHeartbeatAt = now;
    }
    const contexts = collectStatementContexts(
      invariant.statement,
      invariant.fragmentIds,
      fragmentContextMentions,
      mappedTerms,
      input.model,
    );
    const aggregateTargets = collectAggregateTargets(input.aggregateDefinitions, contexts, invariant, mappedTerms);
    const shouldSkip =
      invariant.unknowns.includes(INVARIANT_ACCEPTANCE_AMBIGUITY) &&
      (invariant.relatedTerms?.length ?? 0) === 0 &&
      !aggregateTargets.hasAnchorEvidence;
    if (shouldSkip) {
      skippedInvariants.push(invariant);
      continue;
    }
    const localityTargets = aggregateTargets.targets.length > 0 ? aggregateTargets.targets : contexts;
    input.unknowns.push(...aggregateTargets.unknowns);
    consideredInvariants.push(invariant);
    mappings.push({
      invariant,
      contexts,
      localityTargets,
      localization: localizationScore(localityTargets),
      usedContextProxy: aggregateTargets.targets.length === 0,
      aggregateTargets: aggregateTargets.targets,
    });
  }

  return {
    mappings,
    consideredInvariants,
    skippedInvariants,
  };
}
