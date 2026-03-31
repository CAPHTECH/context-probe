import type { parseCodebase } from "../analyzers/code.js";
import type { ContextDefinition, DomainContextCandidate } from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import { type DocsContextNamingInput, inferDocsDrivenContextName } from "./scaffold-domain-context-naming.js";
import type { GlossaryExtractionResult } from "./scaffold-domain-docs.js";
import {
  CONTRACT_MARKERS,
  collectMarkerGlobs,
  groupSourceFiles,
  INTERNAL_MARKERS,
  inferGroupNames,
  normalizeName,
  type SourceGroup,
} from "./scaffold-shared.js";

type ParsedCodebase = Awaited<ReturnType<typeof parseCodebase>>;

export interface ContextCandidateEntry {
  group: SourceGroup;
  candidate: DomainContextCandidate;
}

const NAME_AFFINITY_STOPWORDS = new Set(["and", "or", "the", "of"]);

function tokenizePascalLikeName(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/u)
    .map((segment) => normalizeName(segment))
    .filter((segment) => segment.length > 0 && !NAME_AFFINITY_STOPWORDS.has(segment));
}

function scoreNameAffinity(candidateName: string, fallbackName: string): number {
  const candidateTokens = new Set(tokenizePascalLikeName(candidateName));
  const fallbackTokens = tokenizePascalLikeName(fallbackName);
  return fallbackTokens.filter((token) => candidateTokens.has(token)).length;
}

function mergeSourceGroups(key: string, groups: SourceGroup[]): SourceGroup {
  const sourceRoots = Array.from(
    new Set(groups.map((group) => group.sourceRoot).filter((value) => value !== undefined)),
  );
  const segments = Array.from(new Set(groups.map((group) => group.segment).filter((value) => value !== undefined)));
  const origins = Array.from(
    new Set(
      groups.flatMap((group) =>
        group.origins && group.origins.length > 0 ? group.origins : group.basePath ? [group.basePath] : [],
      ),
    ),
  ).sort();
  const files = Array.from(new Set(groups.flatMap((group) => group.files))).sort();
  const pathGlobs = Array.from(new Set(groups.flatMap((group) => group.pathGlobs))).sort();

  return {
    key,
    basePath: origins[0] ?? "",
    ...(sourceRoots.length === 1 ? { sourceRoot: sourceRoots[0] } : {}),
    ...(segments.length === 1 ? { segment: segments[0] } : {}),
    heuristicSplit: true,
    ...(origins.length > 0 ? { origins } : {}),
    pathGlobs,
    files,
  };
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
  const pathGlobs = group.pathGlobs;
  const contractGlobs = collectMarkerGlobs(group, CONTRACT_MARKERS);
  const internalGlobs = collectMarkerGlobs(group, INTERNAL_MARKERS);
  const docsMentions = countContextMentions(name, fragments);
  const confidence = clampConfidence(
    0.55 +
      (group.heuristicSplit ? 0.08 : group.segment ? 0.12 : 0.05) +
      (group.files.length >= 2 ? 0.08 : 0) +
      (contractGlobs.length > 0 ? 0.08 : 0) +
      (internalGlobs.length > 0 ? 0.08 : 0) +
      (docsMentions > 0 ? 0.08 : 0),
  );
  const groupScope =
    group.heuristicSplit && (group.origins?.length ?? 0) > 1
      ? `${group.origins?.length ?? 0} source buckets`
      : group.basePath || "repository root";

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
        `${name} was inferred from ${group.files.length} source file(s) under ${groupScope}.`,
        {
          group: group.basePath || ".",
          ...(group.origins && group.origins.length > 0 ? { origins: group.origins } : {}),
          files: group.files.slice(0, 5),
          pathGlobs,
        },
        undefined,
        confidence,
      ),
    ],
    unknowns: group.heuristicSplit
      ? ["This context was split from a broad infrastructure bucket by heuristic and should be reviewed."]
      : group.segment
        ? []
        : ["Root-level source files were grouped into a single context by heuristic."],
  };
}

export function buildContextCandidates(
  codebase: ParsedCodebase,
  docsInput: DocsContextNamingInput | undefined,
): ContextCandidateEntry[] {
  const groups = groupSourceFiles(codebase);
  if (groups.length === 0) {
    throw new Error("No scorable source files were found to scaffold a domain model.");
  }

  const fallbackNames = inferGroupNames(groups);
  const proposedNames = groups.map((group, index) =>
    inferDocsDrivenContextName(group, fallbackNames[index] ?? "Context", docsInput),
  );
  const proposedNameOwners = new Map<string, number[]>();
  for (const [index, proposedName] of proposedNames.entries()) {
    if (!proposedName) {
      continue;
    }
    proposedNameOwners.set(proposedName, [...(proposedNameOwners.get(proposedName) ?? []), index]);
  }
  const acceptedDocsDrivenIndexes = new Set<number>();
  for (const [proposedName, ownerIndexes] of proposedNameOwners.entries()) {
    if (ownerIndexes.length === 1) {
      const onlyOwnerIndex = ownerIndexes[0];
      if (onlyOwnerIndex !== undefined) {
        acceptedDocsDrivenIndexes.add(onlyOwnerIndex);
      }
      continue;
    }

    const rankedOwners = ownerIndexes
      .map((index) => ({
        index,
        affinity: scoreNameAffinity(proposedName, fallbackNames[index] ?? "Context"),
      }))
      .sort((left, right) => right.affinity - left.affinity || left.index - right.index);
    const best = rankedOwners[0];
    const next = rankedOwners[1];
    if (!best || best.affinity === 0 || (next && next.affinity === best.affinity)) {
      continue;
    }
    acceptedDocsDrivenIndexes.add(best.index);
  }

  const consumedIndexes = new Set<number>();
  const mergedEntries: Array<{ group: SourceGroup; name: string; order: number }> = [];

  for (const [proposedName, ownerIndexes] of proposedNameOwners.entries()) {
    const mergeableOwners = ownerIndexes.filter(
      (index) => scoreNameAffinity(proposedName, fallbackNames[index] ?? "Context") > 0,
    );
    if (mergeableOwners.length < 2) {
      continue;
    }
    for (const index of mergeableOwners) {
      consumedIndexes.add(index);
    }
    const mergeGroups = mergeableOwners
      .map((index) => groups[index])
      .filter((group): group is SourceGroup => group !== undefined);
    mergedEntries.push({
      group: mergeSourceGroups(`__docs__/${normalizeName(proposedName)}`, mergeGroups),
      name: proposedName,
      order: Math.min(...mergeableOwners),
    });
  }

  const entries = groups
    .map((group, index) => ({
      order: index,
      group,
      name:
        proposedNames[index] && acceptedDocsDrivenIndexes.has(index)
          ? proposedNames[index]
          : (fallbackNames[index] ?? "Context"),
    }))
    .filter((entry) => !consumedIndexes.has(entry.order))
    .concat(mergedEntries)
    .sort((left, right) => left.order - right.order);

  return entries.map((entry) => ({
    group: entry.group,
    candidate: buildContextCandidate(entry.group, entry.name, docsInput?.fragments),
  }));
}
