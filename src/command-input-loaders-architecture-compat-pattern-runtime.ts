import {
  asNumber,
  asPatternFamily,
  asString,
  isRecord,
  withNumericField,
  withOptionalObject,
  withOptionalString,
  withOptionalValue,
} from "./command-input-loaders-architecture-compat-shared.js";
import type { ArchitecturePatternRuntimeObservationSet } from "./core/contracts.js";

function sanitizePatternRuntimeBlock<T extends string>(
  input: unknown,
  keys: readonly T[],
): Partial<Record<T, number>> | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const sanitized: Partial<Record<T, number>> = {};
  for (const key of keys) {
    const value = asNumber(input[key]);
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function normalizePatternRuntimeObservations(
  input: unknown,
): ArchitecturePatternRuntimeObservationSet | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const metrics = isRecord(input.metrics)
    ? Object.fromEntries(
        Object.entries(input.metrics).filter(
          (entry): entry is [string, number] => typeof entry[0] === "string" && asNumber(entry[1]) !== undefined,
        ),
      )
    : undefined;
  const sanitizedMetrics = metrics && Object.keys(metrics).length > 0 ? metrics : undefined;
  const layeredRuntime = sanitizePatternRuntimeBlock(input.layeredRuntime, [
    "FailureContainmentScore",
    "DependencyIsolationScore",
  ]);
  const serviceBasedRuntime = sanitizePatternRuntimeBlock(input.serviceBasedRuntime, [
    "PartialFailureContainmentScore",
    "RetryAmplificationScore",
    "SyncHopDepthScore",
  ]);
  const cqrsRuntime = sanitizePatternRuntimeBlock(input.cqrsRuntime, [
    "ProjectionFreshnessScore",
    "ReplayDivergenceScore",
    "StaleReadAcceptabilityScore",
  ]);
  const eventDrivenRuntime = sanitizePatternRuntimeBlock(input.eventDrivenRuntime, [
    "DeadLetterHealthScore",
    "ConsumerLagScore",
    "ReplayRecoveryScore",
  ]);

  return {
    version: asString(input.version) ?? "1.0",
    ...withOptionalString("source", asString(input.source)),
    ...withOptionalString("note", asString(input.note)),
    ...withOptionalObject("layeredRuntime", layeredRuntime),
    ...withOptionalObject("serviceBasedRuntime", serviceBasedRuntime),
    ...withOptionalObject("cqrsRuntime", cqrsRuntime),
    ...withOptionalObject("eventDrivenRuntime", eventDrivenRuntime),
    ...withOptionalObject("metrics", sanitizedMetrics),
    ...withOptionalValue("patternFamily", asPatternFamily(input.patternFamily)),
    ...withNumericField("score", asNumber(input.score)),
  };
}
