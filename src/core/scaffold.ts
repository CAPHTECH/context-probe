import path from "node:path";

import YAML from "yaml";

import { parseCodebase } from "../analyzers/code.js";
import { buildFragmentContextMentions, collectTermContexts } from "./boundary-fitness.js";
import type {
  ArchitectureConstraints,
  ArchitectureConstraintsScaffoldResult,
  ArchitectureLayerCandidate,
  CodebaseAnalysis,
  ContextDefinition,
  DomainAggregateCandidate,
  DomainContextCandidate,
  DomainModel,
  DomainModelScaffoldResult,
  Evidence,
  GlossaryTerm,
  InvariantCandidate,
  LayerDefinition,
  RuleCandidate,
  TermTraceLink
} from "./contracts.js";
import { extractGlossary, extractInvariants, extractRules } from "./document-extractors.js";
import { matchGlobs } from "./io.js";
import { clampConfidence, toEvidence } from "./response.js";
import { buildTermTraceLinks } from "./trace.js";

const SOURCE_ROOTS = new Set(["src", "lib", "app"]);
const CONTRACT_MARKERS = new Set(["contract", "contracts", "api", "schema", "schemas", "dto", "dtos"]);
const INTERNAL_MARKERS = new Set(["internal", "impl", "private", "_internal"]);
const AGGREGATE_FILE_PATTERN = /aggregate/i;
const STOPWORD_AGGREGATE_TERMS = [/context$/i, /contract$/i, /service$/i, /handler$/i, /controller$/i];
const LAYER_PRIORITY_HINTS = new Map<string, number>([
  ["domain", 0],
  ["core", 0],
  ["foundation", 0],
  ["model", 0],
  ["kernel", 0],
  ["application", 1],
  ["app", 1],
  ["usecase", 1],
  ["usecases", 1],
  ["use_case", 1],
  ["use_cases", 1],
  ["service", 1],
  ["services", 1],
  ["domain_services", 1],
  ["orchestration", 1],
  ["adapter", 2],
  ["adapters", 2],
  ["interface", 2],
  ["interfaces", 2],
  ["delivery", 2],
  ["presentation", 2],
  ["ui", 2],
  ["api", 2],
  ["transport", 2],
  ["infra", 3],
  ["infrastructure", 3],
  ["persistence", 3],
  ["platform", 3]
]);

type ExtractionOptions = Parameters<typeof extractGlossary>[0];
type GlossaryExtractionResult = Awaited<ReturnType<typeof extractGlossary>>;
type RulesExtractionResult = Awaited<ReturnType<typeof extractRules>>;
type InvariantsExtractionResult = Awaited<ReturnType<typeof extractInvariants>>;

interface SourceGroup {
  key: string;
  basePath: string;
  sourceRoot?: string;
  segment?: string;
  files: string[];
}

interface DocsBundle {
  glossary: GlossaryExtractionResult;
  rules: RulesExtractionResult;
  invariants: InvariantsExtractionResult;
  termLinks: TermTraceLink[];
}

