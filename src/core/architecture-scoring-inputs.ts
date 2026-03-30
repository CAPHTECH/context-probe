import { parseCodebase } from "../analyzers/code.js";
import {
  type ArchitectureScoringComplexityResults,
  resolveArchitectureScoringComplexityInputs,
} from "./architecture-scoring-inputs-complexity.js";
import {
  type ArchitectureScoringObservabilityResults,
  resolveArchitectureScoringObservabilityInputs,
} from "./architecture-scoring-inputs-observability.js";
import {
  type ArchitectureScoringStaticResults,
  resolveArchitectureScoringStaticInputs,
} from "./architecture-scoring-inputs-static.js";
import type { ArchitecturePolicy, ComputeArchitectureScoresOptions } from "./architecture-scoring-types.js";

export type ArchitectureScoringInputResults = {
  codebase: Awaited<ReturnType<typeof parseCodebase>>;
} & ArchitectureScoringStaticResults &
  ArchitectureScoringObservabilityResults &
  ArchitectureScoringComplexityResults;

export async function resolveArchitectureScoringInputs(
  options: ComputeArchitectureScoresOptions,
  policy: ArchitecturePolicy,
): Promise<ArchitectureScoringInputResults> {
  const codebase = await parseCodebase(options.repoPath);
  const staticResults = await resolveArchitectureScoringStaticInputs(options, policy, codebase);
  const observabilityResults = resolveArchitectureScoringObservabilityInputs(options, staticResults.topologyValue);
  const complexityResults = resolveArchitectureScoringComplexityInputs(options, codebase);

  return {
    codebase,
    ...staticResults,
    ...observabilityResults,
    ...complexityResults,
  };
}
