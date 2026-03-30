import type { DomainAggregateCandidate } from "./contracts.js";
import { deduplicateAggregateCandidates } from "./scaffold-domain-aggregates-dedupe.js";
import { createExplicitAggregateCandidates } from "./scaffold-domain-aggregates-explicit.js";
import { createInferredAggregateCandidates } from "./scaffold-domain-aggregates-inferred.js";
import type { ContextCandidateEntry } from "./scaffold-domain-contexts.js";
import type { DocsBundle } from "./scaffold-domain-docs.js";

export function buildAggregateCandidates(
  contextCandidates: ContextCandidateEntry[],
  docsBundle: DocsBundle | undefined,
): DomainAggregateCandidate[] {
  const explicitAggregates = createExplicitAggregateCandidates(contextCandidates, docsBundle?.glossary.fragments);
  const inferredAggregates = createInferredAggregateCandidates(contextCandidates, docsBundle);
  return deduplicateAggregateCandidates([...explicitAggregates, ...inferredAggregates]);
}
