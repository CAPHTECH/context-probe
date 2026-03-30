import YAML from "yaml";

import { parseCodebase } from "../analyzers/code.js";
import type { ArchitectureConstraintsScaffoldResult } from "./contracts.js";
import { clampConfidence } from "./response.js";
import { buildArchitectureLayerBalances } from "./scaffold-architecture-balances.js";
import { buildArchitectureScaffoldLayers } from "./scaffold-architecture-layers.js";
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
  const balances = buildArchitectureLayerBalances(codebase, orderedGroups);
  const layers = buildArchitectureScaffoldLayers(orderedGroups, constraints, balances);

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
