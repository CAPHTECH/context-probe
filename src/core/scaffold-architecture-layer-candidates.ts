import type { ArchitectureLayerCandidate } from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import {
  inferRootGroupName,
  LAYER_PRIORITY_HINTS,
  normalizeName,
  type SourceGroup,
  toPascalCase,
} from "./scaffold-shared.js";

export function buildLayerCandidate(group: SourceGroup, balance: number): ArchitectureLayerCandidate {
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
