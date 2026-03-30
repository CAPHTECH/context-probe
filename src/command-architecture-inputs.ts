import {
  resolveComplexitySourceConfig,
  resolveContractBaselineSourceConfig,
  resolveDeliverySourceConfig,
  resolveScenarioObservationSourceConfig,
  resolveTelemetrySourceConfig,
} from "./analyzers/architecture-source-loader.js";
import type { CommandArgs } from "./command-helpers.js";
import {
  getProfile,
  getRootPath,
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
  requireArchitectureConstraints,
} from "./command-helpers.js";
import type { ComputeArchitectureScoresOptions } from "./core/architecture-scoring-types.js";
import type { CommandContext } from "./core/contracts.js";
import { toProvenance } from "./core/response.js";

const DIRECT_ARCHITECTURE_INPUTS = [
  { argName: "scenario-catalog", note: "scenario_catalog_file" },
  { argName: "scenario-observations", note: "scenario_observations_file" },
  { argName: "topology-model", note: "topology_model_file" },
  { argName: "boundary-map", note: "boundary_map_file" },
  { argName: "contract-baseline", note: "contract_baseline_file" },
  { argName: "runtime-observations", note: "runtime_observations_file" },
  { argName: "delivery-observations", note: "delivery_observations_file" },
  { argName: "delivery-raw-observations", note: "delivery_raw_observations_file" },
  { argName: "delivery-export", note: "delivery_export_file" },
  { argName: "delivery-normalization-profile", note: "delivery_normalization_profile_file" },
  { argName: "telemetry-observations", note: "telemetry_observations_file" },
  { argName: "telemetry-raw-observations", note: "telemetry_raw_observations_file" },
  { argName: "telemetry-export", note: "telemetry_export_file" },
  { argName: "telemetry-normalization-profile", note: "telemetry_normalization_profile_file" },
  { argName: "pattern-runtime-observations", note: "pattern_runtime_observations_file" },
  { argName: "pattern-runtime-raw-observations", note: "pattern_runtime_raw_observations_file" },
  { argName: "pattern-runtime-normalization-profile", note: "pattern_runtime_normalization_profile_file" },
  { argName: "complexity-export", note: "complexity_export_file" },
] as const;

function collectDirectInputProvenance(args: CommandArgs, context: CommandContext) {
  return DIRECT_ARCHITECTURE_INPUTS.flatMap(({ argName, note }) => {
    const inputPath = args[argName];
    return typeof inputPath === "string"
      ? [toProvenance(new URL(inputPath, `file://${context.cwd}/`).pathname, note)]
      : [];
  });
}

export async function buildArchitectureScoreOptions(
  args: CommandArgs,
  context: CommandContext,
  policyConfig: ComputeArchitectureScoresOptions["policyConfig"],
): Promise<ComputeArchitectureScoresOptions> {
  const repoPath = getRootPath(args, context);
  const constraints = await requireArchitectureConstraints(args, context);
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
    deliveryNormalizationProfile,
    deliverySourceConfig,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetryNormalizationProfile,
    telemetrySourceConfig,
    patternRuntimeObservations,
    patternRuntimeRawObservations,
    patternRuntimeNormalizationProfile,
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

  const usableTelemetryRaw = Boolean(telemetryRawObservations && telemetryNormalizationProfile);
  const usableDeliveryRaw = Boolean(deliveryRawObservations && deliveryNormalizationProfile);
  const contractBaselineSource =
    !contractBaseline && contractBaselineSourceConfig
      ? await resolveContractBaselineSourceConfig(contractBaselineSourceConfig)
      : undefined;
  const scenarioObservationSource =
    !scenarioObservations && scenarioObservationSourceConfig
      ? await resolveScenarioObservationSourceConfig(scenarioObservationSourceConfig)
      : undefined;
  const telemetrySource =
    !telemetryObservations && !usableTelemetryRaw && !telemetryExport && telemetrySourceConfig
      ? await resolveTelemetrySourceConfig(telemetrySourceConfig)
      : undefined;
  const deliverySource =
    !deliveryObservations && !usableDeliveryRaw && !deliveryExport && deliverySourceConfig
      ? await resolveDeliverySourceConfig(deliverySourceConfig)
      : undefined;
  const complexitySource =
    !complexityExport && complexitySourceConfig
      ? await resolveComplexitySourceConfig(complexitySourceConfig)
      : undefined;

  const additionalProvenance = [
    ...collectDirectInputProvenance(args, context),
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
    repoPath,
    constraints,
    policyConfig,
    profileName: getProfile(args),
    ...(scenarioCatalog ? { scenarioCatalog } : {}),
    ...(scenarioObservations ? { scenarioObservations } : {}),
    ...(scenarioObservationSource ? { scenarioObservationSource } : {}),
    ...(topologyModel ? { topologyModel } : {}),
    ...(boundaryMap ? { boundaryMap } : {}),
    ...(contractBaseline ? { contractBaseline } : {}),
    ...(contractBaselineSource ? { contractBaselineSource } : {}),
    ...(runtimeObservations ? { runtimeObservations } : {}),
    ...(deliveryObservations ? { deliveryObservations } : {}),
    ...(deliveryRawObservations ? { deliveryRawObservations } : {}),
    ...(deliveryExport ? { deliveryExport } : {}),
    ...(deliverySource ? { deliverySource } : {}),
    ...(deliveryNormalizationProfile ? { deliveryNormalizationProfile } : {}),
    ...(telemetryObservations ? { telemetryObservations } : {}),
    ...(telemetryRawObservations ? { telemetryRawObservations } : {}),
    ...(telemetryExport ? { telemetryExport } : {}),
    ...(telemetrySource ? { telemetrySource } : {}),
    ...(telemetryNormalizationProfile ? { telemetryNormalizationProfile } : {}),
    ...(patternRuntimeObservations ? { patternRuntimeObservations } : {}),
    ...(patternRuntimeRawObservations ? { patternRuntimeRawObservations } : {}),
    ...(patternRuntimeNormalizationProfile ? { patternRuntimeNormalizationProfile } : {}),
    ...(complexityExport ? { complexityExport } : {}),
    ...(complexitySource ? { complexitySource } : {}),
    additionalProvenance,
    scenarioObservationSourceRequested: Boolean(scenarioObservationSourceConfig),
    telemetrySourceRequested: Boolean(telemetrySourceConfig),
    deliverySourceRequested: Boolean(deliverySourceConfig),
    complexitySourceRequested: Boolean(complexitySourceConfig),
    contractBaselineSourceRequested: Boolean(contractBaselineSourceConfig),
    patternRuntimeRawRequested: Boolean(patternRuntimeRawObservations),
    patternRuntimeNormalizationProfileRequested: Boolean(patternRuntimeNormalizationProfile),
  };
}
