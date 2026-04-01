import type { detectDirectionViolations, scoreDependencyDirection } from "../analyzers/architecture.js";
import type { scoreInterfaceProtocolStability } from "../analyzers/architecture-contracts.js";
import type { ingestComplexityExportBundle } from "../analyzers/architecture-cti-ingest.js";
import type { normalizeDeliveryObservations } from "../analyzers/architecture-delivery-normalization.js";
import type {
  scoreArchitectureEvolutionEfficiency,
  scoreArchitectureEvolutionLocality,
} from "../analyzers/architecture-evolution.js";
import type {
  ingestDeliveryExportBundle,
  ingestTelemetryExportBundle,
} from "../analyzers/architecture-observation-ingest.js";
import type { scoreOperationalAdequacy } from "../analyzers/architecture-operations.js";
import type { normalizePatternRuntimeObservations } from "../analyzers/architecture-pattern-runtime-normalization.js";
import type { scoreBoundaryPurity } from "../analyzers/architecture-purity.js";
import type { scoreQualityScenarioFit } from "../analyzers/architecture-scenarios.js";
import type { ResolvedCanonicalSource } from "../analyzers/architecture-source-loader.js";
import type { normalizeTelemetryObservations } from "../analyzers/architecture-telemetry-normalization.js";
import type { scoreTopologyIsolation } from "../analyzers/architecture-topology.js";
import type { scoreComplexityTax } from "../analyzers/cti.js";
import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureConstraints,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureScenarioQualitySummary,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTopologyModel,
  CochangeCommit,
  LocalityWatchlistItem,
  PolicyConfig,
  ProvenanceRef,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
} from "./contracts.js";
import type { getDomainPolicy } from "./policy.js";

export interface ComputeArchitectureScoresOptions {
  repoPath: string;
  constraints: ArchitectureConstraints;
  policyConfig: PolicyConfig;
  profileName: string;
  scenarioCatalog?: ArchitectureScenarioCatalog;
  scenarioObservations?: ScenarioObservationSet;
  scenarioObservationSource?: ResolvedCanonicalSource<ScenarioObservationSet>;
  scenarioObservationSourceRequested?: boolean;
  topologyModel?: ArchitectureTopologyModel;
  boundaryMap?: ArchitectureBoundaryMap;
  contractBaseline?: ArchitectureContractBaseline;
  contractBaselineSource?: ResolvedCanonicalSource<ArchitectureContractBaseline>;
  contractBaselineSourceRequested?: boolean;
  runtimeObservations?: TopologyRuntimeObservationSet;
  deliveryObservations?: ArchitectureDeliveryObservationSet;
  deliveryRawObservations?: ArchitectureDeliveryRawObservationSet;
  deliveryExport?: ArchitectureDeliveryExportBundle;
  deliverySource?: ResolvedCanonicalSource<ArchitectureDeliveryExportBundle>;
  deliverySourceRequested?: boolean;
  deliveryNormalizationProfile?: ArchitectureDeliveryNormalizationProfile;
  telemetryObservations?: ArchitectureTelemetryObservationSet;
  telemetryRawObservations?: ArchitectureTelemetryRawObservationSet;
  telemetryExport?: ArchitectureTelemetryExportBundle;
  telemetrySource?: ResolvedCanonicalSource<ArchitectureTelemetryExportBundle>;
  telemetrySourceRequested?: boolean;
  telemetryNormalizationProfile?: ArchitectureTelemetryNormalizationProfile;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet;
  patternRuntimeRawObservations?: ArchitecturePatternRuntimeRawObservationSet;
  patternRuntimeRawRequested?: boolean;
  patternRuntimeNormalizationProfile?: ArchitecturePatternRuntimeNormalizationProfile;
  patternRuntimeNormalizationProfileRequested?: boolean;
  complexityExport?: ArchitectureComplexityExportBundle;
  complexitySource?: ResolvedCanonicalSource<ArchitectureComplexityExportBundle>;
  complexitySourceRequested?: boolean;
  additionalProvenance?: ProvenanceRef[];
}

export type ArchitecturePolicy = ReturnType<typeof getDomainPolicy>;
export type DirectionScore = ReturnType<typeof scoreDependencyDirection>;
export type ArchitectureViolations = ReturnType<typeof detectDirectionViolations>;
export type PurityScore = ReturnType<typeof scoreBoundaryPurity>;
export type ProtocolScore = Awaited<ReturnType<typeof scoreInterfaceProtocolStability>>;
export type ScenarioScore = ReturnType<typeof scoreQualityScenarioFit>;
export type TopologyScore = ReturnType<typeof scoreTopologyIsolation>;
export type TelemetryExportIngestResult = ReturnType<typeof ingestTelemetryExportBundle>;
export type PatternRuntimeNormalizationResult = ReturnType<typeof normalizePatternRuntimeObservations>;
export type TelemetryNormalizationResult = ReturnType<typeof normalizeTelemetryObservations>;
export type OperationsScore = ReturnType<typeof scoreOperationalAdequacy>;
export type DeliveryExportIngestResult = ReturnType<typeof ingestDeliveryExportBundle>;
export type DeliveryNormalizationResult = ReturnType<typeof normalizeDeliveryObservations>;
export type ComplexityExportIngestResult = ReturnType<typeof ingestComplexityExportBundle>;
export type ComplexityScore = ReturnType<typeof scoreComplexityTax>;
export type EvolutionLocalityScore = ReturnType<typeof scoreArchitectureEvolutionLocality>;
export type EvolutionEfficiencyScore = ReturnType<typeof scoreArchitectureEvolutionEfficiency>;

export interface ArchitectureScoringContext {
  directionScore: DirectionScore;
  purityScore: PurityScore;
  protocolScore: ProtocolScore;
  scenarioScore: ScenarioScore;
  topologyScore: TopologyScore;
  telemetryExportIngestResult?: TelemetryExportIngestResult;
  patternRuntimeNormalizationResult?: PatternRuntimeNormalizationResult;
  telemetryNormalizationResult?: TelemetryNormalizationResult;
  operationsScore: OperationsScore;
  deliveryExportIngestResult?: DeliveryExportIngestResult;
  deliveryNormalizationResult?: DeliveryNormalizationResult;
  complexityExportIngestResult?: ComplexityExportIngestResult;
  complexityScore: ComplexityScore;
  architectureCommits: CochangeCommit[];
  architectureHistoryDiagnostics: string[];
  evolutionLocalityScore: EvolutionLocalityScore;
  evolutionEfficiencyScore: EvolutionEfficiencyScore;
  localityValue: number;
  localityWatchlist: LocalityWatchlistItem[];
  scenarioQuality?: ArchitectureScenarioQualitySummary;
  violations: ArchitectureViolations;
  usablePatternRuntimeRaw: boolean;
}
