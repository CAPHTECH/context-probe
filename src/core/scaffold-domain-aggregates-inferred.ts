import { buildFragmentContextMentions, collectTermContexts } from "./boundary-fitness.js";
import type {
  DomainAggregateCandidate,
  DomainModel,
  GlossaryTerm,
  InvariantCandidate,
  RuleCandidate,
} from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import {
  hasContractOccurrence,
  hasInternalOccurrence,
  normalizeName,
  STOPWORD_AGGREGATE_TERMS,
  sanitizeAggregateAliases,
  toPascalCase,
} from "./scaffold-domain-aggregates-shared.js";
import type { ContextCandidateEntry } from "./scaffold-domain-contexts.js";
import type { DocsBundle } from "./scaffold-domain-docs.js";

function termLooksLikeAggregateCandidate(term: GlossaryTerm): boolean {
  const normalized = term.canonicalTerm.trim();
  if (normalized.length === 0) {
    return false;
  }
  return !STOPWORD_AGGREGATE_TERMS.some((pattern) => pattern.test(normalized));
}

function countTermSupport(term: GlossaryTerm, rules: RuleCandidate[], invariants: InvariantCandidate[]): number {
  const normalizedTerm = normalizeName(term.canonicalTerm);
  return [...rules, ...invariants].filter((entry) => {
    if (normalizeName(entry.statement).includes(normalizedTerm)) {
      return true;
    }
    return (entry.relatedTerms ?? []).some((relatedTerm) => normalizeName(relatedTerm) === normalizedTerm);
  }).length;
}

export function createInferredAggregateCandidates(
  contextCandidates: ContextCandidateEntry[],
  docsBundle: DocsBundle | undefined,
): DomainAggregateCandidate[] {
  if (!docsBundle) {
    return [];
  }

  const model: DomainModel = {
    version: "1.0",
    contexts: contextCandidates.map((entry) => entry.candidate.definition),
  };
  const contextByName = new Map(model.contexts.map((context) => [context.name, context]));
  const linkByTermId = new Map(docsBundle.termLinks.map((link) => [link.termId, link]));
  const fragmentContextMentions = buildFragmentContextMentions(docsBundle.glossary.fragments, model);
  const candidates: DomainAggregateCandidate[] = [];

  for (const term of docsBundle.glossary.terms) {
    if (!termLooksLikeAggregateCandidate(term)) {
      continue;
    }

    const link = linkByTermId.get(term.termId);
    const contexts = collectTermContexts(term, link, fragmentContextMentions, model);
    if (contexts.length !== 1) {
      continue;
    }

    const contextName = contexts[0];
    if (!contextName) {
      continue;
    }
    const context = contextByName.get(contextName);
    if (!context || hasContractOccurrence(link, context) || !hasInternalOccurrence(link, context)) {
      continue;
    }

    const supportCount = countTermSupport(term, docsBundle.rules.rules, docsBundle.invariants.invariants);
    if (supportCount === 0 && (link?.coverage.codeHits ?? 0) === 0) {
      continue;
    }

    const name = toPascalCase(term.canonicalTerm);
    const aliases = sanitizeAggregateAliases(name, [term.canonicalTerm, ...term.aliases]);
    const confidence = clampConfidence(
      0.58 +
        Math.min(0.15, supportCount * 0.05) +
        ((link?.coverage.codeHits ?? 0) > 0 ? 0.08 : 0) +
        (term.collision ? -0.08 : 0),
    );

    candidates.push({
      definition: {
        name,
        context: contextName,
        ...(aliases.length > 0 ? { aliases } : {}),
      },
      confidence,
      evidence: [
        toEvidence(
          `${name} was inferred from a localized term in ${contextName}.`,
          {
            context: contextName,
            term: term.canonicalTerm,
            codeHits: link?.coverage.codeHits ?? 0,
            supportCount,
          },
          [term.termId],
          confidence,
        ),
      ],
      unknowns: ["The aggregate name is inferred from localized document terms and should be reviewed."],
    });
  }

  return candidates;
}
