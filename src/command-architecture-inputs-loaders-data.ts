import {
  loadBoundaryMapIfRequested,
  loadComplexityExportIfRequested,
  loadContractBaselineIfRequested,
  loadDeliveryExportIfRequested,
  loadDeliveryNormalizationProfileIfRequested,
  loadDeliveryObservationsIfRequested,
  loadDeliveryRawObservationsIfRequested,
  loadPatternRuntimeNormalizationProfileIfRequested,
  loadPatternRuntimeObservationsIfRequested,
  loadPatternRuntimeRawObservationsIfRequested,
  loadRuntimeObservationsIfRequested,
  loadScenarioCatalogIfRequested,
  loadScenarioObservationsIfRequested,
  loadTelemetryExportIfRequested,
  loadTelemetryNormalizationProfileIfRequested,
  loadTelemetryObservationsIfRequested,
  loadTelemetryRawObservationsIfRequested,
  loadTopologyModelIfRequested,
} from "./command-helpers.js";
import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTopologyModel,
  CommandContext,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
} from "./core/contracts.js";

export interface LoadedArchitectureInputData {
  scenarioCatalog?: ArchitectureScenarioCatalog | undefined;
  scenarioObservations?: ScenarioObservationSet | undefined;
  topologyModel?: ArchitectureTopologyModel | undefined;
  boundaryMap?: ArchitectureBoundaryMap | undefined;
  contractBaseline?: ArchitectureContractBaseline | undefined;
  runtimeObservations?: TopologyRuntimeObservationSet | undefined;
  deliveryObservations?: ArchitectureDeliveryObservationSet | undefined;
  deliveryRawObservations?: ArchitectureDeliveryRawObservationSet | undefined;
  deliveryExport?: ArchitectureDeliveryExportBundle | undefined;
  deliveryNormalizationProfile?: ArchitectureDeliveryNormalizationProfile | undefined;
  telemetryObservations?: ArchitectureTelemetryObservationSet | undefined;
  telemetryRawObservations?: ArchitectureTelemetryRawObservationSet | undefined;
  telemetryExport?: ArchitectureTelemetryExportBundle | undefined;
  telemetryNormalizationProfile?: ArchitectureTelemetryNormalizationProfile | undefined;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet | undefined;
  patternRuntimeRawObservations?: ArchitecturePatternRuntimeRawObservationSet | undefined;
  patternRuntimeNormalizationProfile?: ArchitecturePatternRuntimeNormalizationProfile | undefined;
  complexityExport?: ArchitectureComplexityExportBundle | undefined;
}

export async function loadArchitectureInputData(
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<LoadedArchitectureInputData> {
  const [
    scenarioCatalog,
    scenarioObservations,
    topologyModel,
    boundaryMap,
    contractBaseline,
    runtimeObservations,
    deliveryObservations,
    deliveryRawObservations,
    deliveryExport,
    deliveryNormalizationProfileResult,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetryNormalizationProfileResult,
    patternRuntimeObservations,
    patternRuntimeRawObservations,
    patternRuntimeNormalizationProfileResult,
    complexityExport,
  ] = await Promise.all([
    loadScenarioCatalogIfRequested(args, context),
    loadScenarioObservationsIfRequested(args, context),
    loadTopologyModelIfRequested(args, context),
    loadBoundaryMapIfRequested(args, context),
    loadContractBaselineIfRequested(args, context),
    loadRuntimeObservationsIfRequested(args, context),
    loadDeliveryObservationsIfRequested(args, context),
    loadDeliveryRawObservationsIfRequested(args, context),
    loadDeliveryExportIfRequested(args, context),
    loadDeliveryNormalizationProfileIfRequested(args, context),
    loadTelemetryObservationsIfRequested(args, context),
    loadTelemetryRawObservationsIfRequested(args, context),
    loadTelemetryExportIfRequested(args, context),
    loadTelemetryNormalizationProfileIfRequested(args, context),
    loadPatternRuntimeObservationsIfRequested(args, context),
    loadPatternRuntimeRawObservationsIfRequested(args, context),
    loadPatternRuntimeNormalizationProfileIfRequested(args, context),
    loadComplexityExportIfRequested(args, context),
  ]);

  return {
    scenarioCatalog,
    scenarioObservations,
    topologyModel,
    boundaryMap,
    contractBaseline,
    runtimeObservations,
    deliveryObservations,
    deliveryRawObservations,
    deliveryExport,
    deliveryNormalizationProfile: deliveryNormalizationProfileResult?.config,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetryNormalizationProfile: telemetryNormalizationProfileResult?.config,
    patternRuntimeObservations,
    patternRuntimeRawObservations,
    patternRuntimeNormalizationProfile: patternRuntimeNormalizationProfileResult?.config,
    complexityExport,
  };
}
