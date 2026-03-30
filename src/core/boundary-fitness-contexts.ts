import type { DomainModel, Fragment, GlossaryTerm, TermTraceLink, TraceLinkOccurrence } from "./contracts.js";
import { matchGlobs } from "./io.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiLabel(value: string): boolean {
  return /^[A-Za-z0-9 _-]+$/.test(value);
}

function contextMentionPattern(name: string): RegExp | null {
  if (isAsciiLabel(name)) {
    return new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(name)}([^A-Za-z0-9_]|$)`, "i");
  }
  return null;
}

function detectContextMentions(text: string, model: DomainModel): string[] {
  return model.contexts
    .filter((context) => {
      const pattern = contextMentionPattern(context.name);
      if (pattern) {
        return pattern.test(text);
      }
      return text.includes(context.name);
    })
    .map((context) => context.name);
}

function mapOccurrenceToContexts(occurrence: TraceLinkOccurrence, model: DomainModel): string[] {
  if (occurrence.kind !== "code") {
    return [];
  }
  return model.contexts
    .filter((context) => matchGlobs(occurrence.path, context.pathGlobs))
    .map((context) => context.name);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function buildFragmentContextMentions(fragments: Fragment[], model: DomainModel): Map<string, string[]> {
  return new Map(
    fragments.map((fragment) => [fragment.fragmentId, unique(detectContextMentions(fragment.text, model))]),
  );
}

export function collectTermContexts(
  term: GlossaryTerm,
  link: TermTraceLink | undefined,
  fragmentContextMentions: Map<string, string[]>,
  model: DomainModel,
): string[] {
  const contexts = new Set<string>();

  for (const occurrence of link?.occurrences ?? []) {
    for (const contextName of mapOccurrenceToContexts(occurrence, model)) {
      contexts.add(contextName);
    }
    if (occurrence.kind === "document" && occurrence.fragmentId) {
      for (const contextName of fragmentContextMentions.get(occurrence.fragmentId) ?? []) {
        contexts.add(contextName);
      }
    }
  }

  for (const fragmentId of term.fragmentIds) {
    for (const contextName of fragmentContextMentions.get(fragmentId) ?? []) {
      contexts.add(contextName);
    }
  }

  return Array.from(contexts);
}

export function collectStatementContexts(
  statement: string,
  fragmentIds: string[],
  fragmentContextMentions: Map<string, string[]>,
  mappedTerms: Array<{ canonicalTerm: string; contexts: string[] }>,
  model: DomainModel,
): string[] {
  const contexts = new Set<string>();
  const normalizedStatement = statement.toLowerCase();

  for (const contextName of detectContextMentions(statement, model)) {
    contexts.add(contextName);
  }
  for (const fragmentId of fragmentIds) {
    for (const contextName of fragmentContextMentions.get(fragmentId) ?? []) {
      contexts.add(contextName);
    }
  }
  for (const term of mappedTerms) {
    if (term.contexts.length === 0) {
      continue;
    }
    if (normalizedStatement.includes(term.canonicalTerm.toLowerCase())) {
      for (const contextName of term.contexts) {
        contexts.add(contextName);
      }
    }
  }

  return Array.from(contexts);
}
