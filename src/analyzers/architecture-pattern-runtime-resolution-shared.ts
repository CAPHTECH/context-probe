import type { ArchitecturePatternFamily, ArchitecturePatternRuntimeObservationSet } from "../core/contracts.js";

export type PatternRuntimeBlockName = "layeredRuntime" | "serviceBasedRuntime" | "cqrsRuntime" | "eventDrivenRuntime";

export type WeightedSignalSet = Record<string, number | undefined>;

export interface PatternRuntimeSpec {
  blockName: PatternRuntimeBlockName;
  families: ArchitecturePatternFamily[];
  weights: Record<string, number>;
}

export const FAMILY_SPECS: readonly PatternRuntimeSpec[] = [
  {
    blockName: "layeredRuntime",
    families: ["layered", "clean", "hexagonal"],
    weights: {
      FailureContainmentScore: 0.6,
      DependencyIsolationScore: 0.4,
    },
  },
  {
    blockName: "serviceBasedRuntime",
    families: ["modular-monolith", "microservices"],
    weights: {
      PartialFailureContainmentScore: 0.4,
      RetryAmplificationScore: 0.3,
      SyncHopDepthScore: 0.3,
    },
  },
  {
    blockName: "cqrsRuntime",
    families: ["cqrs"],
    weights: {
      ProjectionFreshnessScore: 0.4,
      ReplayDivergenceScore: 0.3,
      StaleReadAcceptabilityScore: 0.3,
    },
  },
  {
    blockName: "eventDrivenRuntime",
    families: ["event-driven"],
    weights: {
      DeadLetterHealthScore: 0.35,
      ConsumerLagScore: 0.35,
      ReplayRecoveryScore: 0.3,
    },
  },
];

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function specForFamily(family: ArchitecturePatternFamily | undefined): PatternRuntimeSpec | undefined {
  return family ? FAMILY_SPECS.find((spec) => spec.families.includes(family)) : undefined;
}

export function blockEntries(observations: ArchitecturePatternRuntimeObservationSet | undefined) {
  const entries: Array<{ blockName: PatternRuntimeBlockName; value: WeightedSignalSet }> = [];
  if (!observations) {
    return entries;
  }
  if (observations.layeredRuntime) {
    entries.push({ blockName: "layeredRuntime", value: { ...observations.layeredRuntime } });
  }
  if (observations.serviceBasedRuntime) {
    entries.push({ blockName: "serviceBasedRuntime", value: { ...observations.serviceBasedRuntime } });
  }
  if (observations.cqrsRuntime) {
    entries.push({ blockName: "cqrsRuntime", value: { ...observations.cqrsRuntime } });
  }
  if (observations.eventDrivenRuntime) {
    entries.push({ blockName: "eventDrivenRuntime", value: { ...observations.eventDrivenRuntime } });
  }
  return entries;
}
