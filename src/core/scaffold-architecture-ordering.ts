import type { ArchitectureConstraints, CodebaseAnalysis, LayerDefinition } from "./contracts.js";
import {
  inferRootGroupName,
  LAYER_PRIORITY_HINTS,
  makeUniqueNames,
  normalizeName,
  type SourceGroup,
  toPascalCase,
} from "./scaffold-shared.js";

export function inferLayerOrder(codebase: CodebaseAnalysis, groups: SourceGroup[]): SourceGroup[] {
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
    const leftHint = LAYER_PRIORITY_HINTS.get(
      normalizeName(left.segment ?? inferRootGroupName(left)).replace(/\s+/gu, "_"),
    );
    const rightHint = LAYER_PRIORITY_HINTS.get(
      normalizeName(right.segment ?? inferRootGroupName(right)).replace(/\s+/gu, "_"),
    );
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

export function buildArchitectureConstraints(groups: SourceGroup[]): ArchitectureConstraints {
  const orderedNames = makeUniqueNames(
    groups.map((group) => (group.segment ? toPascalCase(group.segment) : inferRootGroupName(group))),
  );
  const layers: LayerDefinition[] = groups.map((group, index) => ({
    name: orderedNames[index] ?? `Layer${index + 1}`,
    rank: index,
    globs: group.segment ? [`${group.basePath}/**`] : group.files,
  }));
  return {
    version: "1.0",
    direction: "inward",
    layers,
  };
}
