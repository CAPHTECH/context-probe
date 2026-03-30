import { clamp01 } from "./boundary-fitness-shared.js";
import type { Fragment } from "./contracts.js";
import { toEvidence } from "./response.js";

type AttractionSignal = {
  summary: string;
  contexts: string[];
  confidence: number;
  kind: string;
  fragmentIds?: string[];
  linkedEntities?: string[];
};

export function buildBoundaryFitnessEvidence(input: {
  localizedSignals: AttractionSignal[];
  ambiguousSignals: AttractionSignal[];
  separationFragments: Fragment[];
  fragmentContextMentions: Map<string, string[]>;
}): ReturnType<typeof toEvidence>[] {
  const evidence: ReturnType<typeof toEvidence>[] = [];

  for (const signal of input.localizedSignals.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${signal.summary.slice(0, 120)} is localized to ${signal.contexts[0]}`,
        {
          kind: signal.kind,
          contexts: signal.contexts,
          fragmentIds: signal.fragmentIds ?? [],
        },
        signal.linkedEntities,
        clamp01(signal.confidence),
      ),
    );
  }

  for (const signal of input.ambiguousSignals.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${signal.summary.slice(0, 120)} spans ${signal.contexts.join(", ")}`,
        {
          kind: signal.kind,
          contexts: signal.contexts,
          fragmentIds: signal.fragmentIds ?? [],
        },
        signal.linkedEntities,
        clamp01(Math.min(signal.confidence, 0.82)),
      ),
    );
  }

  for (const fragment of input.separationFragments.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${fragment.text.slice(0, 120)} confirms separation`,
        {
          fragmentId: fragment.fragmentId,
          path: fragment.path,
          contexts: input.fragmentContextMentions.get(fragment.fragmentId) ?? [],
        },
        undefined,
        0.84,
      ),
    );
  }

  return evidence;
}
