import type { parseCodebase } from "../analyzers/code.js";
import type { ContextDefinition, DomainContextCandidate } from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import type { GlossaryExtractionResult } from "./scaffold-domain-docs.js";
import {
  CONTRACT_MARKERS,
  collectMarkerGlobs,
  groupSourceFiles,
  INTERNAL_MARKERS,
  inferGroupNames,
  normalizeName,
  type SourceGroup,
} from "./scaffold-shared.js";

type ParsedCodebase = Awaited<ReturnType<typeof parseCodebase>>;

export interface ContextCandidateEntry {
  group: SourceGroup;
  candidate: DomainContextCandidate;
}

function countContextMentions(name: string, fragments: GlossaryExtractionResult["fragments"] | undefined): number {
  if (!fragments) {
    return 0;
  }
  const normalizedName = normalizeName(name);
  return fragments.filter((fragment) => normalizeName(fragment.text).includes(normalizedName)).length;
}

function buildContextCandidate(
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
      (group.pathGlobs.length === 1 && group.pathGlobs[0] === group.files[0] ? 0.08 : group.segment ? 0.12 : 0.05) +
      (group.files.length >= 2 ? 0.08 : 0) +
      (contractGlobs.length > 0 ? 0.08 : 0) +
      (internalGlobs.length > 0 ? 0.08 : 0) +
      (docsMentions > 0 ? 0.08 : 0),
  );

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
        `${name} was inferred from ${group.files.length} source file(s) under ${group.basePath || "repository root"}.`,
        {
          group: group.basePath || ".",
          files: group.files.slice(0, 5),
          pathGlobs,
        },
        undefined,
        confidence,
      ),
    ],
    unknowns:
      group.pathGlobs.length === 1 && group.pathGlobs[0] === group.files[0]
        ? ["This context was split from a broad infrastructure bucket by heuristic and should be reviewed."]
        : group.segment
          ? []
          : ["Root-level source files were grouped into a single context by heuristic."],
  };
}

export function buildContextCandidates(
  codebase: ParsedCodebase,
  fragments: GlossaryExtractionResult["fragments"] | undefined,
): ContextCandidateEntry[] {
  const groups = groupSourceFiles(codebase);
  if (groups.length === 0) {
    throw new Error("No scorable source files were found to scaffold a domain model.");
  }

  const names = inferGroupNames(groups);
  return groups.map((group, index) => ({
    group,
    candidate: buildContextCandidate(group, names[index] ?? "Context", fragments),
  }));
}
