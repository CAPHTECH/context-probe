import type {
  ArchitecturePatternFamily,
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureTelemetryObservationSet,
} from "../core/contracts.js";
import { type CommonOpsFinding, scoreCommonOperations } from "./architecture-operations-common-ops.js";
import { type PatternRuntimeSource, scorePatternRuntime } from "./architecture-pattern-runtime.js";

export interface OperationalAdequacyFinding {
  kind:
    | CommonOpsFinding["kind"]
    | "missing_pattern_runtime"
    | "weak_pattern_runtime"
    | "pattern_runtime_signal_missing"
    | "pattern_runtime_family_mismatch"
    | "pattern_runtime_multiple_blocks"
    | "pattern_runtime_legacy_overridden"
    | "pattern_runtime_legacy_used"
    | "pattern_runtime_tis_bridge"
    | "pattern_runtime_neutral";
  confidence: number;
  note: string;
  bandId?: string;
  component?: "LatencyScore" | "ErrorScore" | "SaturationScore";
  patternFamily?: ArchitecturePatternFamily;
  signal?: string;
  source?: PatternRuntimeSource;
}

export interface OperationalAdequacyScore {
  CommonOps: number;
  PatternRuntime: number;
  bandCount: number;
  weightedBandCoverage: number;
  confidence: number;
  unknowns: string[];
  findings: OperationalAdequacyFinding[];
}

export function scoreOperationalAdequacy(input: {
  telemetry?: ArchitectureTelemetryObservationSet;
  patternRuntime?: ArchitecturePatternRuntimeObservationSet;
  topologyIsolationBridge?: number;
}): OperationalAdequacyScore {
  const commonOps = scoreCommonOperations(input.telemetry);
  const findings: OperationalAdequacyFinding[] = [...commonOps.findings];
  const unknowns: string[] = [...commonOps.unknowns];

  const patternRuntimeScore = scorePatternRuntime({
    ...(input.patternRuntime ? { observations: input.patternRuntime } : {}),
    ...(input.topologyIsolationBridge !== undefined ? { topologyIsolationBridge: input.topologyIsolationBridge } : {}),
  });
  const patternRuntimeSourceConfidence = patternRuntimeScore.confidence;
  const PatternRuntime = patternRuntimeScore.value;
  unknowns.push(...patternRuntimeScore.unknowns);
  findings.push(
    ...patternRuntimeScore.findings.map((finding) => {
      const kind: OperationalAdequacyFinding["kind"] =
        finding.kind === "pattern_runtime_tis_bridge" || finding.kind === "pattern_runtime_neutral"
          ? "missing_pattern_runtime"
          : finding.kind;
      const mapped: OperationalAdequacyFinding = {
        kind,
        confidence: finding.confidence,
        note: finding.note,
      };
      if (finding.patternFamily) {
        mapped.patternFamily = finding.patternFamily;
      }
      if (finding.signal) {
        mapped.signal = finding.signal;
      }
      if (finding.source) {
        mapped.source = finding.source;
      }
      return mapped;
    }),
  );

  if (PatternRuntime < 0.6) {
    findings.push({
      kind: "weak_pattern_runtime",
      confidence: 0.78,
      note: `PatternRuntime is low at ${PatternRuntime.toFixed(3)}, so pattern-specific runtime adequacy is weak.`,
      ...(patternRuntimeScore.patternFamily ? { patternFamily: patternRuntimeScore.patternFamily } : {}),
      source: patternRuntimeScore.source,
    });
  }

  return {
    CommonOps: commonOps.CommonOps,
    PatternRuntime,
    bandCount: commonOps.bandCount,
    weightedBandCoverage: commonOps.weightedBandCoverage,
    confidence: Math.max(
      0,
      Math.min(
        1,
        [
          commonOps.bandCount > 0 ? 0.82 : 0.35,
          commonOps.bandCount > 0 ? 0.45 + commonOps.weightedBandCoverage * 0.4 : 0.35,
          patternRuntimeSourceConfidence,
        ].reduce((sum, value) => sum + value, 0) / 3,
      ),
    ),
    unknowns: Array.from(new Set(unknowns)),
    findings,
  };
}
