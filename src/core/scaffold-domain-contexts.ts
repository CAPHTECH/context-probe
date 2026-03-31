import type { parseCodebase } from "../analyzers/code.js";
import type { DomainContextCandidate } from "./contracts.js";
import { buildContextCandidate, scoreContextNameAffinity } from "./scaffold-domain-context-candidates.js";
import { type DocsContextNamingInput, inferDocsDrivenContextName } from "./scaffold-domain-context-naming.js";
import { groupSourceFiles, inferGroupNames, type SourceGroup } from "./scaffold-shared.js";
import { mergeSourceGroups } from "./scaffold-source-group-merge.js";

type ParsedCodebase = Awaited<ReturnType<typeof parseCodebase>>;

export interface ContextCandidateEntry {
  group: SourceGroup;
  candidate: DomainContextCandidate;
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
        affinity: scoreContextNameAffinity(proposedName, fallbackNames[index] ?? "Context"),
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
      (index) => scoreContextNameAffinity(proposedName, fallbackNames[index] ?? "Context") > 0,
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
      group: mergeSourceGroups(`__docs__/${proposedName}`, mergeGroups, { forceHeuristicSplit: true }),
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
