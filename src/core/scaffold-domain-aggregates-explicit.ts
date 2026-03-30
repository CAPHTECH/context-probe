import type { DomainAggregateCandidate } from "./contracts.js";
import { clampConfidence, toEvidence } from "./response.js";
import { normalizeName, sanitizeAggregateAliases, toPascalCase } from "./scaffold-domain-aggregates-shared.js";
import type { ContextCandidateEntry } from "./scaffold-domain-contexts.js";
import type { GlossaryExtractionResult } from "./scaffold-domain-docs.js";

function countContextMentions(name: string, fragments: GlossaryExtractionResult["fragments"] | undefined): number {
  if (!fragments) {
    return 0;
  }
  const normalizedName = normalizeName(name);
  return fragments.filter((fragment) => normalizeName(fragment.text).includes(normalizedName)).length;
}

export function createExplicitAggregateCandidates(
  contextCandidates: ContextCandidateEntry[],
  fragments: GlossaryExtractionResult["fragments"] | undefined,
): DomainAggregateCandidate[] {
  const aggregateCandidates: DomainAggregateCandidate[] = [];

  for (const entry of contextCandidates) {
    const aggregateFiles = entry.group.files.filter((filePath) => filePath.toLowerCase().includes("aggregate"));
    for (const filePath of aggregateFiles) {
      const fileName = filePath.split("/").pop() ?? filePath;
      const rawName = toPascalCase(fileName);
      const name = rawName === "Aggregate" ? `${entry.candidate.definition.name}Aggregate` : rawName;
      const withoutSuffix = name.replace(/Aggregate$/u, "");
      const aliases = sanitizeAggregateAliases(name, [withoutSuffix, entry.candidate.definition.name]);
      const mentionCount = countContextMentions(name, fragments) + countContextMentions(withoutSuffix, fragments);
      const confidence = clampConfidence(0.8 + (mentionCount > 0 ? 0.08 : 0));

      aggregateCandidates.push({
        definition: {
          name,
          context: entry.candidate.definition.name,
          ...(aliases.length > 0 ? { aliases } : {}),
        },
        confidence,
        evidence: [
          toEvidence(
            `${name} was inferred from ${filePath}.`,
            {
              context: entry.candidate.definition.name,
              path: filePath,
            },
            undefined,
            confidence,
          ),
        ],
        unknowns: [],
      });
    }
  }

  return aggregateCandidates;
}
