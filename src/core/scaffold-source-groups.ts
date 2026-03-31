import path from "node:path";

import { classifySubgroup, findSourceRootIndex, inferGroupOrigin } from "./scaffold-source-group-classification.js";
import { mergeMonorepoEquivalentGroups } from "./scaffold-source-group-merge.js";
import { normalizeSegmentKey } from "./scaffold-source-group-naming.js";
import type { CodebaseAnalysis, SourceGroup } from "./scaffold-types.js";

export { LAYER_PRIORITY_HINTS } from "./scaffold-source-group-constants.js";
export { inferGroupDisplayName, inferGroupNames } from "./scaffold-source-group-naming.js";

export function groupSourceFiles(codebase: CodebaseAnalysis): SourceGroup[] {
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
    let heuristicSplit = false;
    let origins: string[] = [];
    let pathGlobs: string[] = [filePath];

    const sourceRootIndex = findSourceRootIndex(parts);
    if (sourceRootIndex >= 0) {
      const rootName = parts[sourceRootIndex];
      if (!rootName) {
        continue;
      }
      sourceRoot = rootName;
      const prefix = parts.slice(0, sourceRootIndex).join("/");
      const segmentName = parts[sourceRootIndex + 1];
      basePath = prefix ? `${prefix}/${sourceRoot}` : sourceRoot;
      if (segmentName && !path.extname(segmentName)) {
        segment = segmentName;
        basePath = `${basePath}/${segment}`;
        key = basePath;
        pathGlobs = [`${basePath}/**`];
      } else {
        key = `${basePath}/__root__`;
      }
    } else if (parts.length >= 2) {
      const segmentName = parts[0];
      if (!segmentName) {
        continue;
      }
      segment = segmentName;
      basePath = segment;
      key = segment;
      pathGlobs = [`${basePath}/**`];
    }

    const classifiedSegment = classifySubgroup(segment, filePath, basePath);
    if (classifiedSegment) {
      key = `__heuristic__/${normalizeSegmentKey(classifiedSegment)}`;
      segment = classifiedSegment;
      heuristicSplit = true;
      origins = [inferGroupOrigin(basePath, sourceRoot, filePath)];
      basePath = origins[0] ?? "";
      pathGlobs = [filePath];
    }

    const group = groups.get(key) ?? {
      key,
      basePath,
      ...(sourceRoot ? { sourceRoot } : {}),
      ...(segment ? { segment } : {}),
      ...(heuristicSplit ? { heuristicSplit: true } : {}),
      ...(origins.length > 0 ? { origins } : {}),
      pathGlobs,
      files: [],
    };
    group.files.push(filePath);
    if (heuristicSplit) {
      group.heuristicSplit = true;
      for (const origin of origins) {
        if (!(group.origins ?? []).includes(origin)) {
          group.origins = [...(group.origins ?? []), origin];
        }
      }
    }
    for (const glob of pathGlobs) {
      if (!group.pathGlobs.includes(glob)) {
        group.pathGlobs.push(glob);
      }
    }
    groups.set(key, group);
  }

  return mergeMonorepoEquivalentGroups(Array.from(groups.values()))
    .map((group) => ({ ...group, files: group.files.sort(), pathGlobs: group.pathGlobs.sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function collectMarkerGlobs(group: SourceGroup, markers: Set<string>): string[] {
  const globs = new Set<string>();
  const markerFiles = new Set<string>();

  for (const filePath of group.files) {
    const matchingOrigin =
      group.origins
        ?.slice()
        .sort((left, right) => right.length - left.length)
        .find((origin) => filePath.startsWith(`${origin}/`)) ?? group.basePath;
    const relative =
      matchingOrigin && filePath.startsWith(`${matchingOrigin}/`)
        ? filePath.slice(matchingOrigin.length + 1)
        : group.basePath && filePath.startsWith(`${group.basePath}/`)
          ? filePath.slice(group.basePath.length + 1)
          : filePath;
    const relativeParts = relative.split("/");
    for (const segment of relativeParts.slice(0, -1)) {
      if (markers.has(segment.toLowerCase())) {
        if (matchingOrigin) {
          globs.add(`${matchingOrigin}/${segment}/**`);
        } else if (group.basePath) {
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
