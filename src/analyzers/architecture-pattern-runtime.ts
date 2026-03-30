import type { ArchitecturePatternRuntimeObservationSet } from "../core/contracts.js";
import { resolveFallbackPatternRuntime } from "./architecture-pattern-runtime-fallback.js";
import { resolveFamilyPatternRuntime } from "./architecture-pattern-runtime-family.js";
import type { PatternRuntimeFinding, PatternRuntimeResolution } from "./architecture-pattern-runtime-shared.js";

export type {
  PatternRuntimeFinding,
  PatternRuntimeResolution,
  PatternRuntimeSource,
} from "./architecture-pattern-runtime-shared.js";

export function scorePatternRuntime(input: {
  observations?: ArchitecturePatternRuntimeObservationSet;
  topologyIsolationBridge?: number;
}): PatternRuntimeResolution {
  const findings: PatternRuntimeFinding[] = [];
  const unknowns: string[] = [];
  const familyResolution = resolveFamilyPatternRuntime({
    observations: input.observations,
    findings,
    unknowns,
  });
  if (familyResolution) {
    return familyResolution;
  }

  return resolveFallbackPatternRuntime({
    observations: input.observations,
    ...(input.topologyIsolationBridge !== undefined ? { topologyIsolationBridge: input.topologyIsolationBridge } : {}),
    findings,
    unknowns,
  });
}
