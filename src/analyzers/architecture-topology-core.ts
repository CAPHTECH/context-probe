import type { ArchitectureTopologyModel, TopologyRuntimeObservationSet } from "../core/contracts.js";
import { scoreTopologyIsolation as analyzeTopologyIsolation } from "./architecture-topology-signals.js";

export type { TopologyIsolationFinding, TopologyIsolationScore } from "./architecture-topology-signals.js";

export function scoreTopologyIsolation(input: {
  topology?: ArchitectureTopologyModel;
  observations?: TopologyRuntimeObservationSet;
}): ReturnType<typeof analyzeTopologyIsolation> {
  return analyzeTopologyIsolation(input);
}
