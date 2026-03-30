import type { ArchitecturePatternFamily } from "../core/contracts.js";

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

export interface SelectedPatternRuntimeSpec {
  spec?: {
    blockName: "layeredRuntime" | "serviceBasedRuntime" | "cqrsRuntime" | "eventDrivenRuntime";
    families: ArchitecturePatternFamily[];
    weights: Record<string, number>;
  };
  block?: Record<string, number | undefined>;
  family?: ArchitecturePatternFamily;
}
