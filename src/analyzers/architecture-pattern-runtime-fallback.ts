import type { ArchitecturePatternRuntimeObservationSet } from "../core/contracts.js";
import {
  clamp01,
  type PatternRuntimeFinding,
  type PatternRuntimeResolution,
  unique,
} from "./architecture-pattern-runtime-shared.js";

export function resolveFallbackPatternRuntime(input: {
  observations: ArchitecturePatternRuntimeObservationSet | undefined;
  topologyIsolationBridge?: number;
  findings: PatternRuntimeFinding[];
  unknowns: string[];
}): PatternRuntimeResolution {
  const { observations, topologyIsolationBridge, findings, unknowns } = input;

  if (observations?.score !== undefined) {
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_legacy_used",
      confidence: 0.76,
      note: "The legacy pattern runtime score is being used as-is.",
      source: "legacy",
    };
    if (observations.patternFamily) {
      finding.patternFamily = observations.patternFamily;
    }
    findings.push(finding);
    const result: PatternRuntimeResolution = {
      value: clamp01(observations.score),
      confidence: 0.76,
      unknowns: unique(unknowns),
      findings,
      source: "legacy",
      usedSignals: [],
      missingSignals: [],
    };
    if (observations.patternFamily) {
      result.patternFamily = observations.patternFamily;
    }
    return result;
  }

  if (topologyIsolationBridge !== undefined) {
    unknowns.push("No pattern runtime observations were provided, so PatternRuntime is using the TIS bridge.");
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_tis_bridge",
      confidence: 0.68,
      note: "Pattern runtime observations are missing, so the TIS bridge is being used for PatternRuntime.",
      source: "tis_bridge",
    };
    if (observations?.patternFamily) {
      finding.patternFamily = observations.patternFamily;
    }
    findings.push(finding);
    const result: PatternRuntimeResolution = {
      value: clamp01(topologyIsolationBridge),
      confidence: 0.62,
      unknowns: unique(unknowns),
      findings,
      source: "tis_bridge",
      usedSignals: [],
      missingSignals: [],
    };
    if (observations?.patternFamily) {
      result.patternFamily = observations.patternFamily;
    }
    return result;
  }

  unknowns.push("No pattern runtime observations were provided, so PatternRuntime is using the neutral value 0.5.");
  const finding: PatternRuntimeFinding = {
    kind: "pattern_runtime_neutral",
    confidence: 0.62,
    note: "Pattern runtime observations are missing, so PatternRuntime is close to unobserved.",
    source: "neutral",
  };
  if (observations?.patternFamily) {
    finding.patternFamily = observations.patternFamily;
  }
  findings.push(finding);
  const result: PatternRuntimeResolution = {
    value: 0.5,
    confidence: 0.35,
    unknowns: unique(unknowns),
    findings,
    source: "neutral",
    usedSignals: [],
    missingSignals: [],
  };
  if (observations?.patternFamily) {
    result.patternFamily = observations.patternFamily;
  }
  return result;
}
