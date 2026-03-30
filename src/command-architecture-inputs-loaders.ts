import { loadArchitectureInputSourceConfigs } from "./command-architecture-inputs-loaders-config.js";
import { loadArchitectureInputData } from "./command-architecture-inputs-loaders-data.js";
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
  scenarioObservationSourceConfig?:
    | { config: ArchitectureScenarioObservationSourceConfig; configPath: string }
    | undefined;
  contractBaselineSourceConfig?: { config: ArchitectureContractBaselineSourceConfig; configPath: string } | undefined;
  deliverySourceConfig?: { config: ArchitectureDeliverySourceConfig; configPath: string } | undefined;
  telemetrySourceConfig?: { config: ArchitectureTelemetrySourceConfig; configPath: string } | undefined;
  complexitySourceConfig?: { config: ArchitectureComplexitySourceConfig; configPath: string } | undefined;
}

export async function loadArchitectureScoreInputs(
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<LoadedArchitectureScoreInputs> {
  const [data, sourceConfigs] = await Promise.all([
    loadArchitectureInputData(args, context),
    loadArchitectureInputSourceConfigs(args, context),
  ]);

  return {
    ...data,
    ...sourceConfigs,
  };
}