interface ScaffoldComputation<T> {
  result: T;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  diagnostics: string[];
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function toPascalCase(value: string): string {
  const normalized = value
    .replace(/\.[^.]+$/u, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!normalized) {
    return "Generated";
  }
  return normalized
    .split(/\s+/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function makeUniqueNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  return names.map((name) => {
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    if (count === 0) {
      return name;
    }
    return `${name}${count + 1}`;
  });
}

function createDefaultExtractionOptions(docsRoot: string, repoRoot: string): ExtractionOptions {
  return {
    root: docsRoot,
    cwd: repoRoot,
    extractor: "heuristic",
    promptProfile: "default",
    fallback: "heuristic",
    applyReviewLog: false
  } as const;
}

function groupSourceFiles(codebase: CodebaseAnalysis): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();

  for (const filePath of codebase.scorableSourceFiles) {
    const parts = filePath.split("/");
    if (parts.length === 0) {
      continue;
    }

    let key = "__root__";
    let basePath = "";
    let sourceRoot: string | undefined;
    let segment: string | undefined;

    if (SOURCE_ROOTS.has(parts[0] ?? "")) {
      const rootName = parts[0];
      if (!rootName) {
        continue;
      }
      sourceRoot = rootName;
      if (parts.length >= 3) {
        const segmentName = parts[1];
        if (!segmentName) {
          continue;
        }
        segment = segmentName;
        basePath = `${sourceRoot}/${segment}`;
        key = basePath;
      } else {
        basePath = sourceRoot;
        key = `${sourceRoot}/__root__`;
      }
    } else if (parts.length >= 2) {
      const segmentName = parts[0];
      if (!segmentName) {
        continue;
      }
      segment = segmentName;
      basePath = segment;
      key = segment;
    }

    const group = groups.get(key) ?? {
      key,
      basePath,
      ...(sourceRoot ? { sourceRoot } : {}),
      ...(segment ? { segment } : {}),
      files: []
    };
    group.files.push(filePath);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, files: group.files.sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function inferRootGroupName(group: SourceGroup): string {
  if (group.sourceRoot === "src" || group.sourceRoot === "app") {
    return "Application";
  }
  if (group.sourceRoot === "lib") {
    return "Library";
  }
  return "Root";
}

function inferGroupNames(groups: SourceGroup[]): string[] {
  return makeUniqueNames(
    groups.map((group) => (group.segment ? toPascalCase(group.segment) : inferRootGroupName(group)))
  );
}

function collectMarkerGlobs(group: SourceGroup, markers: Set<string>): string[] {
  const globs = new Set<string>();
  const markerFiles = new Set<string>();

  for (const filePath of group.files) {
    const relative = group.basePath && filePath.startsWith(`${group.basePath}/`) ? filePath.slice(group.basePath.length + 1) : filePath;
    const relativeParts = relative.split("/");
    for (const segment of relativeParts.slice(0, -1)) {
      if (markers.has(segment.toLowerCase())) {
        if (group.basePath) {
          globs.add(`${group.basePath}/${segment}/**`);
        } else {
          globs.add(`${segment}/**`);
        }
      }
    }
    const baseName = path.basename(filePath, path.extname(filePath)).toLowerCase();
    if (Array.from(markers).some((marker) => baseName.includes(marker))) {
      markerFiles.add(filePath);
    }
  }

  return globs.size > 0 ? Array.from(globs).sort() : Array.from(markerFiles).sort();
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
  fragments: GlossaryExtractionResult["fragments"] | undefined
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
      (docsMentions > 0 ? 0.08 : 0)
  );

  const definition: ContextDefinition = {
    name,
    pathGlobs,
    ...(contractGlobs.length > 0 ? { contractGlobs } : {}),
    ...(internalGlobs.length > 0 ? { internalGlobs } : {})
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
          pathGlobs
        },
        undefined,
        confidence
      )
    ],
    unknowns: group.segment
      ? []
      : ["Root-level source files were grouped into a single context by heuristic."]
  };
}

function buildContextCandidates(
  codebase: CodebaseAnalysis,
  fragments: GlossaryExtractionResult["fragments"] | undefined
): Array<{ group: SourceGroup; candidate: DomainContextCandidate }> {
  const groups = groupSourceFiles(codebase);
  if (groups.length === 0) {
    throw new Error("No scorable source files were found to scaffold a domain model.");
  }

  const names = inferGroupNames(groups);
  return groups.map((group, index) => ({
    group,
    candidate: buildContextCandidate(group, names[index] ?? "Context", fragments)
  }));
}

function isAggregateFile(filePath: string): boolean {
  const baseName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  return AGGREGATE_FILE_PATTERN.test(baseName);
}

function sanitizeAggregateAliases(name: string, aliases: string[]): string[] {
  return unique(
    aliases
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0 && normalizeName(alias) !== normalizeName(name))
  );
}

