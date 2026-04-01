import path from "node:path";
import { normalizeDocuments } from "./artifacts.js";
import type { DomainModel, GlossaryTerm, ModelCodeLink, TermTraceLink, TraceLinkOccurrence } from "./contracts.js";
import { isSourceFile, listFiles, matchGlobs, readText, relativePath } from "./io.js";

function countOccurrences(text: string, query: string): number {
  if (!query) {
    return 0;
  }
  return text.toLowerCase().split(query.toLowerCase()).length - 1;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m${remainingSeconds.toString().padStart(2, "0")}s`;
}

export async function buildTermTraceLinks(options: {
  docsRoot: string;
  repoRoot?: string;
  terms: GlossaryTerm[];
  codeFiles?: string[];
  onProgress?: (update: { phase: "start" | "heartbeat" | "complete"; message: string; elapsedMs?: number }) => void;
  progressIntervalMs?: number;
}): Promise<TermTraceLink[]> {
  const startedAt = Date.now();
  const fragments = await normalizeDocuments(options.docsRoot);
  const codeFiles = options.repoRoot
    ? (options.codeFiles ?? (await listFiles(options.repoRoot)).filter((filePath) => isSourceFile(filePath)))
    : [];
  const progressIntervalMs = options.progressIntervalMs ?? 5000;
  let lastProgressAt = startedAt;

  options.onProgress?.({
    phase: "start",
    message: `Preparing trace links for ${options.terms.length} term(s) across ${codeFiles.length} code file(s).`,
  });

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
          : await readText(filePath),
    })),
  );

  const links = options.terms.map((term, index) => {
    const queries = Array.from(new Set([term.canonicalTerm, ...(term.aliases ?? [])].filter(Boolean)));
    if (Date.now() - lastProgressAt >= progressIntervalMs) {
      lastProgressAt = Date.now();
      const processedTerms = Math.max(index, 1);
      const elapsedMs = lastProgressAt - startedAt;
      const termsPerSecond = processedTerms / Math.max(elapsedMs / 1000, 0.001);
      const remainingTerms = Math.max(options.terms.length - index, 0);
      const etaMs = remainingTerms > 0 ? Math.round((remainingTerms / termsPerSecond) * 1000) : 0;
      options.onProgress?.({
        phase: "heartbeat",
        message: `Trace linking is still running: processed ${index}/${options.terms.length} term(s) at ${termsPerSecond.toFixed(1)} term(s)/s, ETA ${formatDuration(etaMs)}.`,
        elapsedMs,
      });
    }
    const occurrences: TraceLinkOccurrence[] = [];
    for (const fragment of fragments) {
      const matchCount = queries.reduce((sum, query) => sum + countOccurrences(fragment.text, query), 0);
      if (matchCount > 0 || term.fragmentIds.includes(fragment.fragmentId)) {
        occurrences.push({
          kind: "document",
          path: fragment.path,
          fragmentId: fragment.fragmentId,
          matchCount: Math.max(matchCount, term.fragmentIds.includes(fragment.fragmentId) ? 1 : 0),
        });
      }
    }
    for (const codeFile of codeContents) {
      const matchCount = queries.reduce((sum, query) => sum + countOccurrences(codeFile.content, query), 0);
      if (matchCount > 0) {
        occurrences.push({
          kind: "code",
          path: codeFile.path,
          matchCount,
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
        codeHits,
      },
      confidence: Math.min(1, term.confidence * (documentHits + codeHits > 0 ? 1 : 0.7)),
    };
  });

  options.onProgress?.({
    phase: "complete",
    message: `Trace linking completed for ${options.terms.length} term(s) across ${codeFiles.length} code file(s).`,
    elapsedMs: Date.now() - startedAt,
  });

  return links;
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
        unclassified,
      },
      coverage: files.length === 0 ? 0 : (contract + internal) / files.length,
    };
  });
}
