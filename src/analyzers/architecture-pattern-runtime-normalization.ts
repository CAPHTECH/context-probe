import type {
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  TelemetryNormalizationRule,
} from "../core/contracts.js";
import { PATTERN_RUNTIME_NORMALIZATION_BLOCK_SPECS } from "./architecture-pattern-runtime-normalization-blocks.js";
import {
  average,
  clamp01,
  normalizeObservedValue,
  uniqueUnknowns,
} from "./architecture-pattern-runtime-normalization-math.js";

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

  for (const blockSpec of PATTERN_RUNTIME_NORMALIZATION_BLOCK_SPECS) {
    const rawBlock = raw[blockSpec.blockName] as Record<string, number | undefined> | undefined;
    const profileBlock = profile[blockSpec.blockName] as
      | Record<string, TelemetryNormalizationRule | undefined>
      | undefined;
    if (!rawBlock) {
      continue;
    }
    const normalizedBlock: Record<string, number> = {};
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
