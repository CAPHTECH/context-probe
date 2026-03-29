import type {
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  ScenarioDirection,
  TelemetryNormalizationRule,
} from "../core/contracts.js";

export interface PatternRuntimeNormalizationFinding {
  kind: "normalized_signal" | "missing_raw_signal" | "missing_normalization_rule";
  confidence: number;
  note: string;
  block: "layeredRuntime" | "serviceBasedRuntime" | "cqrsRuntime" | "eventDrivenRuntime";
  rawSignal: string;
  scoreSignal: string;
  observed?: number;
  normalized?: number;
}

export interface NormalizedPatternRuntimeResult {
  patternRuntimeObservations: ArchitecturePatternRuntimeObservationSet;
  confidence: number;
  unknowns: string[];
  findings: PatternRuntimeNormalizationFinding[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueUnknowns(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeObservedValue(input: {
  direction: ScenarioDirection;
  observed: number;
  target: number;
  worstAcceptable: number;
}): number {
  const { direction, observed, target, worstAcceptable } = input;
  if (direction === "lower_is_better") {
    return clamp01((worstAcceptable - observed) / Math.max(0.0001, worstAcceptable - target));
  }
  return clamp01((observed - worstAcceptable) / Math.max(0.0001, target - worstAcceptable));
}

export function normalizePatternRuntimeObservations(input: {
  raw?: ArchitecturePatternRuntimeRawObservationSet;
  profile?: ArchitecturePatternRuntimeNormalizationProfile;
}): NormalizedPatternRuntimeResult {
  const findings: PatternRuntimeNormalizationFinding[] = [];
  const unknowns: string[] = [];
  const raw = input.raw;
  const profile = input.profile;

  if (!raw) {
    return {
      patternRuntimeObservations: {
        version: "1.0",
      },
      confidence: 0.25,
      unknowns: ["No pattern-runtime raw observations were provided, so raw normalization is unobserved."],
      findings,
    };
  }

  if (!profile) {
    return {
      patternRuntimeObservations: {
        version: raw.version,
        ...(raw.patternFamily ? { patternFamily: raw.patternFamily } : {}),
        ...(raw.source ? { source: raw.source } : {}),
        ...(raw.note ? { note: raw.note } : {}),
      },
      confidence: 0.3,
      unknowns: ["No pattern-runtime normalization profile was provided, so raw runtime cannot be scored."],
      findings,
    };
  }

  let observedSignals = 0;
  let possibleSignals = 0;
  const normalized: ArchitecturePatternRuntimeObservationSet = {
    version: raw.version,
    ...(raw.patternFamily ? { patternFamily: raw.patternFamily } : {}),
    ...(raw.source ? { source: raw.source } : {}),
    ...(raw.note ? { note: raw.note } : {}),
  };

  const blockSpecs = [
    {
      blockName: "layeredRuntime" as const,
      rawBlock: raw.layeredRuntime,
      profileBlock: profile.layeredRuntime,
      mappings: [
        { rawSignal: "FailureContainment", scoreSignal: "FailureContainmentScore" },
        { rawSignal: "DependencyIsolation", scoreSignal: "DependencyIsolationScore" },
      ],
    },
    {
      blockName: "serviceBasedRuntime" as const,
      rawBlock: raw.serviceBasedRuntime,
      profileBlock: profile.serviceBasedRuntime,
      mappings: [
        { rawSignal: "PartialFailureContainment", scoreSignal: "PartialFailureContainmentScore" },
        { rawSignal: "RetryAmplification", scoreSignal: "RetryAmplificationScore" },
        { rawSignal: "SyncHopDepth", scoreSignal: "SyncHopDepthScore" },
      ],
    },
    {
      blockName: "cqrsRuntime" as const,
      rawBlock: raw.cqrsRuntime,
      profileBlock: profile.cqrsRuntime,
      mappings: [
        { rawSignal: "ProjectionFreshness", scoreSignal: "ProjectionFreshnessScore" },
        { rawSignal: "ReplayDivergence", scoreSignal: "ReplayDivergenceScore" },
        { rawSignal: "StaleReadAcceptability", scoreSignal: "StaleReadAcceptabilityScore" },
      ],
    },
    {
      blockName: "eventDrivenRuntime" as const,
      rawBlock: raw.eventDrivenRuntime,
      profileBlock: profile.eventDrivenRuntime,
      mappings: [
        { rawSignal: "DeadLetterHealth", scoreSignal: "DeadLetterHealthScore" },
        { rawSignal: "ConsumerLag", scoreSignal: "ConsumerLagScore" },
        { rawSignal: "ReplayRecovery", scoreSignal: "ReplayRecoveryScore" },
      ],
    },
  ];

  for (const blockSpec of blockSpecs) {
    if (!blockSpec.rawBlock) {
      continue;
    }
    const normalizedBlock: Record<string, number> = {};
    const rawBlock = blockSpec.rawBlock as Record<string, number | undefined>;
    const profileBlock = blockSpec.profileBlock as Record<string, TelemetryNormalizationRule | undefined> | undefined;
    for (const mapping of blockSpec.mappings) {
      possibleSignals += 1;
      const rule = profileBlock?.[mapping.rawSignal];
      const observed = rawBlock[mapping.rawSignal];

      if (!rule) {
        unknowns.push(`${blockSpec.blockName} is missing a normalization rule for ${mapping.rawSignal}.`);
        findings.push({
          kind: "missing_normalization_rule",
          block: blockSpec.blockName,
          rawSignal: mapping.rawSignal,
          scoreSignal: mapping.scoreSignal,
          confidence: 0.58,
          note: `${blockSpec.blockName} has no rule to normalize ${mapping.rawSignal}.`,
        });
        continue;
      }
      if (observed === undefined) {
        unknowns.push(`${blockSpec.blockName} is missing the raw ${mapping.rawSignal} signal.`);
        findings.push({
          kind: "missing_raw_signal",
          block: blockSpec.blockName,
          rawSignal: mapping.rawSignal,
          scoreSignal: mapping.scoreSignal,
          confidence: 0.62,
          note: `${blockSpec.blockName} is missing the raw ${mapping.rawSignal} signal.`,
        });
        continue;
      }

      const normalizedValue = normalizeObservedValue({
        direction: rule.direction,
        observed,
        target: rule.target,
        worstAcceptable: rule.worstAcceptable,
      });
      normalizedBlock[mapping.scoreSignal] = normalizedValue;
      observedSignals += 1;
      findings.push({
        kind: "normalized_signal",
        block: blockSpec.blockName,
        rawSignal: mapping.rawSignal,
        scoreSignal: mapping.scoreSignal,
        observed,
        normalized: normalizedValue,
        confidence: 0.86,
        note: `${blockSpec.blockName} normalized ${mapping.rawSignal} from raw runtime to ${normalizedValue.toFixed(3)}.`,
      });
    }

    if (Object.keys(normalizedBlock).length > 0) {
      normalized[blockSpec.blockName] = normalizedBlock;
    }
  }

  return {
    patternRuntimeObservations: normalized,
    confidence: clamp01(
      average([possibleSignals > 0 ? 0.82 : 0.25, observedSignals / Math.max(1, possibleSignals), 0.84], 0.35),
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings,
  };
}
