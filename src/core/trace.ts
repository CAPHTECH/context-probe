import path from "node:path";

import type {
  DomainModel,
  GlossaryTerm,
  ModelCodeLink,
  TermTraceLink,
  TraceLinkOccurrence
} from "./contracts.js";
import { normalizeDocuments } from "./artifacts.js";
import { listFiles, matchGlobs, readText, isSourceFile, relativePath } from "./io.js";

function countOccurrences(text: string, query: string): number {
  if (!query) {
    return 0;
  }
  return text.toLowerCase().split(query.toLowerCase()).length - 1;
}

export async function buildTermTraceLinks(options: {
  docsRoot: string;
  repoRoot?: string;
  terms: GlossaryTerm[];
  codeFiles?: string[];
}): Promise<TermTraceLink[]> {
  const fragments = await normalizeDocuments(options.docsRoot);
  const codeFiles = options.repoRoot
    ? options.codeFiles ?? (await listFiles(options.repoRoot)).filter((filePath) => isSourceFile(filePath))
    : [];

  const codeContents = await Promise.all(
    codeFiles.map(async (filePath) => ({
      path:
        options.repoRoot && path.isAbsolute(filePath)
          ? relativePath(options.repoRoot, filePath)
          : options.repoRoot
            ? filePath
            : filePath,
      content:
        options.repoRoot && !path.isAbsolute(filePath)
          ? await readText(path.join(options.repoRoot, filePath))
          : await readText(filePath)
    }))
  );

  return options.terms.map((term) => {
    const occurrences: TraceLinkOccurrence[] = [];
    for (const fragment of fragments) {
      const matchCount = countOccurrences(fragment.text, term.canonicalTerm);
      if (matchCount > 0 || term.fragmentIds.includes(fragment.fragmentId)) {
        occurrences.push({
          kind: "document",
          path: fragment.path,
          fragmentId: fragment.fragmentId,
          matchCount: Math.max(matchCount, term.fragmentIds.includes(fragment.fragmentId) ? 1 : 0)
        });
      }
    }
    for (const codeFile of codeContents) {
      const matchCount = countOccurrences(codeFile.content, term.canonicalTerm);
      if (matchCount > 0) {
        occurrences.push({
          kind: "code",
          path: codeFile.path,
          matchCount
        });
      }
    }
    const documentHits = occurrences.filter((occurrence) => occurrence.kind === "document").length;
    const codeHits = occurrences.filter((occurrence) => occurrence.kind === "code").length;
    return {
      termId: term.termId,
      canonicalTerm: term.canonicalTerm,
      occurrences,
      coverage: {
        documentHits,
        codeHits
      },
      confidence: Math.min(1, term.confidence * (documentHits + codeHits > 0 ? 1 : 0.7))
    };
  });
}

export function buildModelCodeLinks(model: DomainModel, filePaths: string[]): ModelCodeLink[] {
  return model.contexts.map((context) => {
    const files = filePaths.filter((filePath) => matchGlobs(filePath, context.pathGlobs));
    const contract = files.filter((filePath) => matchGlobs(filePath, context.contractGlobs)).length;
    const internal = files.filter((filePath) => matchGlobs(filePath, context.internalGlobs)).length;
    const unclassified = Math.max(0, files.length - contract - internal);
    return {
      context: context.name,
      files,
      counts: {
        contract,
        internal,
        unclassified
      },
      coverage: files.length === 0 ? 0 : (contract + internal) / files.length
    };
  });
}