function createExplicitAggregateCandidates(
  contextCandidates: Array<{ group: SourceGroup; candidate: DomainContextCandidate }>,
  fragments: GlossaryExtractionResult["fragments"] | undefined
): DomainAggregateCandidate[] {
  const aggregateCandidates: DomainAggregateCandidate[] = [];

  for (const entry of contextCandidates) {
    const aggregateFiles = entry.group.files.filter((filePath) => isAggregateFile(filePath));
    for (const filePath of aggregateFiles) {
      const rawName = toPascalCase(path.basename(filePath, path.extname(filePath)));
      const name = rawName === "Aggregate" ? `${entry.candidate.definition.name}Aggregate` : rawName;
      const withoutSuffix = name.replace(/Aggregate$/u, "");
      const aliases = sanitizeAggregateAliases(name, [withoutSuffix, entry.candidate.definition.name]);
      const mentionCount = countContextMentions(name, fragments) + countContextMentions(withoutSuffix, fragments);
      const confidence = clampConfidence(0.8 + (mentionCount > 0 ? 0.08 : 0));

      aggregateCandidates.push({
        definition: {
          name,
          context: entry.candidate.definition.name,
          ...(aliases.length > 0 ? { aliases } : {})
        },
        confidence,
        evidence: [
          toEvidence(
            `${name} was inferred from ${filePath}.`,
            {
              context: entry.candidate.definition.name,
              path: filePath
            },
            undefined,
            confidence
          )
        ],
        unknowns: []
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

function countTermSupport(
  term: GlossaryTerm,
  rules: RuleCandidate[],
  invariants: InvariantCandidate[]
): number {
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
    (occurrence) => occurrence.kind === "code" && matchGlobs(occurrence.path, context.contractGlobs)
  );
}

function hasInternalOccurrence(termLink: TermTraceLink | undefined, context: ContextDefinition): boolean {
  return (termLink?.occurrences ?? []).some(
    (occurrence) =>
      occurrence.kind === "code" &&
      (matchGlobs(occurrence.path, context.internalGlobs) || matchGlobs(occurrence.path, context.pathGlobs))
  );
}

function createTermAggregateCandidates(
  contextCandidates: Array<{ group: SourceGroup; candidate: DomainContextCandidate }>,
  docsBundle: DocsBundle | undefined
): DomainAggregateCandidate[] {
  if (!docsBundle) {
    return [];
  }

  const model: DomainModel = {
    version: "1.0",
    contexts: contextCandidates.map((entry) => entry.candidate.definition)
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
        (term.collision ? -0.08 : 0)
    );

    candidates.push({
      definition: {
        name,
        context: contextName,
        ...(aliases.length > 0 ? { aliases } : {})
      },
      confidence,
      evidence: [
        toEvidence(
          `${name} was inferred from a localized term in ${contextName}.`,
          {
            context: contextName,
            term: term.canonicalTerm,
            codeHits: link?.coverage.codeHits ?? 0,
            supportCount
          },
          [term.termId],
          confidence
        )
      ],
      unknowns: ["The aggregate name is inferred from localized document terms and should be reviewed."]
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

function mergeEvidence(candidates: Array<{ evidence: Evidence[] }>): Evidence[] {
  return candidates.flatMap((candidate) => candidate.evidence).slice(0, 12);
}

function mergeUnknowns(candidates: Array<{ unknowns: string[] }>, extras: string[] = []): string[] {
  return unique([...extras, ...candidates.flatMap((candidate) => candidate.unknowns)]);
}

async function buildDocsBundle(
  repoRoot: string,
  docsRoot: string,
  codebase: CodebaseAnalysis,
  extractionOptions: ExtractionOptions | undefined
): Promise<DocsBundle> {
  const options = extractionOptions ?? createDefaultExtractionOptions(docsRoot, repoRoot);
  const [glossary, rules, invariants] = await Promise.all([
    extractGlossary(options),
    extractRules(options),
    extractInvariants(options)
  ]);
  const termLinks = await buildTermTraceLinks({
    docsRoot,
    repoRoot,
    terms: glossary.terms,
    codeFiles: codebase.scorableSourceFiles
  });
  return { glossary, rules, invariants, termLinks };
}

function buildLayerCandidate(group: SourceGroup, balance: number): ArchitectureLayerCandidate {
  const name = group.segment ? toPascalCase(group.segment) : inferRootGroupName(group);
  const globs = group.segment ? [`${group.basePath}/**`] : group.files;
  const hintKey = normalizeName(group.segment ?? name).replace(/\s+/gu, "_");
  const confidence = clampConfidence(0.58 + (LAYER_PRIORITY_HINTS.has(hintKey) ? 0.18 : 0) + (group.files.length >= 2 ? 0.08 : 0));
  return {
    definition: {
      name,
      rank: 0,
      globs
    },
    confidence,
    evidence: [
      toEvidence(
        `${name} was inferred from ${group.files.length} source file(s).`,
        {
          group: group.basePath || ".",
          outgoingMinusIncomingDependencies: balance,
          globs
        },
        undefined,
        confidence
      )
    ],
    unknowns: group.segment ? [] : ["Root-level source files were grouped into a single layer by heuristic."]
  };
}

function inferLayerOrder(codebase: CodebaseAnalysis, groups: SourceGroup[]): SourceGroup[] {
  const fileToGroup = new Map<string, string>();
  for (const group of groups) {
    for (const filePath of group.files) {
      fileToGroup.set(filePath, group.key);
    }
  }

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const group of groups) {
    incoming.set(group.key, 0);
    outgoing.set(group.key, 0);
  }

  for (const dependency of codebase.dependencies) {
    if (dependency.targetKind !== "file") {
      continue;
    }
    const sourceGroup = fileToGroup.get(dependency.source);
    const targetGroup = fileToGroup.get(dependency.target);
    if (!sourceGroup || !targetGroup || sourceGroup === targetGroup) {
      continue;
    }
    outgoing.set(sourceGroup, (outgoing.get(sourceGroup) ?? 0) + 1);
    incoming.set(targetGroup, (incoming.get(targetGroup) ?? 0) + 1);
  }

  return [...groups].sort((left, right) => {
    const leftHint = LAYER_PRIORITY_HINTS.get(normalizeName(left.segment ?? inferRootGroupName(left)).replace(/\s+/gu, "_"));
    const rightHint = LAYER_PRIORITY_HINTS.get(normalizeName(right.segment ?? inferRootGroupName(right)).replace(/\s+/gu, "_"));
    const leftPriority = leftHint ?? 100;
    const rightPriority = rightHint ?? 100;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    const leftBalance = (outgoing.get(left.key) ?? 0) - (incoming.get(left.key) ?? 0);
    const rightBalance = (outgoing.get(right.key) ?? 0) - (incoming.get(right.key) ?? 0);
    if (leftBalance !== rightBalance) {
      return leftBalance - rightBalance;
    }
    return left.key.localeCompare(right.key);
  });
}

function buildArchitectureConstraints(groups: SourceGroup[]): ArchitectureConstraints {
  const orderedNames = makeUniqueNames(
    groups.map((group) => (group.segment ? toPascalCase(group.segment) : inferRootGroupName(group)))
  );
  const layers: LayerDefinition[] = groups.map((group, index) => ({
    name: orderedNames[index] ?? `Layer${index + 1}`,
    rank: index,
    globs: group.segment ? [`${group.basePath}/**`] : group.files
  }));
  return {
    version: "1.0",
    direction: "inward",
    layers
  };
}

export async function scaffoldDomainModel(options: {
  repoRoot: string;
  docsRoot?: string;
  extractionOptions?: ExtractionOptions;
}): Promise<ScaffoldComputation<DomainModelScaffoldResult>> {
  const codebase = await parseCodebase(options.repoRoot);
  const docsBundle =
    options.docsRoot
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
          aggregates: aggregateCandidates.map((candidate) => candidate.definition)
        }
      : {})
  };

  const result: DomainModelScaffoldResult = {
    model,
    yaml: YAML.stringify(model),
    contexts: contextCandidates.map((entry) => entry.candidate),
    aggregates: aggregateCandidates
  };

  const extractionSignals = docsBundle
    ? [docsBundle.glossary.confidence, docsBundle.rules.confidence, docsBundle.invariants.confidence]
    : [];
  const confidence = clampConfidence(
    [
      ...contextCandidates.map((entry) => entry.candidate.confidence),
      ...aggregateCandidates.map((candidate) => candidate.confidence),
      ...extractionSignals
    ].reduce((sum, signal) => sum + signal, 0) /
      Math.max(1, contextCandidates.length + aggregateCandidates.length + extractionSignals.length)
  );

  const unknowns = mergeUnknowns(
    [...contextCandidates.map((entry) => entry.candidate), ...aggregateCandidates],
    [
      ...(docsBundle
        ? [
            ...docsBundle.glossary.unknowns,
            ...docsBundle.rules.unknowns,
            ...docsBundle.invariants.unknowns
          ]
        : ["No docs root was provided, so aggregate candidates rely on code structure only."]),
      ...(aggregateCandidates.length === 0 ? ["No aggregate candidates were observed; review whether aggregates should be declared explicitly."] : [])
    ]
  );

  const diagnostics = unique(
    [
      ...(docsBundle
        ? [
            ...docsBundle.glossary.diagnostics,
            ...docsBundle.rules.diagnostics,
            ...docsBundle.invariants.diagnostics
          ]
        : []),
      `Scaffolded ${contextCandidates.length} context candidate(s).`,
      `Scaffolded ${aggregateCandidates.length} aggregate candidate(s).`
    ].filter((entry) => entry.length > 0)
  );

  return {
    result,
    confidence,
    evidence: mergeEvidence([
      ...contextCandidates.map((entry) => entry.candidate),
      ...aggregateCandidates
    ]),
    unknowns,
    diagnostics
  };
}

export async function scaffoldArchitectureConstraints(options: {
  repoRoot: string;
}): Promise<ScaffoldComputation<ArchitectureConstraintsScaffoldResult>> {
  const codebase = await parseCodebase(options.repoRoot);
  const grouped = groupSourceFiles(codebase);
  if (grouped.length === 0) {
    throw new Error("No scorable source files were found to scaffold architecture constraints.");
  }

  const orderedGroups = inferLayerOrder(codebase, grouped);
  const constraints = buildArchitectureConstraints(orderedGroups);
  const balances = new Map<string, number>();
  const fileToGroup = new Map<string, string>();
  for (const group of orderedGroups) {
    for (const filePath of group.files) {
      fileToGroup.set(filePath, group.key);
    }
    balances.set(group.key, 0);
  }
  for (const dependency of codebase.dependencies) {
    if (dependency.targetKind !== "file") {
      continue;
    }
    const sourceGroup = fileToGroup.get(dependency.source);
    const targetGroup = fileToGroup.get(dependency.target);
    if (!sourceGroup || !targetGroup || sourceGroup === targetGroup) {
      continue;
    }
    balances.set(sourceGroup, (balances.get(sourceGroup) ?? 0) + 1);
    balances.set(targetGroup, (balances.get(targetGroup) ?? 0) - 1);
  }

  const layers: ArchitectureLayerCandidate[] = orderedGroups.map((group, index) => {
    const candidate = buildLayerCandidate(group, balances.get(group.key) ?? 0);
    return {
      ...candidate,
      definition: {
        ...candidate.definition,
        name: constraints.layers[index]?.name ?? candidate.definition.name,
        rank: index,
        globs: constraints.layers[index]?.globs ?? candidate.definition.globs
      }
    };
  });

  const result: ArchitectureConstraintsScaffoldResult = {
    constraints,
    yaml: YAML.stringify(constraints),
    layers
  };

  const confidence = clampConfidence(
    layers.reduce((sum, layer) => sum + layer.confidence, 0) / Math.max(1, layers.length)
  );

  return {
    result,
    confidence,
    evidence: mergeEvidence(layers),
    unknowns: mergeUnknowns(layers, [
      "Complexity metadata is not scaffolded by default; add it explicitly when stable observations are available."
    ]),
    diagnostics: [`Scaffolded ${layers.length} layer candidate(s).`]
  };
}
