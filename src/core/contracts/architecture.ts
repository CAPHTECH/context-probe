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

export type ScenarioDirection = "lower_is_better" | "higher_is_better";

export interface ArchitectureScenario {
  scenarioId: string;
  name?: string;
  qualityAttribute?: string;
  stimulus?: string;
  environment?: string;
  response?: string;
  responseMeasure?: {
    metric?: string;
    unit?: string;
  };
  direction: ScenarioDirection;
  priority: number;
  target: number;
  worstAcceptable: number;
}

export interface ArchitectureScenarioCatalog {
  version: string;
  scenarios: ArchitectureScenario[];
}

export interface ScenarioObservation {
  scenarioId: string;
  observed: number;
  source?: string;
  note?: string;
}

export interface ScenarioObservationSet {
  version: string;
  observations: ScenarioObservation[];
}

export type ArchitectureSourceType = "file" | "command";

export interface ArchitectureCanonicalSourceConfig {
  version: string;
  sourceType: ArchitectureSourceType;
  path?: string;
  command?: string;
  cwd?: string;
  note?: string;
}

export interface ArchitectureScenarioObservationSourceConfig extends ArchitectureCanonicalSourceConfig {}

export interface ArchitectureTopologyNode {
  nodeId: string;
  kind: "service" | "datastore" | "queue" | "cache" | "gateway" | "worker" | "unknown";
  isolationBoundary?: string;
}

export interface ArchitectureTopologyEdge {
  source: string;
  target: string;
  kind: "sync_call" | "async_message" | "shared_resource" | "runtime_dependency";
  shared?: boolean;
}

export interface ArchitectureTopologyModel {
  version: string;
  nodes: ArchitectureTopologyNode[];
  edges: ArchitectureTopologyEdge[];
}

export interface TopologyRuntimeObservation {
  nodeId?: string;
  failureContainmentRatio?: number;
  runtimeContainment?: number;
  sharedDependencyIncidentRate?: number;
  note?: string;
}

export interface TopologyRuntimeObservationSet {
  version: string;
  observations: TopologyRuntimeObservation[];
}

export interface ArchitectureBoundaryDefinition {
  name: string;
  pathGlobs: string[];
}

export interface ArchitectureBoundaryMap {
  version: string;
  boundaries: ArchitectureBoundaryDefinition[];
}

export interface ArchitectureContractBaselineSnapshot {
  sourceKind?: string;
  capturedAt?: string;
  note?: string;
}

export type ArchitectureContractBaselineSymbolKind =
  | "interface"
  | "type_alias"
  | "enum"
  | "class"
  | "function"
  | "value"
  | "default_export"
  | "unknown";

export type ArchitectureContractBaselineSymbolStability = "stable" | "risky";
export type ArchitectureContractBaselineSymbolLooseness = "strict" | "loose";

export interface ArchitectureContractBaselineSymbol {
  name: string;
  kind: ArchitectureContractBaselineSymbolKind;
  stability: ArchitectureContractBaselineSymbolStability;
  looseness: ArchitectureContractBaselineSymbolLooseness;
}

export interface ArchitectureContractBaselineImportStats {
  total: number;
  nonContract: number;
  internal: number;
}

export interface ArchitectureContractBaselineEntry {
  path: string;
  symbols: ArchitectureContractBaselineSymbol[];
  imports?: ArchitectureContractBaselineImportStats;
}

export interface ArchitectureContractBaseline {
  version: string;
  snapshot?: ArchitectureContractBaselineSnapshot;
  contracts: ArchitectureContractBaselineEntry[];
  note?: string;
}

export interface ArchitectureContractBaselineSourceConfig extends ArchitectureCanonicalSourceConfig {}

export interface ArchitectureDeliveryObservationSet {
  version: string;
  scores: {
    LeadTimeScore?: number;
    DeployFreqScore?: number;
    RecoveryScore?: number;
    ChangeFailScore?: number;
    ReworkScore?: number;
  };
}

export interface ArchitectureDeliveryRawObservationSet {
  version: string;
  values: {
    LeadTime?: number;
    DeployFrequency?: number;
    RecoveryTime?: number;
    ChangeFailRate?: number;
    ReworkRate?: number;
  };
  source?: string;
  note?: string;
}

export interface ArchitectureDeliveryExportBundle {
  version: string;
  sourceSystem?: string;
  measurements: {
    leadTime?: number;
    deployFrequency?: number;
    recoveryTime?: number;
    changeFailRate?: number;
    reworkRate?: number;
  };
  note?: string;
}

export interface ArchitectureDeliverySourceConfig extends ArchitectureCanonicalSourceConfig {}

export interface TelemetryNormalizationRule {
  direction: ScenarioDirection;
  target: number;
  worstAcceptable: number;
}

export interface ArchitectureDeliveryNormalizationProfile {
  version: string;
  signals: Partial<
    Record<
      "LeadTime" | "DeployFrequency" | "RecoveryTime" | "ChangeFailRate" | "ReworkRate",
      TelemetryNormalizationRule
    >
  >;
}

