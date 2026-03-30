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

export function mapAggregateInvariants(input: {
  aggregateDefinitions: AggregateDefinition[];
  fragments: Fragment[];
  terms: GlossaryTerm[];
  links: TermTraceLink[];
  invariants: InvariantCandidate[];
  model: DomainModel;
  unknowns: string[];
}): AggregateInvariantMapping[] {
  const fragmentContextMentions = buildFragmentContextMentions(input.fragments, input.model);
  const linkByTermId = new Map(input.links.map((link) => [link.termId, link]));
  const mappedTerms = input.terms
    .map((term) => ({
      canonicalTerm: term.canonicalTerm,
      contexts: collectTermContexts(term, linkByTermId.get(term.termId), fragmentContextMentions, input.model),
    }))
    .filter((entry) => entry.contexts.length > 0);

  return input.invariants.map((invariant) => {
    const contexts = collectStatementContexts(
      invariant.statement,
      invariant.fragmentIds,
      fragmentContextMentions,
      mappedTerms,
      input.model,
    );
    const aggregateTargets = collectAggregateTargets(input.aggregateDefinitions, contexts, invariant);
    const localityTargets = aggregateTargets.targets.length > 0 ? aggregateTargets.targets : contexts;
    input.unknowns.push(...aggregateTargets.unknowns);
    return {
      invariant,
      contexts,
      localityTargets,
      localization: localizationScore(localityTargets),
      usedContextProxy: aggregateTargets.targets.length === 0,
      aggregateTargets: aggregateTargets.targets,
    };
  });
}
