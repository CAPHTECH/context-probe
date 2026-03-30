import type { ExtractionMetadata, Fragment } from "./contracts.js";
import type { ExtractionOptions } from "./document-extractor-types.js";
import { createEvidenceId } from "./response.js";

export function buildMetadata(options: ExtractionOptions): ExtractionMetadata {
  return {
    extractor: options.extractor ?? "heuristic",
    ...(options.provider ? { provider: options.provider } : {}),
    promptProfile: options.promptProfile ?? "default",
    fallback: options.fallback ?? "heuristic",
  };
}

export function createTermId(seed: string): string {
  return `TERM-${createEvidenceId(seed).replace("EV-", "")}`;
}

export function createRuleId(seed: string): string {
  return `RULE-${createEvidenceId(seed).replace("EV-", "")}`;
}

export function createInvariantId(seed: string): string {
  return `INV-${createEvidenceId(seed).replace("EV-", "")}`;
}

export function createEvidenceFromFragment(fragment: Fragment, statement: string, confidence: number) {
  return {
    evidenceId: createEvidenceId(`${fragment.fragmentId}:${statement}`),
    type: "document_fragment",
    statement,
    confidence,
    source: {
      artifactId: fragment.artifactId,
      fragmentId: fragment.fragmentId,
      path: fragment.path,
    },
  };
}

export function findFragmentsByIds(fragments: Fragment[], fragmentIds: string[]): Fragment[] {
  const fragmentMap = new Map(fragments.map((fragment) => [fragment.fragmentId, fragment]));
  return fragmentIds
    .map((fragmentId) => fragmentMap.get(fragmentId))
    .filter((fragment): fragment is Fragment => Boolean(fragment));
}
