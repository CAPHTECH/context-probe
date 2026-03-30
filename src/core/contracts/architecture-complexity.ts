import type { ArchitectureCanonicalSourceConfig } from "./architecture-scenarios.js";

export interface ArchitectureComplexityExportBundle {
  version: string;
  sourceSystem?: string;
  metrics: {
    teamCount?: number;
    deployableCount?: number;
    pipelineCount?: number;
    contractOrSchemaCount?: number;
    serviceCount?: number;
    serviceGroupCount?: number;
    datastoreCount?: number;
    onCallSurface?: number;
    syncDepthP95?: number;
    runCostPerBusinessTransaction?: number;
  };
  note?: string;
}

export interface ArchitectureComplexitySourceConfig extends ArchitectureCanonicalSourceConfig {}
