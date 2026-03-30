import {
  loadBoundaryMapIfRequested,
  loadComplexityExportIfRequested,
  loadComplexitySourceConfigIfRequested,
  loadContractBaselineIfRequested,
  loadContractBaselineSourceConfigIfRequested,
  loadDeliveryExportIfRequested,
  loadDeliveryNormalizationProfileIfRequested,
  loadDeliveryObservationsIfRequested,
  loadDeliveryRawObservationsIfRequested,
  loadDeliverySourceConfigIfRequested,
  loadPatternRuntimeNormalizationProfileIfRequested,
  loadPatternRuntimeObservationsIfRequested,
  loadPatternRuntimeRawObservationsIfRequested,
  loadRuntimeObservationsIfRequested,
  loadScenarioCatalogIfRequested,
  loadScenarioObservationSourceConfigIfRequested,
  loadScenarioObservationsIfRequested,
  loadTelemetryExportIfRequested,
  loadTelemetryNormalizationProfileIfRequested,
  loadTelemetryObservationsIfRequested,
  loadTelemetryRawObservationsIfRequested,
  loadTelemetrySourceConfigIfRequested,
  loadTopologyModelIfRequested,
} from "./command-helpers.js";
import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureComplexitySourceConfig,
  ArchitectureContractBaseline,
  ArchitectureContractBaselineSourceConfig,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ArchitectureDeliverySourceConfig,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTelemetrySourceConfig,
  ArchitectureTopologyModel,
  CommandContext,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
} from "./core/contracts.js";

export interface LoadedArchitectureScoreInputs {
  scenarioCatalog?: ArchitectureScenarioCatalog | undefined;
  scenarioObservations?: ScenarioObservationSet | undefined;
  scenarioObservationSourceConfig?:
    | { config: ArchitectureScenarioObservationSourceConfig; configPath: string }
    | undefined;
  topologyModel?: ArchitectureTopologyModel | undefined;
  boundaryMap?: ArchitectureBoundaryMap | undefined;
  contractBaseline?: ArchitectureContractBaseline | undefined;
  contractBaselineSourceConfig?: { config: ArchitectureContractBaselineSourceConfig; configPath: string } | undefined;
  runtimeObservations?: TopologyRuntimeObservationSet | undefined;
  deliveryObservations?: ArchitectureDeliveryObservationSet | undefined;
  deliveryRawObservations?: ArchitectureDeliveryRawObservationSet | undefined;
  deliveryExport?: ArchitectureDeliveryExportBundle | undefined;
  deliveryNormalizationProfile?: ArchitectureDeliveryNormalizationProfile | undefined;
  deliverySourceConfig?: { config: ArchitectureDeliverySourceConfig; configPath: string } | undefined;
  telemetryObservations?: ArchitectureTelemetryObservationSet | undefined;
  telemetryRawObservations?: ArchitectureTelemetryRawObservationSet | undefined;
  telemetryExport?: ArchitectureTelemetryExportBundle | undefined;
  telemetryNormalizationProfile?: ArchitectureTelemetryNormalizationProfile | undefined;
  telemetrySourceConfig?: { config: ArchitectureTelemetrySourceConfig; configPath: string } | undefined;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet | undefined;
  patternRuntimeRawObservations?: ArchitecturePatternRuntimeRawObservationSet | undefined;
  patternRuntimeNormalizationProfile?: ArchitecturePatternRuntimeNormalizationProfile | undefined;
  complexityExport?: ArchitectureComplexityExportBundle | undefined;
  complexitySourceConfig?: { config: ArchitectureComplexitySourceConfig; configPath: string } | undefined;
}

export async function loadArchitectureScoreInputs(
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<LoadedArchitectureScoreInputs> {
  const [
    scenarioCatalog,
    scenarioObservations,
    scenarioObservationSourceConfig,
    topologyModel,
    boundaryMap,
    contractBaseline,
    contractBaselineSourceConfig,
    runtimeObservations,
    deliveryObservations,
    deliveryRawObservations,
    deliveryExport,
    deliveryNormalizationProfileResult,
    deliverySourceConfig,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetryNormalizationProfileResult,
    telemetrySourceConfig,
    patternRuntimeObservations,
    patternRuntimeRawObservations,
    patternRuntimeNormalizationProfileResult,
    complexityExport,
    complexitySourceConfig,
  ] = await Promise.all([
    loadScenarioCatalogIfRequested(args, context),
    loadScenarioObservationsIfRequested(args, context),
    loadScenarioObservationSourceConfigIfRequested(args, context),
    loadTopologyModelIfRequested(args, context),
    loadBoundaryMapIfRequested(args, context),
    loadContractBaselineIfRequested(args, context),
    loadContractBaselineSourceConfigIfRequested(args, context),
    loadRuntimeObservationsIfRequested(args, context),
    loadDeliveryObservationsIfRequested(args, context),
    loadDeliveryRawObservationsIfRequested(args, context),
    loadDeliveryExportIfRequested(args, context),
    loadDeliveryNormalizationProfileIfRequested(args, context),
    loadDeliverySourceConfigIfRequested(args, context),
    loadTelemetryObservationsIfRequested(args, context),
    loadTelemetryRawObservationsIfRequested(args, context),
    loadTelemetryExportIfRequested(args, context),
    loadTelemetryNormalizationProfileIfRequested(args, context),
    loadTelemetrySourceConfigIfRequested(args, context),
    loadPatternRuntimeObservationsIfRequested(args, context),
    loadPatternRuntimeRawObservationsIfRequested(args, context),
    loadPatternRuntimeNormalizationProfileIfRequested(args, context),
    loadComplexityExportIfRequested(args, context),
    loadComplexitySourceConfigIfRequested(args, context),
  ]);

  return {
    scenarioCatalog,
    scenarioObservations,
    scenarioObservationSourceConfig,
    topologyModel,
    boundaryMap,
    contractBaseline,
    contractBaselineSourceConfig,
    runtimeObservations,
    deliveryObservations,
    deliveryRawObservations,
    deliveryExport,
    deliveryNormalizationProfile: deliveryNormalizationProfileResult?.config,
    deliverySourceConfig,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetryNormalizationProfile: telemetryNormalizationProfileResult?.config,
    telemetrySourceConfig,
    patternRuntimeObservations,
    patternRuntimeRawObservations,
    patternRuntimeNormalizationProfile: patternRuntimeNormalizationProfileResult?.config,
    complexityExport,
    complexitySourceConfig,
  };
}
