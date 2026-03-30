import YAML from "yaml";

import { parseCodebase } from "../analyzers/code.js";
import type { ArchitectureConstraintsScaffoldResult } from "./contracts.js";
import { clampConfidence } from "./response.js";
import { buildLayerCandidate } from "./scaffold-architecture-layer-candidates.js";
import { buildArchitectureConstraints, inferLayerOrder } from "./scaffold-architecture-ordering.js";
import {
  averageLayerConfidence,
  groupSourceFiles,
  mergeEvidence,
  mergeUnknowns,
  type ScaffoldComputation,
} from "./scaffold-shared.js";

export async function scaffoldArchitectureConstraints(options: {
  repoRoot: string;
}): Promise<ScaffoldComputation<ArchitectureConstraintsScaffoldResult>> {
  const codebase = await parseCodebase(options.repoRoot);
  const grouped = groupSourceFiles(codebase);
  if (grouped.length === 0) {
    throw new Error("No scorable source files were found to scaffold architecture constraints.");
  }

  const orderedGroups = inferLayerOrder(codebase, grouped);
  const constraints = buildArchitectureConstraints(orderedGroups);
  const balances = new Map<string, number>();
  const fileToGroup = new Map<string, string>();
  for (const group of orderedGroups) {
    for (const filePath of group.files) {
      fileToGroup.set(filePath, group.key);
    }
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

  const layers = orderedGroups.map((group, index) => {
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

  const result: ArchitectureConstraintsScaffoldResult = {
    constraints,
    yaml: YAML.stringify(constraints),
    layers,
  };

  const confidence = clampConfidence(averageLayerConfidence(layers));

  return {
    result,
    confidence,
    evidence: mergeEvidence(layers),
    unknowns: mergeUnknowns(layers, [
      "Complexity metadata is not scaffolded by default; add it explicitly when stable observations are available.",
    ]),
    diagnostics: [`Scaffolded ${layers.length} layer candidate(s).`],
  };
}
