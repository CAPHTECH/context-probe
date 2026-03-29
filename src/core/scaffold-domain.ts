import YAML from "yaml";

import { parseCodebase } from "../analyzers/code.js";
import { buildFragmentContextMentions, collectTermContexts } from "./boundary-fitness.js";
import type {
  ContextDefinition,
  DomainAggregateCandidate,
  DomainContextCandidate,
  DomainModel,
  DomainModelScaffoldResult,
  GlossaryTerm,
  InvariantCandidate,
  RuleCandidate,
  TermTraceLink,
} from "./contracts.js";
import { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";
import { matchGlobs } from "./io.js";
import { clampConfidence, toEvidence } from "./response.js";
import {
  AGGREGATE_FILE_PATTERN,
  averageConfidence,
  CONTRACT_MARKERS,
  collectMarkerGlobs,
  createDefaultExtractionOptions,
  type ExtractionOptions,
  groupSourceFiles,
  INTERNAL_MARKERS,
  inferGroupNames,
  mergeEvidence,
  mergeUnknowns,
  normalizeName,
  type ScaffoldComputation,
  type SourceGroup,
  STOPWORD_AGGREGATE_TERMS,
  toPascalCase,
  unique,
} from "./scaffold-shared.js";
import { buildTermTraceLinks } from "./trace.js";

type GlossaryExtractionResult = Awaited<ReturnType<typeof extractGlossary>>;
type RulesExtractionResult = Awaited<ReturnType<typeof extractRules>>;
type InvariantsExtractionResult = Awaited<ReturnType<typeof extractInvariants>>;

interface DocsBundle {
  glossary: GlossaryExtractionResult;
  rules: RulesExtractionResult;
  invariants: InvariantsExtractionResult;
  termLinks: TermTraceLink[];
}

function countContextMentions(name: string, fragments: GlossaryExtractionResult["fragments"] | undefined): number {
  if (!fragments) {
    return 0;
  }
  const normalizedName = normalizeName(name);
  return fragments.filter((fragment) => normalizeName(fragment.text).includes(normalizedName)).length;
}

function buildContextCandidate(
  group: SourceGroup,
  name: string,
  fragments: GlossaryExtractionResult["fragments"] | undefined,
): DomainContextCandidate {
  const pathGlobs = group.segment ? [`${group.basePath}/**`] : group.files;
  const contractGlobs = collectMarkerGlobs(group, CONTRACT_MARKERS);
  const internalGlobs = collectMarkerGlobs(group, INTERNAL_MARKERS);
  const docsMentions = countContextMentions(name, fragments);
  const confidence = clampConfidence(
    0.55 +
      (group.segment ? 0.12 : 0.05) +
      (group.files.length >= 2 ? 0.08 : 0) +
      (contractGlobs.length > 0 ? 0.08 : 0) +
      (internalGlobs.length > 0 ? 0.08 : 0) +
      (docsMentions > 0 ? 0.08 : 0),
  );

  const definition: ContextDefinition = {
    name,
    pathGlobs,
    ...(contractGlobs.length > 0 ? { contractGlobs } : {}),
    ...(internalGlobs.length > 0 ? { internalGlobs } : {}),
  };

  return {
    definition,
    confidence,
    evidence: [
      toEvidence(
        `${name} was inferred from ${group.files.length} source file(s) under ${group.basePath || "repository root"}.`,
        {
          group: group.basePath || ".",
          files: group.files.slice(0, 5),
          pathGlobs,
        },
        undefined,
        confidence,
      ),
    ],
    unknowns: group.segment ? [] : ["Root-level source files were grouped into a single context by heuristic."],
  };
}

function buildContextCandidates(
  codebase: Awaited<ReturnType<typeof parseCodebase>>,
  fragments: GlossaryExtractionResult["fragments"] | undefined,
): Array<{ group: SourceGroup; candidate: DomainContextCandidate }> {
  const groups = groupSourceFiles(codebase);
  if (groups.length === 0) {
    throw new Error("No scorable source files were found to scaffold a domain model.");
  }

  const names = inferGroupNames(groups);
  return groups.map((group, index) => ({
    group,
    candidate: buildContextCandidate(group, names[index] ?? "Context", fragments),
  }));
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
  contextCandidates: Array<{ group: SourceGroup; candidate: DomainContextCandidate }>,
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
  contextCandidates: Array<{ group: SourceGroup; candidate: DomainContextCandidate }>,
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

async function buildDocsBundle(
  repoRoot: string,
  docsRoot: string,
  codebase: Awaited<ReturnType<typeof parseCodebase>>,
  extractionOptions: ExtractionOptions | undefined,
): Promise<DocsBundle> {
  const options = extractionOptions ?? createDefaultExtractionOptions(docsRoot, repoRoot);
  const [glossary, rules, invariants] = await Promise.all([
    extractGlossary(options),
    extractRules(options),
    extractInvariants(options),
  ]);
  const termLinks = await buildTermTraceLinks({
    docsRoot,
    repoRoot,
    terms: glossary.terms,
    codeFiles: codebase.scorableSourceFiles,
  });
  return { glossary, rules, invariants, termLinks };
}

export async function scaffoldDomainModel(options: {
  repoRoot: string;
  docsRoot?: string;
  extractionOptions?: ExtractionOptions;
}): Promise<ScaffoldComputation<DomainModelScaffoldResult>> {
  const codebase = await parseCodebase(options.repoRoot);
  const docsBundle = options.docsRoot
    ? await buildDocsBundle(options.repoRoot, options.docsRoot, codebase, options.extractionOptions)
    : undefined;

  const contextCandidates = buildContextCandidates(codebase, docsBundle?.glossary.fragments);
  const explicitAggregates = createExplicitAggregateCandidates(contextCandidates, docsBundle?.glossary.fragments);
  const inferredAggregates = createTermAggregateCandidates(contextCandidates, docsBundle);
  const aggregateCandidates = deduplicateAggregateCandidates([...explicitAggregates, ...inferredAggregates]);

  const model: DomainModel = {
    version: "1.0",
    contexts: contextCandidates.map((entry) => entry.candidate.definition),
    ...(aggregateCandidates.length > 0
      ? {
          aggregates: aggregateCandidates.map((candidate) => candidate.definition),
        }
      : {}),
  };

  const result: DomainModelScaffoldResult = {
    model,
    yaml: YAML.stringify(model),
    contexts: contextCandidates.map((entry) => entry.candidate),
    aggregates: aggregateCandidates,
  };

  const extractionSignals = docsBundle
    ? [docsBundle.glossary.confidence, docsBundle.rules.confidence, docsBundle.invariants.confidence]
    : [];
  const confidence = clampConfidence(averageConfidence(contextCandidates, aggregateCandidates, extractionSignals));

  const unknowns = mergeUnknowns(
    [...contextCandidates.map((entry) => entry.candidate), ...aggregateCandidates],
    [
      ...(docsBundle
        ? [...docsBundle.glossary.unknowns, ...docsBundle.rules.unknowns, ...docsBundle.invariants.unknowns]
        : ["No docs root was provided, so aggregate candidates rely on code structure only."]),
      ...(aggregateCandidates.length === 0
        ? ["No aggregate candidates were observed; review whether aggregates should be declared explicitly."]
        : []),
    ],
  );

  const diagnostics = unique(
    [
      ...(docsBundle
        ? [...docsBundle.glossary.diagnostics, ...docsBundle.rules.diagnostics, ...docsBundle.invariants.diagnostics]
        : []),
      `Scaffolded ${contextCandidates.length} context candidate(s).`,
      `Scaffolded ${aggregateCandidates.length} aggregate candidate(s).`,
    ].filter((entry) => entry.length > 0),
  );

  return {
    result,
    confidence,
    evidence: mergeEvidence([...contextCandidates.map((entry) => entry.candidate), ...aggregateCandidates]),
    unknowns,
    diagnostics,
  };
}
