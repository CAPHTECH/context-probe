import { ingestComplexityExportBundle } from "../analyzers/architecture-cti-ingest.js";
import { scoreComplexityTax } from "../analyzers/cti.js";
import type {
  ComplexityExportIngestResult,
  ComplexityScore,
  ComputeArchitectureScoresOptions,
} from "./architecture-scoring-types.js";
import type { CodebaseAnalysis } from "./contracts.js";

export interface ArchitectureScoringComplexityResults {
  complexityExportIngestResult?: ComplexityExportIngestResult;
  complexityScore: ComplexityScore;
}

export function resolveArchitectureScoringComplexityInputs(
  options: ComputeArchitectureScoresOptions,
  codebase: CodebaseAnalysis,
): ArchitectureScoringComplexityResults {
  const complexityExportBundle = options.complexityExport ?? options.complexitySource?.data;
  const complexityExportIngestResult = complexityExportBundle
    ? ingestComplexityExportBundle({
        bundle: complexityExportBundle,
        ...(options.constraints.complexity ? { existing: options.constraints.complexity } : {}),
      })
    : undefined;
  const complexityScore = scoreComplexityTax({
    codebase,
    constraints: complexityExportIngestResult
      ? {
          ...options.constraints,
          complexity: complexityExportIngestResult.complexity,
        }
      : options.constraints,
  });

  return {
    complexityScore,
    ...(complexityExportIngestResult ? { complexityExportIngestResult } : {}),
  };
}
