import { makeUniqueNames, toPascalCase } from "./scaffold-naming.js";
import type { SourceGroup } from "./scaffold-types.js";

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

export function normalizeSegmentKey(value: string): string {
  return toPascalCase(value).toLowerCase();
}

function inferScaffoldName(value: string): string {
  return SEGMENT_NAME_HINTS.get(normalizeSegmentKey(value)) ?? toPascalCase(value);
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

export function inferGroupDisplayName(group: SourceGroup): string {
  return group.segment ? inferScaffoldName(group.segment) : inferRootGroupName(group);
}

export function inferGroupNames(groups: SourceGroup[]): string[] {
  return makeUniqueNames(groups.map((group) => inferGroupDisplayName(group)));
}
