import {
  resolveComplexitySourceConfig,
  resolveContractBaselineSourceConfig,
  resolveDeliverySourceConfig,
  resolveScenarioObservationSourceConfig,
  resolveTelemetrySourceConfig,
} from "./analyzers/architecture-source-loader.js";
import { collectDirectInputProvenance } from "./command-architecture-inputs-provenance.js";
import type {
  ArchitectureComplexityExportBundle,
  ArchitectureComplexitySourceConfig,
  ArchitectureContractBaseline,
  ArchitectureContractBaselineSourceConfig,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliverySourceConfig,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetrySourceConfig,
  CommandContext,
  ScenarioObservationSet,
} from "./core/contracts.js";
import { toProvenance } from "./core/response.js";

export interface ResolvedArchitectureInputSources {
  contractBaselineSource?: Awaited<ReturnType<typeof resolveContractBaselineSourceConfig>> | undefined;
  scenarioObservationSource?: Awaited<ReturnType<typeof resolveScenarioObservationSourceConfig>> | undefined;
  telemetrySource?: Awaited<ReturnType<typeof resolveTelemetrySourceConfig>> | undefined;
  deliverySource?: Awaited<ReturnType<typeof resolveDeliverySourceConfig>> | undefined;
  complexitySource?: Awaited<ReturnType<typeof resolveComplexitySourceConfig>> | undefined;
  additionalProvenance: ReturnType<typeof toProvenance>[];
}

export async function resolveArchitectureInputSources(input: {
  args: Record<string, string | boolean>;
  context: CommandContext;
  scenarioObservations?: ScenarioObservationSet | undefined;
  scenarioObservationSourceConfig?:
    | { config: ArchitectureScenarioObservationSourceConfig; configPath: string }
    | undefined;
  contractBaseline?: ArchitectureContractBaseline | undefined;
  contractBaselineSourceConfig?: { config: ArchitectureContractBaselineSourceConfig; configPath: string } | undefined;
  deliveryObservations?: unknown | undefined;
  deliveryRawObservations?: unknown | undefined;
  deliveryExport?: ArchitectureDeliveryExportBundle | undefined;
  deliverySourceConfig?: { config: ArchitectureDeliverySourceConfig; configPath: string } | undefined;
  telemetryObservations?: unknown | undefined;
  telemetryRawObservations?: unknown | undefined;
  telemetryExport?: ArchitectureTelemetryExportBundle | undefined;
  telemetrySourceConfig?: { config: ArchitectureTelemetrySourceConfig; configPath: string } | undefined;
  complexityExport?: ArchitectureComplexityExportBundle | undefined;
  complexitySourceConfig?: { config: ArchitectureComplexitySourceConfig; configPath: string } | undefined;
}): Promise<ResolvedArchitectureInputSources> {
  const contractBaselineSource =
    !input.contractBaseline && input.contractBaselineSourceConfig
      ? await resolveContractBaselineSourceConfig(input.contractBaselineSourceConfig)
      : undefined;
  const scenarioObservationSource =
    !input.scenarioObservations && input.scenarioObservationSourceConfig
      ? await resolveScenarioObservationSourceConfig(input.scenarioObservationSourceConfig)
      : undefined;
  const telemetrySource =
    !input.telemetryObservations &&
    !input.telemetryRawObservations &&
    !input.telemetryExport &&
    input.telemetrySourceConfig
      ? await resolveTelemetrySourceConfig(input.telemetrySourceConfig)
      : undefined;
  const deliverySource =
    !input.deliveryObservations && !input.deliveryRawObservations && !input.deliveryExport && input.deliverySourceConfig
      ? await resolveDeliverySourceConfig(input.deliverySourceConfig)
      : undefined;
  const complexitySource =
    !input.complexityExport && input.complexitySourceConfig
      ? await resolveComplexitySourceConfig(input.complexitySourceConfig)
      : undefined;

  const additionalProvenance = [
    ...collectDirectInputProvenance(input.args, input.context),
    ...(contractBaselineSource
      ? [
          toProvenance(contractBaselineSource.configPath, "contract_baseline_source_config"),
          ...(contractBaselineSource.resolvedPath
            ? [toProvenance(contractBaselineSource.resolvedPath, "contract_baseline_source_file")]
            : []),
        ]
      : []),
    ...(scenarioObservationSource
      ? [
          toProvenance(scenarioObservationSource.configPath, "scenario_observation_source_config"),
          ...(scenarioObservationSource.resolvedPath
            ? [toProvenance(scenarioObservationSource.resolvedPath, "scenario_observation_source_file")]
            : []),
        ]
      : []),
    ...(telemetrySource
      ? [
          toProvenance(telemetrySource.configPath, "telemetry_source_config"),
          ...(telemetrySource.resolvedPath
            ? [toProvenance(telemetrySource.resolvedPath, "telemetry_source_file")]
            : []),
        ]
      : []),
    ...(deliverySource
      ? [
          toProvenance(deliverySource.configPath, "delivery_source_config"),
          ...(deliverySource.resolvedPath ? [toProvenance(deliverySource.resolvedPath, "delivery_source_file")] : []),
        ]
      : []),
    ...(complexitySource
      ? [
          toProvenance(complexitySource.configPath, "complexity_source_config"),
          ...(complexitySource.resolvedPath
            ? [toProvenance(complexitySource.resolvedPath, "complexity_source_file")]
            : []),
        ]
      : []),
  ];

  return {
    contractBaselineSource,
    scenarioObservationSource,
    telemetrySource,
    deliverySource,
    complexitySource,
    additionalProvenance,
  };
}
