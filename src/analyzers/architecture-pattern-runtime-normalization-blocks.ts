import type {
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeRawObservationSet,
} from "../core/contracts.js";

export type PatternRuntimeNormalizationBlockName =
  | "layeredRuntime"
  | "serviceBasedRuntime"
  | "cqrsRuntime"
  | "eventDrivenRuntime";

export interface PatternRuntimeNormalizationBlockSpec {
  blockName: PatternRuntimeNormalizationBlockName;
  rawBlock: ArchitecturePatternRuntimeRawObservationSet[PatternRuntimeNormalizationBlockName];
  profileBlock: ArchitecturePatternRuntimeNormalizationProfile[PatternRuntimeNormalizationBlockName];
  mappings: Array<{ rawSignal: string; scoreSignal: string }>;
}

export const PATTERN_RUNTIME_NORMALIZATION_BLOCK_SPECS: readonly PatternRuntimeNormalizationBlockSpec[] = [
  {
    blockName: "layeredRuntime",
    rawBlock: undefined,
    profileBlock: undefined,
    mappings: [
      { rawSignal: "FailureContainment", scoreSignal: "FailureContainmentScore" },
      { rawSignal: "DependencyIsolation", scoreSignal: "DependencyIsolationScore" },
    ],
  },
  {
    blockName: "serviceBasedRuntime",
    rawBlock: undefined,
    profileBlock: undefined,
    mappings: [
      { rawSignal: "PartialFailureContainment", scoreSignal: "PartialFailureContainmentScore" },
      { rawSignal: "RetryAmplification", scoreSignal: "RetryAmplificationScore" },
      { rawSignal: "SyncHopDepth", scoreSignal: "SyncHopDepthScore" },
    ],
  },
  {
    blockName: "cqrsRuntime",
    rawBlock: undefined,
    profileBlock: undefined,
    mappings: [
      { rawSignal: "ProjectionFreshness", scoreSignal: "ProjectionFreshnessScore" },
      { rawSignal: "ReplayDivergence", scoreSignal: "ReplayDivergenceScore" },
      { rawSignal: "StaleReadAcceptability", scoreSignal: "StaleReadAcceptabilityScore" },
    ],
  },
  {
    blockName: "eventDrivenRuntime",
    rawBlock: undefined,
    profileBlock: undefined,
    mappings: [
      { rawSignal: "DeadLetterHealth", scoreSignal: "DeadLetterHealthScore" },
      { rawSignal: "ConsumerLag", scoreSignal: "ConsumerLagScore" },
      { rawSignal: "ReplayRecovery", scoreSignal: "ReplayRecoveryScore" },
    ],
  },
];
