import type { COMMANDS } from "../src/commands.js";

export * from "./scoring-validation-constants.js";
export * from "./scoring-validation-fixtures.js";

export function getLocalityComparison(
  response: Awaited<ReturnType<NonNullable<(typeof COMMANDS)["history.compare_locality_models"]>>>,
) {
  return response.result as {
    els: {
      score: number;
      components: {
        CCL: number;
        FS: number;
        SCR: number;
      };
    };
    persistenceCandidate: {
      localityScore: number;
      persistentCouplingPenalty: number;
    };
    persistenceAnalysis: {
      pairWeights: Array<{ left: string; right: string; rawCount: number; jaccard: number }>;
      noiseRatio: number;
    };
    delta: number;
  };
}

export function computeApsiFromWeights(
  components: Record<string, number>,
  weights: { QSF: number; PCS: number; OAS: number; EES: number; CTI: number },
): number {
  return (
    weights.QSF * (components.QSF ?? 0.5) +
    weights.PCS * (components.PCS ?? 0.5) +
    weights.OAS * (components.OAS ?? 0.5) +
    weights.EES * (components.EES ?? 0.5) +
    weights.CTI * (1 - (components.CTI ?? 0.5))
  );
}
