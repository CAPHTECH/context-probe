import type { ArchitectureConstraints, ArchitectureLayerCandidate } from "./contracts.js";
import { buildLayerCandidate } from "./scaffold-architecture-layer-candidates.js";
import type { SourceGroup } from "./scaffold-shared.js";

export function buildArchitectureScaffoldLayers(
  orderedGroups: SourceGroup[],
  constraints: ArchitectureConstraints,
  balances: Map<string, number>,
): ArchitectureLayerCandidate[] {
  return orderedGroups.map((group, index) => {
    const candidate = buildLayerCandidate(group, balances.get(group.key) ?? 0);
    return {
      ...candidate,
      definition: {
        ...candidate.definition,
        name: constraints.layers[index]?.name ?? candidate.definition.name,
        rank: index,
        globs: constraints.layers[index]?.globs ?? candidate.definition.globs,
      },
    };
  });
}
