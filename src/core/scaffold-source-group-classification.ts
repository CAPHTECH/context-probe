import path from "node:path";

const SOURCE_ROOTS = new Set(["src", "lib", "app"]);
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

export function findSourceRootIndex(parts: string[]): number {
  return parts.findIndex((part) => SOURCE_ROOTS.has(part ?? ""));
}

export function classifySubgroup(segment: string | undefined, filePath: string, basePath: string): string | undefined {
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

export function inferGroupOrigin(basePath: string, sourceRoot: string | undefined, filePath: string): string {
  if (basePath) {
    return basePath;
  }
  if (sourceRoot) {
    return sourceRoot;
  }
  const parts = filePath.split("/");
  return parts.length > 1 ? (parts[0] ?? ".") : ".";
}
