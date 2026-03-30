import { average, clamp01 } from "./boundary-fitness-shared.js";

export function computeCodeBoundaryStrength(input: {
  applicableReferences: number;
  adherence: number;
  leakCount: number;
  modelCoverageScore: number;
}): number {
  if (input.applicableReferences > 0) {
    const leakRatio = input.leakCount / input.applicableReferences;
    return clamp01((input.adherence + (1 - leakRatio)) / 2);
  }
  return clamp01(0.55 + input.modelCoverageScore * 0.25);
}

export function computeSeparationScore(input: {
  attractionSignalCount: number;
  localizedSignalCount: number;
  explicitSeparationScore: number;
  codeBoundaryStrength: number;
  modelCoverageScore: number;
}): number {
  const documentSeparationScore =
    input.attractionSignalCount === 0
      ? 0.5
      : clamp01(input.localizedSignalCount / Math.max(1, input.attractionSignalCount));
  return clamp01(
    average(
      [documentSeparationScore, input.explicitSeparationScore, input.codeBoundaryStrength, input.modelCoverageScore],
      0.55,
    ),
  );
}
