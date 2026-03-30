import { loadArchitectureScoreInputs } from "./command-architecture-inputs-loaders.js";
import { resolveArchitectureInputSources } from "./command-architecture-inputs-sources.js";
import type { CommandArgs } from "./command-helpers.js";
import { getProfile, getRootPath, requireArchitectureConstraints } from "./command-helpers.js";
import type { ComputeArchitectureScoresOptions } from "./core/architecture-scoring-types.js";
import type { CommandContext } from "./core/contracts.js";

export async function buildArchitectureScoreOptions(
  args: CommandArgs,
  context: CommandContext,
  policyConfig: ComputeArchitectureScoresOptions["policyConfig"],
): Promise<ComputeArchitectureScoresOptions> {
  const repoPath = getRootPath(args, context);
  const constraints = await requireArchitectureConstraints(args, context);
  const {
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
  } = await loadArchitectureScoreInputs(args, context);
  const {
    contractBaselineSource,
    scenarioObservationSource,
    telemetrySource,
    deliverySource,
    complexitySource,
    additionalProvenance,
  } = await resolveArchitectureInputSources({
    args,
    context,
    scenarioObservations,
    scenarioObservationSourceConfig,
    contractBaseline,
    contractBaselineSourceConfig,
    deliveryObservations,
    deliveryRawObservations,
    deliveryExport,
    deliverySourceConfig,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetrySourceConfig,
    complexityExport,
    complexitySourceConfig,
  });

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
