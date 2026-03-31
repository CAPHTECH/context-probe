import { inferGroupDisplayName, normalizeSegmentKey } from "./scaffold-source-group-naming.js";
import type { SourceGroup } from "./scaffold-types.js";

export function mergeSourceGroups(
  key: string,
  groups: SourceGroup[],
  options?: { forceHeuristicSplit?: boolean },
): SourceGroup {
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
    basePath: origins[0] ?? groups[0]?.basePath ?? "",
    ...(sourceRoots.length === 1 ? { sourceRoot: sourceRoots[0] } : {}),
    ...(segments.length === 1 ? { segment: segments[0] } : {}),
    heuristicSplit:
      Boolean(options?.forceHeuristicSplit) || groups.some((group) => group.heuristicSplit) || origins.length > 1,
    ...(origins.length > 0 ? { origins } : {}),
    pathGlobs,
    files,
  };
}

function shouldMergeMonorepoGroup(group: SourceGroup): boolean {
  if (group.basePath.startsWith("packages/") || group.basePath.startsWith("apps/")) {
    return true;
  }
  return Boolean(group.sourceRoot) || (group.origins?.length ?? 0) > 1;
}

export function mergeMonorepoEquivalentGroups(groups: SourceGroup[]): SourceGroup[] {
  const mergeableByDisplayName = new Map<string, SourceGroup[]>();
  const passthrough: SourceGroup[] = [];

  for (const group of groups) {
    if (!shouldMergeMonorepoGroup(group)) {
      passthrough.push(group);
      continue;
    }
    const displayName = inferGroupDisplayName(group);
    const normalizedDisplayName = normalizeSegmentKey(displayName);
    mergeableByDisplayName.set(normalizedDisplayName, [
      ...(mergeableByDisplayName.get(normalizedDisplayName) ?? []),
      group,
    ]);
  }

  const merged = Array.from(mergeableByDisplayName.entries()).map(([normalizedDisplayName, matchingGroups]) => {
    if (matchingGroups.length < 2) {
      return matchingGroups[0];
    }
    const firstGroup = matchingGroups[0];
    if (!firstGroup) {
      return matchingGroups[0];
    }
    const preferredSegment = inferGroupDisplayName(firstGroup);
    const mergedGroup = mergeSourceGroups(`__merged__/${normalizedDisplayName}`, matchingGroups);
    return {
      ...mergedGroup,
      ...(matchingGroups.some((group) => group.segment) ? { segment: preferredSegment } : {}),
    };
  });

  return [...passthrough, ...merged.filter((group): group is SourceGroup => group !== undefined)];
}
