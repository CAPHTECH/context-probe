import type { CochangePairWeight } from "./contracts.js";
import { buildPairWeights } from "./history-persistence-components.js";
import {
  computeClusterPenalty as computeClusterPenaltyImpl,
  deriveStableClusters as deriveStableClustersImpl,
} from "./history-persistence-stability.js";

export function deriveStableClusters(
  contextsSeen: string[],
  pairWeights: CochangePairWeight[],
): ReturnType<typeof deriveStableClustersImpl> {
  return deriveStableClustersImpl(contextsSeen, pairWeights);
}

export function computeClusterPenalty(
  strongestCluster: Parameters<typeof computeClusterPenaltyImpl>[0],
  contextCount: number,
): number {
  return computeClusterPenaltyImpl(strongestCluster, contextCount);
}

export { buildPairWeights };
