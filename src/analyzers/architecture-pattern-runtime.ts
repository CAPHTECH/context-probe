import type {
  ArchitecturePatternFamily,
  ArchitecturePatternRuntimeObservationSet
} from "../core/contracts.js";

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

interface SelectedPatternRuntimeSpec {
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
      DependencyIsolationScore: 0.4
    }
  },
  {
    blockName: "serviceBasedRuntime",
    families: ["modular-monolith", "microservices"],
    weights: {
      PartialFailureContainmentScore: 0.4,
      RetryAmplificationScore: 0.3,
      SyncHopDepthScore: 0.3
    }
  },
  {
    blockName: "cqrsRuntime",
    families: ["cqrs"],
    weights: {
      ProjectionFreshnessScore: 0.4,
      ReplayDivergenceScore: 0.3,
      StaleReadAcceptabilityScore: 0.3
    }
  },
  {
    blockName: "eventDrivenRuntime",
    families: ["event-driven"],
    weights: {
      DeadLetterHealthScore: 0.35,
      ConsumerLagScore: 0.35,
      ReplayRecoveryScore: 0.3
    }
  }
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function unique(values: string[]): string[] {
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

function weightedObservedAverage(
  signals: WeightedSignalSet,
  weights: Record<string, number>
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
    missingSignals
  };
}

function resolveSelectedSpec(input: {
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
    unknowns.push("複数の pattern runtime block が指定されているため PatternRuntime は優先 block を使って近似します");
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_multiple_blocks",
      confidence: 0.66,
      note: "複数の pattern runtime block が指定されているため優先 block を選択しました",
      source: "family"
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
        block: exactMatch.value
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
    unknowns.push(
      `patternFamily=${declaredFamily} ですが ${selected.blockName} を使って PatternRuntime を推定しています`
    );
    findings.push({
      kind: "pattern_runtime_family_mismatch",
      confidence: 0.58,
      note: `patternFamily=${declaredFamily} と ${selected.blockName} の組み合わせが不整合です`,
      patternFamily: declaredFamily,
      source: "family"
    });
  }

  const result: SelectedPatternRuntimeSpec = {
    block: selected.value
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

export function scorePatternRuntime(input: {
  observations?: ArchitecturePatternRuntimeObservationSet;
  topologyIsolationBridge?: number;
}): PatternRuntimeResolution {
  const findings: PatternRuntimeFinding[] = [];
  const unknowns: string[] = [];
  const observations = input.observations;

  const selected = resolveSelectedSpec({ observations, findings, unknowns });
  if (selected.spec && selected.block) {
    const weighted = weightedObservedAverage(selected.block, selected.spec.weights);
    for (const signal of weighted.missingSignals) {
      unknowns.push(`${selected.spec.blockName} の ${signal} が不足しており PatternRuntime は部分的な近似です`);
      const finding: PatternRuntimeFinding = {
        kind: "pattern_runtime_signal_missing",
        confidence: 0.68,
        note: `${selected.spec.blockName} の ${signal} が不足しています`,
        signal,
        source: "family"
      };
      if (selected.family) {
        finding.patternFamily = selected.family;
      }
      findings.push(finding);
    }
    if (observations?.score !== undefined) {
      unknowns.push("family-specific pattern runtime が legacy score より優先されました");
      const finding: PatternRuntimeFinding = {
        kind: "pattern_runtime_legacy_overridden",
        confidence: 0.74,
        note: "family-specific pattern runtime block を優先し、legacy score は補助情報として扱いました",
        source: "family"
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
        multiplePenalty
    );
    const result: PatternRuntimeResolution = {
      value: weighted.value,
      confidence,
      unknowns: unique(unknowns),
      findings,
      source: "family",
      usedSignals: weighted.usedSignals,
      missingSignals: weighted.missingSignals
    };
    if (selected.family) {
      result.patternFamily = selected.family;
    }
    return result;
  }

  if (observations?.score !== undefined) {
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_legacy_used",
      confidence: 0.76,
      note: "legacy pattern runtime score をそのまま利用しています",
      source: "legacy"
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
      missingSignals: []
    };
    if (observations.patternFamily) {
      result.patternFamily = observations.patternFamily;
    }
    return result;
  }

  if (input.topologyIsolationBridge !== undefined) {
    unknowns.push("pattern runtime observations が指定されていないため PatternRuntime は TIS bridge を使っています");
    const finding: PatternRuntimeFinding = {
      kind: "pattern_runtime_tis_bridge",
      confidence: 0.68,
      note: "pattern runtime observation が不足しているため TIS bridge を PatternRuntime に利用しています",
      source: "tis_bridge"
    };
    if (observations?.patternFamily) {
      finding.patternFamily = observations.patternFamily;
    }
    findings.push(finding);
    const result: PatternRuntimeResolution = {
      value: clamp01(input.topologyIsolationBridge),
      confidence: 0.62,
      unknowns: unique(unknowns),
      findings,
      source: "tis_bridge",
      usedSignals: [],
      missingSignals: []
    };
    if (observations?.patternFamily) {
      result.patternFamily = observations.patternFamily;
    }
    return result;
  }

  unknowns.push("pattern runtime observations が指定されていないため PatternRuntime は中立値 0.5 を使っています");
  const finding: PatternRuntimeFinding = {
    kind: "pattern_runtime_neutral",
    confidence: 0.62,
    note: "pattern runtime observation が不足しているため PatternRuntime は未観測に近い状態です",
    source: "neutral"
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
    missingSignals: []
  };
  if (observations?.patternFamily) {
    result.patternFamily = observations.patternFamily;
  }
  return result;
}
