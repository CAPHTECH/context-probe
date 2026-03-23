import type {
  ArchitectureComplexityExportBundle,
  ArchitectureComplexityMetadata
} from "../core/contracts.js";

export interface ComplexityExportIngestFinding {
  kind: "complexity_export_metric_mapped" | "complexity_export_metric_missing";
  confidence: number;
  note: string;
  component: keyof ArchitectureComplexityExportBundle["metrics"];
  observed?: number;
  sourceSystem?: string;
}

export interface IngestedComplexityExport {
  complexity: ArchitectureComplexityMetadata;
  confidence: number;
  unknowns: string[];
  findings: ComplexityExportIngestFinding[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function ingestComplexityExportBundle(input: {
  bundle: ArchitectureComplexityExportBundle;
  existing?: ArchitectureComplexityMetadata;
}): IngestedComplexityExport {
  const findings: ComplexityExportIngestFinding[] = [];
  const unknowns: string[] = [];
  const confidenceSignals: number[] = [];
  const metrics = input.bundle.metrics;

  const mappings = [
    "teamCount",
    "deployableCount",
    "pipelineCount",
    "contractOrSchemaCount",
    "serviceCount",
    "serviceGroupCount",
    "datastoreCount",
    "onCallSurface",
    "syncDepthP95",
    "runCostPerBusinessTransaction"
  ] as const;

  for (const component of mappings) {
    const observed = metrics[component];
    if (observed === undefined) {
      unknowns.push(`The complexity export is missing ${component}.`);
      findings.push({
        kind: "complexity_export_metric_missing",
        confidence: 0.62,
        note: `The complexity export is missing ${component}.`,
        component,
        ...(input.bundle.sourceSystem ? { sourceSystem: input.bundle.sourceSystem } : {})
      });
      confidenceSignals.push(0.55);
      continue;
    }
    findings.push({
      kind: "complexity_export_metric_mapped",
      confidence: 0.84,
      note: `Imported ${component} from the complexity export into CTI metadata.`,
      component,
      observed,
      ...(input.bundle.sourceSystem ? { sourceSystem: input.bundle.sourceSystem } : {})
    });
    confidenceSignals.push(0.84);
  }

  return {
    complexity: {
      ...(input.existing ?? {}),
      ...metrics,
      ...(input.existing?.normalization ? { normalization: input.existing.normalization } : {})
    },
    confidence: clamp01(average(confidenceSignals, 0.6)),
    unknowns: unique(unknowns),
    findings
  };
}
