import type { TelemetryNormalizationRule } from "./architecture-normalization.js";

export type ArchitecturePatternFamily =
  | "layered"
  | "clean"
  | "hexagonal"
  | "modular-monolith"
  | "microservices"
  | "cqrs"
  | "event-driven";

export interface LayeredPatternRuntimeObservationSet {
  FailureContainmentScore?: number;
  DependencyIsolationScore?: number;
}

export interface ServiceBasedPatternRuntimeObservationSet {
  PartialFailureContainmentScore?: number;
  RetryAmplificationScore?: number;
  SyncHopDepthScore?: number;
}

export interface CqrsPatternRuntimeObservationSet {
  ProjectionFreshnessScore?: number;
  ReplayDivergenceScore?: number;
  StaleReadAcceptabilityScore?: number;
}

export interface EventDrivenPatternRuntimeObservationSet {
  DeadLetterHealthScore?: number;
  ConsumerLagScore?: number;
  ReplayRecoveryScore?: number;
}

export interface LayeredPatternRuntimeRawObservationSet {
  FailureContainment?: number;
  DependencyIsolation?: number;
}

export interface ServiceBasedPatternRuntimeRawObservationSet {
  PartialFailureContainment?: number;
  RetryAmplification?: number;
  SyncHopDepth?: number;
}

export interface CqrsPatternRuntimeRawObservationSet {
  ProjectionFreshness?: number;
  ReplayDivergence?: number;
  StaleReadAcceptability?: number;
}

export interface EventDrivenPatternRuntimeRawObservationSet {
  DeadLetterHealth?: number;
  ConsumerLag?: number;
  ReplayRecovery?: number;
}

export interface ArchitecturePatternRuntimeObservationSet {
  version: string;
  patternFamily?: ArchitecturePatternFamily;
  layeredRuntime?: LayeredPatternRuntimeObservationSet;
  serviceBasedRuntime?: ServiceBasedPatternRuntimeObservationSet;
  cqrsRuntime?: CqrsPatternRuntimeObservationSet;
  eventDrivenRuntime?: EventDrivenPatternRuntimeObservationSet;
  score?: number;
  metrics?: Record<string, number>;
  source?: string;
  note?: string;
}

export interface ArchitecturePatternRuntimeRawObservationSet {
  version: string;
  patternFamily?: ArchitecturePatternFamily;
  layeredRuntime?: LayeredPatternRuntimeRawObservationSet;
  serviceBasedRuntime?: ServiceBasedPatternRuntimeRawObservationSet;
  cqrsRuntime?: CqrsPatternRuntimeRawObservationSet;
  eventDrivenRuntime?: EventDrivenPatternRuntimeRawObservationSet;
  source?: string;
  note?: string;
}

export interface ArchitecturePatternRuntimeNormalizationProfile {
  version: string;
  layeredRuntime?: Partial<Record<"FailureContainment" | "DependencyIsolation", TelemetryNormalizationRule>>;
  serviceBasedRuntime?: Partial<
    Record<"PartialFailureContainment" | "RetryAmplification" | "SyncHopDepth", TelemetryNormalizationRule>
  >;
  cqrsRuntime?: Partial<
    Record<"ProjectionFreshness" | "ReplayDivergence" | "StaleReadAcceptability", TelemetryNormalizationRule>
  >;
  eventDrivenRuntime?: Partial<
    Record<"DeadLetterHealth" | "ConsumerLag" | "ReplayRecovery", TelemetryNormalizationRule>
  >;
}
