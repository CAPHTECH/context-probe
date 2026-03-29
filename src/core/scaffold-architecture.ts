import YAML from "yaml";

import { parseCodebase } from "../analyzers/code.js";
import type {
  ArchitectureConstraints,
  ArchitectureConstraintsScaffoldResult,
  ArchitectureLayerCandidate,
  LayerDefinition,
} from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import {
  averageLayerConfidence,
  groupSourceFiles,
  inferRootGroupName,
  LAYER_PRIORITY_HINTS,
  makeUniqueNames,
  mergeEvidence,
  mergeUnknowns,
  normalizeName,
  type ScaffoldComputation,
  type SourceGroup,
  toPascalCase,
} from "./scaffold-shared.js";

function buildLayerCandidate(group: SourceGroup, balance: number): ArchitectureLayerCandidate {
  const name = group.segment ? toPascalCase(group.segment) : inferRootGroupName(group);
  const globs = group.segment ? [`${group.basePath}/**`] : group.files;
  const hintKey = normalizeName(group.segment ?? name).replace(/\s+/gu, "_");
  const confidence = clampConfidence(
    0.58 + (LAYER_PRIORITY_HINTS.has(hintKey) ? 0.18 : 0) + (group.files.length >= 2 ? 0.08 : 0),
  );
  return {
    definition: {
      name,
      rank: 0,
      globs,
    },
    confidence,
    evidence: [
      toEvidence(
        `${name} was inferred from ${group.files.length} source file(s).`,
        {
          group: group.basePath || ".",
          outgoingMinusIncomingDependencies: balance,
          globs,
        },
        undefined,
        confidence,
      ),
    ],
    unknowns: group.segment ? [] : ["Root-level source files were grouped into a single layer by heuristic."],
  };
}

function inferLayerOrder(codebase: Awaited<ReturnType<typeof parseCodebase>>, groups: SourceGroup[]): SourceGroup[] {
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

function buildArchitectureConstraints(groups: SourceGroup[]): ArchitectureConstraints {
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

  const layers: ArchitectureLayerCandidate[] = orderedGroups.map((group, index) => {
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