export interface ArchitectureTelemetryBandObservation {
  bandId: string;
  trafficWeight: number;
  LatencyScore?: number;
  ErrorScore?: number;
  SaturationScore?: number;
}

export interface ArchitectureTelemetryObservationSet {
  version: string;
  bands: ArchitectureTelemetryBandObservation[];
}

export interface ArchitectureTelemetryRawBandObservation {
  bandId: string;
  trafficWeight: number;
  latencyP95?: number;
  errorRate?: number;
  saturationRatio?: number;
}

export interface ArchitectureTelemetryRawObservationSet {
  version: string;
  bands: ArchitectureTelemetryRawBandObservation[];
}

export interface ArchitectureTelemetryExportBand {
  bandId: string;
  trafficWeight: number;
  latencyP95?: number;
  errorRate?: number;
  saturationRatio?: number;
  source?: string;
  window?: string;
}

export interface ArchitectureTelemetryExportBundle {
  version: string;
  sourceSystem?: string;
  bands: ArchitectureTelemetryExportBand[];
  patternRuntime?: ArchitecturePatternRuntimeObservationSet;
  note?: string;
}

export interface ArchitectureTelemetrySourceConfig extends ArchitectureCanonicalSourceConfig {}

export interface ArchitectureTelemetryNormalizationProfile {
  version: string;
  signals: Partial<Record<"LatencyScore" | "ErrorScore" | "SaturationScore", TelemetryNormalizationRule>>;
}

export type ArchitecturePatternFamily =
  | "layered"
  | "clean"
  | "hexagonal"
  | "modular-monolith"
  | "microservices"
  | "cqrs"
  | "event-driven";

export interface LayeredPatternRuntimeObservationSet {
  FailureContainmentScore?: number;
  DependencyIsolationScore?: number;
}

export interface ServiceBasedPatternRuntimeObservationSet {
  PartialFailureContainmentScore?: number;
  RetryAmplificationScore?: number;
  SyncHopDepthScore?: number;
}

export interface CqrsPatternRuntimeObservationSet {
  ProjectionFreshnessScore?: number;
  ReplayDivergenceScore?: number;
  StaleReadAcceptabilityScore?: number;
}

export interface EventDrivenPatternRuntimeObservationSet {
  DeadLetterHealthScore?: number;
  ConsumerLagScore?: number;
  ReplayRecoveryScore?: number;
}

export interface LayeredPatternRuntimeRawObservationSet {
  FailureContainment?: number;
  DependencyIsolation?: number;
}

export interface ServiceBasedPatternRuntimeRawObservationSet {
  PartialFailureContainment?: number;
  RetryAmplification?: number;
  SyncHopDepth?: number;
}

export interface CqrsPatternRuntimeRawObservationSet {
  ProjectionFreshness?: number;
  ReplayDivergence?: number;
  StaleReadAcceptability?: number;
}

export interface EventDrivenPatternRuntimeRawObservationSet {
  DeadLetterHealth?: number;
  ConsumerLag?: number;
  ReplayRecovery?: number;
}

export interface ArchitecturePatternRuntimeObservationSet {
  version: string;
  patternFamily?: ArchitecturePatternFamily;
  layeredRuntime?: LayeredPatternRuntimeObservationSet;
  serviceBasedRuntime?: ServiceBasedPatternRuntimeObservationSet;
  cqrsRuntime?: CqrsPatternRuntimeObservationSet;
  eventDrivenRuntime?: EventDrivenPatternRuntimeObservationSet;
  score?: number;
  metrics?: Record<string, number>;
  source?: string;
  note?: string;
}

export interface ArchitecturePatternRuntimeRawObservationSet {
  version: string;
  patternFamily?: ArchitecturePatternFamily;
  layeredRuntime?: LayeredPatternRuntimeRawObservationSet;
  serviceBasedRuntime?: ServiceBasedPatternRuntimeRawObservationSet;
  cqrsRuntime?: CqrsPatternRuntimeRawObservationSet;
  eventDrivenRuntime?: EventDrivenPatternRuntimeRawObservationSet;
  source?: string;
  note?: string;
}

export interface ArchitecturePatternRuntimeNormalizationProfile {
  version: string;
  layeredRuntime?: Partial<Record<"FailureContainment" | "DependencyIsolation", TelemetryNormalizationRule>>;
  serviceBasedRuntime?: Partial<
    Record<"PartialFailureContainment" | "RetryAmplification" | "SyncHopDepth", TelemetryNormalizationRule>
  >;
  cqrsRuntime?: Partial<
    Record<"ProjectionFreshness" | "ReplayDivergence" | "StaleReadAcceptability", TelemetryNormalizationRule>
  >;
  eventDrivenRuntime?: Partial<
    Record<"DeadLetterHealth" | "ConsumerLag" | "ReplayRecovery", TelemetryNormalizationRule>
  >;
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
