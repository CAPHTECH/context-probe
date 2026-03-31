import path from "node:path";
import { makeUniqueNames, toPascalCase } from "./scaffold-naming.js";
import type { CodebaseAnalysis, SourceGroup } from "./scaffold-types.js";

const SOURCE_ROOTS = new Set(["src", "lib", "app"]);
const SEGMENT_NAME_HINTS = new Map<string, string>([
  ["app", "App"],
  ["api", "API"],
  ["bootstrap", "Bootstrap"],
  ["cli", "CLI"],
  ["ci", "CI"],
  ["contracts", "Contracts"],
  ["contract", "Contracts"],
  ["core", "Core"],
  ["data", "Data"],
  ["delivery", "Delivery"],
  ["domain", "Domain"],
  ["evaluation", "Evaluation"],
  ["extractor", "Extractors"],
  ["extractors", "Extractors"],
  ["infra", "Infrastructure"],
  ["infrastructure", "Infrastructure"],
  ["interfaces", "Interfaces"],
  ["interface", "Interfaces"],
  ["kernel", "Kernel"],
  ["lib", "Library"],
  ["llm", "LLM"],
  ["mcp", "MCP"],
  ["model", "Model"],
  ["presentation", "Presentation"],
  ["project", "Project"],
  ["quality", "Quality"],
  ["qa", "QA"],
  ["runtime", "Runtime"],
  ["scripts", "Scripts"],
  ["server", "Server"],
  ["service", "Services"],
  ["services", "Services"],
  ["tests", "Tests"],
  ["test", "Tests"],
  ["tools", "Tools"],
  ["tooling", "Tools"],
  ["ui", "UI"],
  ["usecase", "UseCases"],
  ["usecases", "UseCases"],
  ["use_case", "UseCases"],
  ["use_cases", "UseCases"],
  ["workspace", "Workspace"],
]);

export const CONTRACT_MARKERS = new Set(["contract", "contracts", "api", "schema", "schemas", "dto", "dtos"]);
export const LAYER_PRIORITY_HINTS = new Map<string, number>([
  ["domain", 0],
  ["core", 0],
  ["foundation", 0],
  ["model", 0],
  ["kernel", 0],
  ["contracts", 0],
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
  ["extractor", 2],
  ["extractors", 2],
  ["ingestandextraction", 2],
  ["interface", 2],
  ["interfaces", 2],
  ["delivery", 2],
  ["presentation", 2],
  ["ui", 2],
  ["api", 2],
  ["transport", 2],
  ["server", 2],
  ["mcp", 2],
  ["infra", 3],
  ["infrastructure", 3],
  ["persistence", 3],
  ["platform", 3],
  ["runtime", 3],
  ["runtimeinfrastructure", 3],
  ["project", 4],
  ["workspace", 4],
  ["bootstrap", 4],
  ["workspacebootstrap", 4],
  ["evaluation", 5],
  ["quality", 5],
  ["evaluationquality", 5],
  ["tooling", 6],
  ["tools", 6],
  ["scripts", 6],
  ["test", 7],
  ["tests", 7],
]);
export const INTERNAL_MARKERS = new Set(["internal", "impl", "private", "_internal"]);
const SUBGROUPABLE_SEGMENTS = new Set([
  "adapters",
  "adapter",
  "services",
  "service",
  "server",
  "project",
  "bootstrap",
  "evaluation",
  "quality",
  "mcp",
  "interfaces",
  "interface",
]);
const EXTRACTION_MARKERS = [
  "extract",
  "extractor",
  "ingest",
  "import",
  "loader",
  "load",
  "parser",
  "parse",
  "sync",
  "crawl",
  "scrape",
  "git",
];
const RUNTIME_MARKERS = [
  "runtime",
  "server",
  "http",
  "router",
  "endpoint",
  "socket",
  "mcp",
  "duckdb",
  "sqlite",
  "postgres",
  "mysql",
  "redis",
  "cache",
  "queue",
  "store",
  "storage",
  "search",
  "index",
  "vector",
  "embed",
  "embedding",
  "neo4j",
  "graph",
  "query",
];
const WORKSPACE_MARKERS = ["workspace", "project", "bootstrap", "registry", "config", "env", "setup"];
const EVALUATION_MARKERS = ["evaluation", "quality", "benchmark", "review", "telemetry", "metric", "score", "eval"];

function normalizeSegmentKey(value: string): string {
  return toPascalCase(value).toLowerCase();
}

function inferScaffoldName(value: string): string {
  return SEGMENT_NAME_HINTS.get(normalizeSegmentKey(value)) ?? toPascalCase(value);
}

export function inferGroupDisplayName(group: SourceGroup): string {
  return group.segment ? inferScaffoldName(group.segment) : inferRootGroupName(group);
}

function findSourceRootIndex(parts: string[]): number {
  return parts.findIndex((part) => SOURCE_ROOTS.has(part ?? ""));
}

function classifySubgroup(segment: string | undefined, filePath: string, basePath: string): string | undefined {
  if (!segment || !SUBGROUPABLE_SEGMENTS.has(segment.toLowerCase())) {
    return undefined;
  }

  const relative =
    basePath && filePath.startsWith(`${basePath}/`) ? filePath.slice(basePath.length + 1) : path.basename(filePath);
  const normalized = relative.toLowerCase();

  if (EXTRACTION_MARKERS.some((marker) => normalized.includes(marker))) {
    return "IngestAndExtraction";
  }
  if (WORKSPACE_MARKERS.some((marker) => normalized.includes(marker))) {
    return "WorkspaceBootstrap";
  }
  if (EVALUATION_MARKERS.some((marker) => normalized.includes(marker))) {
    return "EvaluationQuality";
  }
  if (RUNTIME_MARKERS.some((marker) => normalized.includes(marker))) {
    return "RuntimeInfrastructure";
  }
  return undefined;
}

function inferGroupOrigin(basePath: string, sourceRoot: string | undefined, filePath: string): string {
  if (basePath) {
    return basePath;
  }
  if (sourceRoot) {
    return sourceRoot;
  }
  const parts = filePath.split("/");
  return parts.length > 1 ? (parts[0] ?? ".") : ".";
}

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
      if (segmentName) {
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

  return Array.from(groups.values())
    .map((group) => ({ ...group, files: group.files.sort(), pathGlobs: group.pathGlobs.sort() }))
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

export function inferGroupNames(groups: SourceGroup[]): string[] {
  return makeUniqueNames(groups.map((group) => inferGroupDisplayName(group)));
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
