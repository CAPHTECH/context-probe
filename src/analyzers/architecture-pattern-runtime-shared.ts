import type { ArchitecturePatternFamily, ArchitecturePatternRuntimeObservationSet } from "../core/contracts.js";

export type PatternRuntimeSource = "family" | "legacy" | "tis_bridge" | "neutral";

export interface PatternRuntimeFinding {
  kind:
    | "pattern_runtime_signal_missing"
    | "pattern_runtime_family_mismatch"
    | "pattern_runtime_multiple_blocks"
    | "pattern_runtime_legacy_overridden"
    | "pattern_runtime_legacy_used"
    | "pattern_runtime_tis_bridge"
    | "pattern_runtime_neutral";
  confidence: number;
  note: string;
  patternFamily?: ArchitecturePatternFamily;
  signal?: string;
  source?: PatternRuntimeSource;
}

export interface PatternRuntimeResolution {
  value: number;
  confidence: number;
  unknowns: string[];
  findings: PatternRuntimeFinding[];
  source: PatternRuntimeSource;
  patternFamily?: ArchitecturePatternFamily;
  usedSignals: string[];
  missingSignals: string[];
}

type PatternRuntimeBlockName = "layeredRuntime" | "serviceBasedRuntime" | "cqrsRuntime" | "eventDrivenRuntime";

type WeightedSignalSet = Record<string, number | undefined>;

interface PatternRuntimeSpec {
  blockName: PatternRuntimeBlockName;
  families: ArchitecturePatternFamily[];
  weights: Record<string, number>;
}

export interface SelectedPatternRuntimeSpec {
  spec?: PatternRuntimeSpec;
  block?: WeightedSignalSet;
  family?: ArchitecturePatternFamily;
}

const FAMILY_SPECS: PatternRuntimeSpec[] = [
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

function specForFamily(family: ArchitecturePatternFamily | undefined): PatternRuntimeSpec | undefined {
  return family ? FAMILY_SPECS.find((spec) => spec.families.includes(family)) : undefined;
}

function blockEntries(observations: ArchitecturePatternRuntimeObservationSet | undefined) {
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

export function weightedObservedAverage(
  signals: WeightedSignalSet,
  weights: Record<string, number>,
): {
  value: number;
  coverage: number;
  usedSignals: string[];
  missingSignals: string[];
} {
  const usedSignals: string[] = [];
  const missingSignals: string[] = [];
  let weightedSum = 0;
  let observedWeight = 0;
  let totalWeight = 0;

  for (const [signal, weight] of Object.entries(weights)) {
    totalWeight += weight;
    const observed = signals[signal];
    if (observed === undefined || !Number.isFinite(observed)) {
      missingSignals.push(signal);
      continue;
    }
    usedSignals.push(signal);
    observedWeight += weight;
    weightedSum += clamp01(observed) * weight;
  }

  const value = observedWeight > 0 ? weightedSum / observedWeight : 0.5;
  const coverage = totalWeight > 0 ? observedWeight / totalWeight : 0;

  return {
    value: clamp01(value),
    coverage: clamp01(coverage),
    usedSignals,
    missingSignals,
  };
}

export function resolveSelectedSpec(input: {
  observations: ArchitecturePatternRuntimeObservationSet | undefined;
  findings: PatternRuntimeFinding[];
  unknowns: string[];
}): SelectedPatternRuntimeSpec {
  const { observations, findings, unknowns } = input;
  if (!observations) {
    return {};
  }

  const declaredFamily = observations.patternFamily;
  const declaredSpec = specForFamily(declaredFamily);
  const providedBlocks = blockEntries(observations);

  if (providedBlocks.length === 0) {
    const result: SelectedPatternRuntimeSpec = {};
    if (declaredSpec) {
      result.spec = declaredSpec;
    }
    if (declaredFamily) {
      result.family = declaredFamily;
    }
    return result;
  }

  if (providedBlocks.length > 1) {
    unknowns.push(
      "Multiple pattern runtime blocks were provided, so PatternRuntime is approximated from the highest-priority block.",
    );
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_multiple_blocks",
      confidence: 0.66,
      note: "Multiple pattern runtime blocks were provided, so the highest-priority block was selected.",
      source: "family",
    };
    if (declaredFamily) {
      finding.patternFamily = declaredFamily;
    }
    findings.push(finding);
  }

  if (declaredSpec) {
    const exactMatch = providedBlocks.find((entry) => entry.blockName === declaredSpec.blockName);
    if (exactMatch) {
      const result: SelectedPatternRuntimeSpec = {
        spec: declaredSpec,
        block: exactMatch.value,
      };
      if (declaredFamily) {
        result.family = declaredFamily;
      }
      return result;
    }
  }

  const selected = providedBlocks[0];
  if (!selected) {
    return {};
  }
  const selectedSpec = FAMILY_SPECS.find((entry) => entry.blockName === selected.blockName);
  if (declaredFamily && selectedSpec && !selectedSpec.families.includes(declaredFamily)) {
    unknowns.push(`patternFamily=${declaredFamily}, but PatternRuntime is being estimated from ${selected.blockName}.`);
    findings.push({
      kind: "pattern_runtime_family_mismatch",
      confidence: 0.58,
      note: `patternFamily=${declaredFamily} is inconsistent with ${selected.blockName}.`,
      patternFamily: declaredFamily,
      source: "family",
    });
  }

  const result: SelectedPatternRuntimeSpec = {
    block: selected.value,
  };
  if (selectedSpec) {
    result.spec = selectedSpec;
  }
  const resolvedFamily = declaredFamily ?? selectedSpec?.families[0];
  if (resolvedFamily) {
    result.family = resolvedFamily;
  }
  return result;
}
