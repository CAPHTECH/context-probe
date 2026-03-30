import type { CodebaseAnalysis } from "./contracts.js";
import type { SourceGroup } from "./scaffold-shared.js";

export function buildArchitectureLayerBalances(codebase: CodebaseAnalysis, groups: SourceGroup[]): Map<string, number> {
  const fileToGroup = new Map<string, string>();
  for (const group of groups) {
    for (const filePath of group.files) {
      fileToGroup.set(filePath, group.key);
    }
  }

  const balances = new Map<string, number>();
  for (const group of groups) {
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

  return balances;
}
