import { clamp01 } from "./boundary-fitness-shared.js";
import { localizationScore } from "./boundary-fitness-signals.js";

export function computeAttractionScore<T extends { contexts: string[]; confidence: number }>(signals: T[]): number {
  if (signals.length === 0) {
    return 0.45;
  }

  const weightedAttraction = signals.map((signal) => localizationScore(signal.contexts) * signal.confidence);
  const attractionWeight = signals.map((signal) => signal.confidence);
  return clamp01(
    weightedAttraction.reduce((sum, value) => sum + value, 0) /
      Math.max(
        0.0001,
        attractionWeight.reduce((sum, value) => sum + value, 0),
      ),
  );
}
