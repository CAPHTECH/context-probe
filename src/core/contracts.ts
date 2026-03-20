export const OUTPUT_VERSION = "1.0";

export type CommandStatus = "ok" | "warning" | "error";
export type ScanMode =
  | "full_scan"
  | "diff_scan"
  | "candidate_compare"
  | "baseline_compare"
  | "trend";

export interface ProvenanceRef {
  artifactId?: string;
  path?: string;
  line?: number;
  fragmentId?: string;
  revision?: string;
  note?: string;
}

export interface Evidence {
  evidenceId: string;
  type: string;
  statement: string;
  confidence: number;
  linkedEntities?: string[];
  source: Record<string, unknown>;
}

export type ExtractionKind = "glossary" | "rules" | "invariants";
export type ExtractionBackend = "heuristic" | "cli";
export type ExtractionProviderName = "codex" | "claude";

export interface ExtractionMetadata {
  extractor: ExtractionBackend;
  provider?: ExtractionProviderName;
  promptProfile: string;
  fallback: "heuristic" | "none";
}

export interface CommandResponse<T = unknown> {
  status: CommandStatus;
  result: T;
  evidence: Evidence[];
  confidence: number;
  unknowns: string[];
  diagnostics: string[];
  provenance: ProvenanceRef[];
  version: string;
}

export interface Artifact {
  artifactId: string;
  type: "document" | "source_code" | "history" | "config" | "unknown";
  path: string;
  size: number;
  hash: string;
  collectedAt: string;
}

export interface Fragment {
  fragmentId: string;
  artifactId: string;
  kind: "paragraph" | "heading";
  text: string;
  path: string;
  lineStart: number;
  lineEnd: number;
}

export interface ContextDefinition {
  name: string;
  pathGlobs: string[];
  contractGlobs?: string[];
  internalGlobs?: string[];
}

export interface DomainModel {
  version: string;
  contexts: ContextDefinition[];
}

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

export interface TelemetryNormalizationRule {
  direction: ScenarioDirection;
  target: number;
  worstAcceptable: number;
}

export interface ArchitectureTelemetryNormalizationProfile {
  version: string;
  signals: Partial<
    Record<
      "LatencyScore" | "ErrorScore" | "SaturationScore",
      TelemetryNormalizationRule
    >
  >;
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

export interface ArchitectureConstraints {
  version: string;
  direction?: "inward";
  layers: LayerDefinition[];
  complexity?: ArchitectureComplexityMetadata;
}

export interface FileDependency {
  source: string;
  target: string;
  specifier: string;
  targetKind: "file" | "external" | "missing";
}

export interface ParsedSourceFile {
  path: string;
  imports: FileDependency[];
}

export interface CodebaseAnalysis {
  files: ParsedSourceFile[];
  dependencies: FileDependency[];
  sourceFiles: string[];
}

export interface ContractUsageReport {
  adherence: number;
  applicableReferences: number;
  compliantReferences: number;
  findings: Array<{
    source: string;
    target: string;
    sourceContext: string;
    targetContext: string;
    targetClassification: "contract" | "internal" | "unclassified";
  }>;
}

export interface BoundaryLeakFinding {
  findingId: string;
  severity: "low" | "medium" | "high";
  sourceContext: string;
  targetContext: string;
  violationType: string;
  sourceSymbol: string;
  targetSymbol: string;
  path: string;
  line?: number;
}

export interface CochangeCommit {
  hash: string;
  subject: string;
  files: string[];
}

export interface CochangeAnalysis {
  commits: CochangeCommit[];
  crossContextCommits: number;
  localCommits: number;
  averageContextsPerCommit: number;
  surpriseCouplingRatio: number;
  crossContextChangeLocality: number;
  featureScatter: number;
  contextsSeen: string[];
}

export interface MetricThresholds {
  warn?: number;
  fail?: number;
}

export interface MetricPolicy {
  formula: string;
  thresholds?: MetricThresholds;
}

export interface DomainPolicy {
  metrics: Record<string, MetricPolicy>;
  review?: {
    require_human_if?: string[];
  };
}

export interface PolicyConfig {
  profiles: Record<
    string,
    {
      domains: Record<string, DomainPolicy>;
      history_filters?: {
        ignore_commit_patterns?: string[];
        ignore_paths?: string[];
      };
    }
  >;
}

export interface GlossaryTerm {
  termId: string;
  canonicalTerm: string;
  aliases: string[];
  count: number;
  collision: boolean;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
}

export interface RuleCandidate {
  ruleId: string;
  type: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
  relatedTerms?: string[];
}

export interface InvariantCandidate {
  invariantId: string;
  type: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
  relatedTerms?: string[];
}

export interface ExtractionProviderResult<T> {
  items: T[];
  confidence: number;
  unknowns: string[];
  diagnostics: string[];
  provider: ExtractionProviderName;
}

export interface TraceLinkOccurrence {
  kind: "document" | "code";
  path: string;
  fragmentId?: string;
  matchCount: number;
}

export interface TermTraceLink {
  termId: string;
  canonicalTerm: string;
  occurrences: TraceLinkOccurrence[];
  coverage: {
    documentHits: number;
    codeHits: number;
  };
  confidence: number;
}

export interface ModelCodeLink {
  context: string;
  files: string[];
  counts: {
    contract: number;
    internal: number;
    unclassified: number;
  };
  coverage: number;
}

export interface MetricScore {
  metricId: string;
  value: number;
  components: Record<string, number>;
  confidence: number;
  evidenceRefs: string[];
  unknowns: string[];
}

export interface ReviewItem {
  reviewItemId: string;
  reason: string;
  summary: string;
  confidence: number;
  evidenceRefs: string[];
  targetEntityId?: string;
  suggestedPatch?: Record<string, unknown>;
}

export interface ReviewResolution {
  reviewItemId: string;
  status: string;
  decision?: {
    patch?: Record<string, unknown>;
  };
  note?: string;
  reviewedAt?: string;
}

export interface ResolvedReviewItem extends ReviewItem {
  resolution?: ReviewResolution | null;
}

export interface ReviewResolutionLog {
  reviewItems: ResolvedReviewItem[];
  overrides: Array<{
    targetEntityId: string;
    patch: Record<string, unknown>;
    reason: string;
  }>;
}

export interface DomainPack {
  id: string;
  version: string;
  commands: string[];
  metrics: string[];
  reviewRules: string[];
}

export interface CommandContext {
  cwd: string;
}
