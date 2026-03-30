import { normalizeDocuments } from "./artifacts.js";
import type { ExtractionKind, Fragment } from "./contracts.js";
import { buildMetadata } from "./document-extractor-shared.js";
import type { ExtractionOptions } from "./document-extractor-types.js";
import { runCliExtraction } from "./providers.js";

export async function extractWithProvider<T>(
  kind: ExtractionKind,
  fragments: Fragment[],
  options: ExtractionOptions,
  normalize: (rawItems: Record<string, unknown>[], fragments: Fragment[]) => T[],
) {
  if (!options.provider) {
    throw new Error("CLI extractor requires `provider`");
  }
  const providerResult = await runCliExtraction({
    cwd: options.cwd,
    provider: options.provider,
    kind,
    promptProfile: options.promptProfile ?? "default",
    fragments,
    ...(options.providerCommand ? { providerCommand: options.providerCommand } : {}),
  });

  return {
    fragments,
    items: normalize(providerResult.items, fragments),
    confidence: providerResult.confidence,
    unknowns: providerResult.unknowns,
    diagnostics: providerResult.diagnostics,
    provider: providerResult.provider,
  };
}

export async function normalizeExtractionOptions(options: ExtractionOptions) {
  return {
    metadata: buildMetadata(options),
    fragments: await normalizeDocuments(options.root),
    fallback: options.fallback ?? "heuristic",
  };
}
