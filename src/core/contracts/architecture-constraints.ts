import type { Evidence } from "./common.js";

export interface LayerDefinition {
  name: string;
  rank: number;
  globs: string[];
}

export type ComplexityTaxComponentName =
  | "DeployablesPerTeam"
  | "PipelinesPerDeployable"
  | "ContractsOrSchemasPerService"
  | "DatastoresPerServiceGroup"
  | "OnCallSurface"
  | "SyncDepthOverhead"
  | "RunCostPerBusinessTransaction";

export interface ComplexityTaxBaseline {
  target?: number;
  worst?: number;
}

export interface ArchitectureComplexityMetadata {
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
  normalization?: Partial<Record<ComplexityTaxComponentName, ComplexityTaxBaseline>>;
}

export interface ArchitectureConstraints {
  version: string;
  direction?: "inward";
  layers: LayerDefinition[];
  complexity?: ArchitectureComplexityMetadata;
}

export interface ArchitectureLayerCandidate {
  definition: LayerDefinition;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
}

export interface ArchitectureConstraintsScaffoldResult {
  constraints: ArchitectureConstraints;
  yaml: string;
  layers: ArchitectureLayerCandidate[];
  complexityCandidate?: ArchitectureComplexityMetadata;
}
