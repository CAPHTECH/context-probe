import { buildFragmentContextMentions, collectTermContexts } from "./boundary-fitness.js";
import type {
  ContextDefinition,
  DomainAggregateCandidate,
  DomainModel,
  GlossaryTerm,
  InvariantCandidate,
  RuleCandidate,
  TermTraceLink,
} from "./contracts.js";
import { matchGlobs } from "./io.js";
import { clampConfidence, toEvidence } from "./response.js";
import type { ContextCandidateEntry } from "./scaffold-domain-contexts.js";
import type { DocsBundle, GlossaryExtractionResult } from "./scaffold-domain-docs.js";
import {
  AGGREGATE_FILE_PATTERN,
  normalizeName,
  STOPWORD_AGGREGATE_TERMS,
  toPascalCase,
  unique,
} from "./scaffold-shared.js";

function countContextMentions(name: string, fragments: GlossaryExtractionResult["fragments"] | undefined): number {
  if (!fragments) {
    return 0;
  }
  const normalizedName = normalizeName(name);
  return fragments.filter((fragment) => normalizeName(fragment.text).includes(normalizedName)).length;
}

function isAggregateFile(filePath: string): boolean {
  const baseName =
    filePath
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/u, "")
      .toLowerCase() ?? "";
  return AGGREGATE_FILE_PATTERN.test(baseName);
}

function sanitizeAggregateAliases(name: string, aliases: string[]): string[] {
  return unique(
    aliases
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0 && normalizeName(alias) !== normalizeName(name)),
  );
}

function createExplicitAggregateCandidates(
  contextCandidates: ContextCandidateEntry[],
  fragments: GlossaryExtractionResult["fragments"] | undefined,
): DomainAggregateCandidate[] {
  const aggregateCandidates: DomainAggregateCandidate[] = [];

  for (const entry of contextCandidates) {
    const aggregateFiles = entry.group.files.filter((filePath) => isAggregateFile(filePath));
    for (const filePath of aggregateFiles) {
      const fileName = filePath.split("/").pop() ?? filePath;
      const rawName = toPascalCase(fileName);
      const name = rawName === "Aggregate" ? `${entry.candidate.definition.name}Aggregate` : rawName;
      const withoutSuffix = name.replace(/Aggregate$/u, "");
      const aliases = sanitizeAggregateAliases(name, [withoutSuffix, entry.candidate.definition.name]);
      const mentionCount = countContextMentions(name, fragments) + countContextMentions(withoutSuffix, fragments);
      const confidence = clampConfidence(0.8 + (mentionCount > 0 ? 0.08 : 0));

      aggregateCandidates.push({
        definition: {
          name,
          context: entry.candidate.definition.name,
          ...(aliases.length > 0 ? { aliases } : {}),
        },
        confidence,
        evidence: [
          toEvidence(
            `${name} was inferred from ${filePath}.`,
            {
              context: entry.candidate.definition.name,
              path: filePath,
            },
            undefined,
            confidence,
          ),
        ],
        unknowns: [],
      });
    }
  }

  return aggregateCandidates;
}

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

function hasContractOccurrence(termLink: TermTraceLink | undefined, context: ContextDefinition): boolean {
  return (termLink?.occurrences ?? []).some(
    (occurrence) => occurrence.kind === "code" && matchGlobs(occurrence.path, context.contractGlobs),
  );
}

function hasInternalOccurrence(termLink: TermTraceLink | undefined, context: ContextDefinition): boolean {
  return (termLink?.occurrences ?? []).some(
    (occurrence) =>
      occurrence.kind === "code" &&
      (matchGlobs(occurrence.path, context.internalGlobs) || matchGlobs(occurrence.path, context.pathGlobs)),
  );
}

function createTermAggregateCandidates(
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

function deduplicateAggregateCandidates(candidates: DomainAggregateCandidate[]): DomainAggregateCandidate[] {
  const deduped = new Map<string, DomainAggregateCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.definition.context}:${normalizeName(candidate.definition.name)}`;
    const current = deduped.get(key);
    if (!current || current.confidence < candidate.confidence) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const contextComparison = left.definition.context.localeCompare(right.definition.context);
    if (contextComparison !== 0) {
      return contextComparison;
    }
    return left.definition.name.localeCompare(right.definition.name);
  });
}

export function buildAggregateCandidates(
  contextCandidates: ContextCandidateEntry[],
  docsBundle: DocsBundle | undefined,
): DomainAggregateCandidate[] {
  const explicitAggregates = createExplicitAggregateCandidates(contextCandidates, docsBundle?.glossary.fragments);
  const inferredAggregates = createTermAggregateCandidates(contextCandidates, docsBundle);
  return deduplicateAggregateCandidates([...explicitAggregates, ...inferredAggregates]);
}
