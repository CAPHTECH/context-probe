import type { ExtractionOptions } from "./scaffold-types.js";

export function createDefaultExtractionOptions(docsRoot: string, repoRoot: string): ExtractionOptions {
  return {
    root: docsRoot,
    cwd: repoRoot,
    extractor: "heuristic",
    promptProfile: "default",
    fallback: "heuristic",
    applyReviewLog: false,
  } as const;
}
