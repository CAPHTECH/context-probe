import type { ContextDefinition, DomainContextCandidate } from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import type { GlossaryExtractionResult } from "./scaffold-domain-docs.js";
import { normalizeName } from "./scaffold-naming.js";
import { CONTRACT_MARKERS, INTERNAL_MARKERS } from "./scaffold-source-group-constants.js";
import { collectMarkerGlobs } from "./scaffold-source-groups.js";
import type { SourceGroup } from "./scaffold-types.js";

const NAME_AFFINITY_STOPWORDS = new Set(["and", "or", "the", "of"]);

function tokenizePascalLikeName(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/u)
    .map((segment) => normalizeName(segment))
    .filter((segment) => segment.length > 0 && !NAME_AFFINITY_STOPWORDS.has(segment));
}

function scoreNameAffinity(candidateName: string, fallbackName: string): number {
  const candidateTokens = new Set(tokenizePascalLikeName(candidateName));
  const fallbackTokens = tokenizePascalLikeName(fallbackName);
  return fallbackTokens.filter((token) => candidateTokens.has(token)).length;
}

export function scoreContextNameAffinity(candidateName: string, fallbackName: string): number {
  return scoreNameAffinity(candidateName, fallbackName);
}

function countContextMentions(name: string, fragments: GlossaryExtractionResult["fragments"] | undefined): number {
  if (!fragments) {
    return 0;
  }
  const normalizedName = normalizeName(name);
  return fragments.filter((fragment) => normalizeName(fragment.text).includes(normalizedName)).length;
}

export function buildContextCandidate(
  group: SourceGroup,
  name: string,
  fragments: GlossaryExtractionResult["fragments"] | undefined,
): DomainContextCandidate {
  const pathGlobs = group.pathGlobs;
  const contractGlobs = collectMarkerGlobs(group, CONTRACT_MARKERS);
  const internalGlobs = collectMarkerGlobs(group, INTERNAL_MARKERS);
  const docsMentions = countContextMentions(name, fragments);
  const confidence = clampConfidence(
    0.55 +
      (group.heuristicSplit ? 0.08 : group.segment ? 0.12 : 0.05) +
      (group.files.length >= 2 ? 0.08 : 0) +
      (contractGlobs.length > 0 ? 0.08 : 0) +
      (internalGlobs.length > 0 ? 0.08 : 0) +
      (docsMentions > 0 ? 0.08 : 0),
  );
  const groupScope =
    group.heuristicSplit && (group.origins?.length ?? 0) > 1
      ? `${group.origins?.length ?? 0} source buckets`
      : group.basePath || "repository root";

  const definition: ContextDefinition = {
    name,
    pathGlobs,
    ...(contractGlobs.length > 0 ? { contractGlobs } : {}),
    ...(internalGlobs.length > 0 ? { internalGlobs } : {}),
  };

  return {
    definition,
    confidence,
    evidence: [
      toEvidence(
        `${name} was inferred from ${group.files.length} source file(s) under ${groupScope}.`,
        {
          group: group.basePath || ".",
          ...(group.origins && group.origins.length > 0 ? { origins: group.origins } : {}),
          files: group.files.slice(0, 5),
          pathGlobs,
        },
        undefined,
        confidence,
      ),
    ],
    unknowns: group.heuristicSplit
      ? ["This context was split from a broad infrastructure bucket by heuristic and should be reviewed."]
      : group.segment
        ? []
        : ["Root-level source files were grouped into a single context by heuristic."],
  };
}
