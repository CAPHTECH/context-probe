import type { ArchitectureLayerCandidate } from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import { inferGroupDisplayName, LAYER_PRIORITY_HINTS, normalizeName, type SourceGroup } from "./scaffold-shared.js";

export function buildLayerCandidate(group: SourceGroup, balance: number): ArchitectureLayerCandidate {
  const name = inferGroupDisplayName(group);
  const globs = group.pathGlobs;
  const hintKey = normalizeName(group.segment ?? name).replace(/\s+/gu, "_");
  const confidence = clampConfidence(
    0.58 + (LAYER_PRIORITY_HINTS.has(hintKey) ? 0.18 : 0) + (group.files.length >= 2 ? 0.08 : 0),
  );
  const groupScope =
    group.heuristicSplit && (group.origins?.length ?? 0) > 1
      ? `${group.origins?.length ?? 0} source buckets`
      : group.basePath || ".";
  return {
    definition: {
      name,
      rank: 0,
      globs,
    },
    confidence,
    evidence: [
      toEvidence(
        `${name} was inferred from ${group.files.length} source file(s) under ${groupScope}.`,
        {
          group: group.basePath || ".",
          ...(group.origins && group.origins.length > 0 ? { origins: group.origins } : {}),
          outgoingMinusIncomingDependencies: balance,
          globs,
        },
        undefined,
        confidence,
      ),
    ],
    unknowns: group.heuristicSplit
      ? ["This layer was split from a broad infrastructure bucket by heuristic and should be reviewed."]
      : group.segment
        ? []
        : ["Root-level source files were grouped into a single layer by heuristic."],
  };
}
