import type { Fragment } from "./contracts.js";
import {
  isListItemLine,
  normalizeStatement,
  splitIntoSentences,
  stripListMarker,
} from "./document-extractor-shared.js";
import type { StatementSegment } from "./document-extractor-types.js";

export function buildStatementSegments(fragment: Fragment): StatementSegment[] {
  const segments: StatementSegment[] = [];
  const proseBuffer: string[] = [];

  const flushProse = () => {
    if (proseBuffer.length === 0) {
      return;
    }
    splitIntoSentences(proseBuffer.join(" ")).forEach((sentence) => {
      segments.push({
        text: sentence,
        sourceKind: "sentence",
      });
    });
    proseBuffer.length = 0;
  };

  for (const rawLine of fragment.text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushProse();
      continue;
    }
    if (isListItemLine(line)) {
      flushProse();
      const bullet = normalizeStatement(stripListMarker(line));
      if (bullet) {
        segments.push({
          text: bullet,
          sourceKind: "bullet",
        });
      }
      continue;
    }
    proseBuffer.push(line);
  }

  flushProse();
  return segments;
}
