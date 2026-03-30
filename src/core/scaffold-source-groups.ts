import path from "node:path";
import { makeUniqueNames, toPascalCase } from "./scaffold-naming.js";
import type { CodebaseAnalysis, SourceGroup } from "./scaffold-types.js";

const SOURCE_ROOTS = new Set(["src", "lib", "app"]);

export const AGGREGATE_FILE_PATTERN = /aggregate/i;
export const CONTRACT_MARKERS = new Set(["contract", "contracts", "api", "schema", "schemas", "dto", "dtos"]);
export const LAYER_PRIORITY_HINTS = new Map<string, number>([
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
  ["platform", 3],
]);
export const INTERNAL_MARKERS = new Set(["internal", "impl", "private", "_internal"]);
export const STOPWORD_AGGREGATE_TERMS = [/context$/i, /contract$/i, /service$/i, /handler$/i, /controller$/i];

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
      files: [],
    };
    group.files.push(filePath);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, files: group.files.sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function inferRootGroupName(group: SourceGroup): string {
  if (group.sourceRoot === "src" || group.sourceRoot === "app") {
    return "Application";
  }
  if (group.sourceRoot === "lib") {
    return "Library";
  }
  return "Root";
}

export function inferGroupNames(groups: SourceGroup[]): string[] {
  return makeUniqueNames(
    groups.map((group) => (group.segment ? toPascalCase(group.segment) : inferRootGroupName(group))),
  );
}

export function collectMarkerGlobs(group: SourceGroup, markers: Set<string>): string[] {
  const globs = new Set<string>();
  const markerFiles = new Set<string>();

  for (const filePath of group.files) {
    const relative =
      group.basePath && filePath.startsWith(`${group.basePath}/`)
        ? filePath.slice(group.basePath.length + 1)
        : filePath;
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
