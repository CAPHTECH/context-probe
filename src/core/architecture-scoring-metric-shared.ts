import type { ArchitectureEvidenceBundle } from "./architecture-scoring-evidence.js";
import type {
  ArchitecturePolicy,
  ArchitectureScoringContext,
  ComputeArchitectureScoresOptions,
} from "./architecture-scoring-types.js";

export interface ArchitectureMetricBuilderArgs {
  options: ComputeArchitectureScoresOptions;
  policy: ArchitecturePolicy;
  context: ArchitectureScoringContext;
  evidence: ArchitectureEvidenceBundle;
}

export function evidenceRefs(...groups: Array<Array<{ evidenceId: string }>>): string[] {
  return groups.flatMap((group) => group.map((entry) => entry.evidenceId));
}
