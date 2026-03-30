import type { CommandArgs } from "./command-path-helpers.js";
import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureComplexitySourceConfig,
  ArchitectureConstraints,
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
  DomainDesignShadowRolloutBatchSpec,
  DomainDesignShadowRolloutRegistry,
  DomainModel,
  ReviewResolutionLog,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
} from "./core/contracts.js";
import { readDataFile } from "./core/io.js";
import { loadArchitectureConstraints, loadDomainModel } from "./core/model.js";
import type { loadShadowRolloutRegistry } from "./core/shadow-rollout.js";

function resolveOptionalPathArg(args: CommandArgs, key: string, context: CommandContext): string | undefined {
  return typeof args[key] === "string" ? new URL(args[key], `file://${context.cwd}/`).pathname : undefined;
}

async function loadOptionalDataFile<T>(
  args: CommandArgs,
  key: string,
  context: CommandContext,
): Promise<T | undefined> {
  const filePath = resolveOptionalPathArg(args, key, context);
  if (!filePath) {
    return undefined;
  }
  return readDataFile<T>(filePath);
}

async function loadOptionalConfigFile<T>(
  args: CommandArgs,
  key: string,
  context: CommandContext,
): Promise<{ config: T; configPath: string } | undefined> {
  const configPath = resolveOptionalPathArg(args, key, context);
  if (!configPath) {
    return undefined;
  }
  const config = await readDataFile<T>(configPath);
  return { config, configPath };
}

export async function requireDomainModel(args: CommandArgs, context: CommandContext): Promise<DomainModel> {
  const modelPath = resolveOptionalPathArg(args, "model", context);
  if (!modelPath) {
    throw new Error("`--model` is required");
  }
  return loadDomainModel(modelPath);
}

export async function requireArchitectureConstraints(
  args: CommandArgs,
  context: CommandContext,
): Promise<ArchitectureConstraints> {
  const constraintsPath = resolveOptionalPathArg(args, "constraints", context);
  if (!constraintsPath) {
    throw new Error("`--constraints` is required");
  }
  return loadArchitectureConstraints(constraintsPath);
}

export async function requireShadowRolloutBatchSpec(
  args: CommandArgs,
  context: CommandContext,
): Promise<{ spec: DomainDesignShadowRolloutBatchSpec; specPath: string }> {
  const specPath = resolveOptionalPathArg(args, "batch-spec", context);
  if (!specPath) {
    throw new Error("`--batch-spec` is required");
  }
  const spec = await readDataFile<DomainDesignShadowRolloutBatchSpec>(specPath);
  if (!Array.isArray(spec.entries) || spec.entries.length === 0) {
    throw new Error("Shadow rollout batch spec must contain at least one entry");
  }
  return { spec, specPath };
}

export async function requireShadowRolloutRegistry(
  args: CommandArgs,
  context: CommandContext,
  loadRegistry: typeof loadShadowRolloutRegistry,
): Promise<{ registry: DomainDesignShadowRolloutRegistry; registryPath: string }> {
  const registryPath =
    resolveOptionalPathArg(args, "shadow-rollout-registry", context) ??
    resolveOptionalPathArg(args, "registry", context);
  if (!registryPath) {
    throw new Error("`--shadow-rollout-registry` or `--registry` is required unless `--batch-spec` is provided");
  }
  const registry = await loadRegistry(registryPath);
  return { registry, registryPath };
}

export function loadScenarioCatalogIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureScenarioCatalog>(args, "scenario-catalog", context);
}

export function loadScenarioObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ScenarioObservationSet>(args, "scenario-observations", context);
}

export function loadScenarioObservationSourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureScenarioObservationSourceConfig>(
    args,
    "scenario-observation-source",
    context,
  );
}

export function loadTopologyModelIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTopologyModel>(args, "topology-model", context);
}

export function loadBoundaryMapIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureBoundaryMap>(args, "boundary-map", context);
}

export function loadContractBaselineIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureContractBaseline>(args, "contract-baseline", context);
}

export function loadContractBaselineSourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureContractBaselineSourceConfig>(args, "contract-baseline-source", context);
}

export function loadRuntimeObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<TopologyRuntimeObservationSet>(args, "runtime-observations", context);
}

export function loadDeliveryObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureDeliveryObservationSet>(args, "delivery-observations", context);
}

export function loadDeliveryRawObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureDeliveryRawObservationSet>(args, "delivery-raw-observations", context);
}

export function loadDeliveryExportIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureDeliveryExportBundle>(args, "delivery-export", context);
}

export function loadDeliveryNormalizationProfileIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureDeliveryNormalizationProfile>(
    args,
    "delivery-normalization-profile",
    context,
  );
}

export function loadDeliverySourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureDeliverySourceConfig>(args, "delivery-source", context);
}

export function loadTelemetryObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTelemetryObservationSet>(args, "telemetry-observations", context);
}

export function loadTelemetryRawObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTelemetryRawObservationSet>(args, "telemetry-raw-observations", context);
}

export function loadTelemetryExportIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTelemetryExportBundle>(args, "telemetry-export", context);
}

export function loadTelemetryNormalizationProfileIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTelemetryNormalizationProfile>(
    args,
    "telemetry-normalization-profile",
    context,
  );
}

export function loadTelemetrySourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureTelemetrySourceConfig>(args, "telemetry-source", context);
}

export function loadPatternRuntimeObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitecturePatternRuntimeObservationSet>(args, "pattern-runtime-observations", context);
}

export function loadPatternRuntimeRawObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitecturePatternRuntimeRawObservationSet>(
    args,
    "pattern-runtime-raw-observations",
    context,
  );
}

export function loadPatternRuntimeNormalizationProfileIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitecturePatternRuntimeNormalizationProfile>(
    args,
    "pattern-runtime-normalization-profile",
    context,
  );
}

export function loadComplexityExportIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureComplexityExportBundle>(args, "complexity-export", context);
}

export function loadComplexitySourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureComplexitySourceConfig>(args, "complexity-source", context);
}

export function loadReviewLogIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ReviewResolutionLog>(args, "review-log", context);
}
