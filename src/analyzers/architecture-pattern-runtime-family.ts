import type { ArchitecturePatternRuntimeObservationSet } from "../core/contracts.js";
import {
  clamp01,
  type PatternRuntimeFinding,
  type PatternRuntimeResolution,
  resolveSelectedSpec,
  unique,
  weightedObservedAverage,
} from "./architecture-pattern-runtime-shared.js";

export function resolveFamilyPatternRuntime(input: {
  observations: ArchitecturePatternRuntimeObservationSet | undefined;
  findings: PatternRuntimeFinding[];
  unknowns: string[];
}): PatternRuntimeResolution | undefined {
  const { observations, findings, unknowns } = input;
  const selected = resolveSelectedSpec({ observations, findings, unknowns });
  if (!selected.spec || !selected.block) {
    return undefined;
  }

  const weighted = weightedObservedAverage(selected.block, selected.spec.weights);
  for (const signal of weighted.missingSignals) {
    unknowns.push(
      `${selected.spec.blockName} is missing ${signal}, so PatternRuntime is only a partial approximation.`,
    );
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_signal_missing",
      confidence: 0.68,
      note: `${selected.spec.blockName} is missing ${signal}.`,
      signal,
      source: "family",
    };
    if (selected.family) {
      finding.patternFamily = selected.family;
    }
    findings.push(finding);
  }

  if (observations?.score !== undefined) {
    unknowns.push("Family-specific pattern runtime data took precedence over the legacy score.");
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_legacy_overridden",
      confidence: 0.74,
      note: "The family-specific pattern runtime block was prioritized and the legacy score was treated as supplemental.",
      source: "family",
    };
    if (selected.family) {
      finding.patternFamily = selected.family;
    }
    findings.push(finding);
  }

  const mismatchPenalty = findings.some((finding) => finding.kind === "pattern_runtime_family_mismatch") ? 0.3 : 0;
  const multiplePenalty = findings.some((finding) => finding.kind === "pattern_runtime_multiple_blocks") ? 0.12 : 0;
  const confidence = clamp01(
    0.42 +
      weighted.coverage * 0.4 +
      (selected.family && selected.spec.families.includes(selected.family) ? 0.08 : 0) -
      mismatchPenalty -
      multiplePenalty,
  );

  const result: PatternRuntimeResolution = {
    value: weighted.value,
    confidence,
    unknowns: unique(unknowns),
    findings,
    source: "family",
    usedSignals: weighted.usedSignals,
    missingSignals: weighted.missingSignals,
  };
  if (selected.family) {
    result.patternFamily = selected.family;
  }
  return result;
}
