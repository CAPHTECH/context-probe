import path from "node:path";

import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureComplexitySourceConfig,
  ArchitectureConstraints,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryRawObservationSet,
  ArchitectureDeliverySourceConfig,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTelemetrySourceConfig,
  ArchitectureTopologyModel,
  CommandContext,
  DomainDesignShadowRolloutBatchSpec,
  DomainDesignShadowRolloutRegistry,
  DomainModel,
  ExtractionBackend,
  ExtractionProviderName,
  ReviewResolutionLog,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet
} from "./core/contracts.js";
import { readDataFile } from "./core/io.js";
import { loadArchitectureConstraints, loadDomainModel } from "./core/model.js";
import type { loadShadowRolloutRegistry } from "./core/shadow-rollout.js";
import {
  resolveComplexitySourceConfig,
  resolveDeliverySourceConfig,
  resolveScenarioObservationSourceConfig,
  resolveTelemetrySourceConfig
} from "./analyzers/architecture-source-loader.js";

export type CommandArgs = Record<string, string | boolean>;

export async function requireDomainModel(args: CommandArgs, context: CommandContext): Promise<DomainModel> {
  const modelPath = typeof args.model === "string" ? args.model : undefined;
  if (!modelPath) {
    throw new Error("`--model` is required");
  }
  return loadDomainModel(new URL(modelPath, `file://${context.cwd}/`).pathname);
}

export async function requireArchitectureConstraints(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureConstraints> {
  const constraintsPath = typeof args.constraints === "string" ? args.constraints : undefined;
  if (!constraintsPath) {
    throw new Error("`--constraints` is required");
  }
  return loadArchitectureConstraints(new URL(constraintsPath, `file://${context.cwd}/`).pathname);
}

export async function requireShadowRolloutBatchSpec(
  args: CommandArgs,
  context: CommandContext
): Promise<{ spec: DomainDesignShadowRolloutBatchSpec; specPath: string }> {
  const specPath = typeof args["batch-spec"] === "string" ? new URL(args["batch-spec"], `file://${context.cwd}/`).pathname : undefined;
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
  loadRegistry: typeof loadShadowRolloutRegistry
): Promise<{ registry: DomainDesignShadowRolloutRegistry; registryPath: string }> {
  const registryPath =
    typeof args["shadow-rollout-registry"] === "string"
      ? new URL(args["shadow-rollout-registry"], `file://${context.cwd}/`).pathname
      : typeof args.registry === "string"
        ? new URL(args.registry, `file://${context.cwd}/`).pathname
        : undefined;
  if (!registryPath) {
    throw new Error("`--shadow-rollout-registry` or `--registry` is required unless `--batch-spec` is provided");
  }
  const registry = await loadRegistry(registryPath);
  return { registry, registryPath };
}

export function resolveSpecRelativePath(baseDirectory: string, input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(baseDirectory, input);
}

export function parseTieTolerance(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

export async function loadScenarioCatalogIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureScenarioCatalog | undefined> {
  const scenarioCatalogPath =
    typeof args["scenario-catalog"] === "string"
      ? new URL(args["scenario-catalog"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!scenarioCatalogPath) {
    return undefined;
  }
  return readDataFile<ArchitectureScenarioCatalog>(scenarioCatalogPath);
}

export async function loadScenarioObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ScenarioObservationSet | undefined> {
  const observationsPath =
    typeof args["scenario-observations"] === "string"
      ? new URL(args["scenario-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!observationsPath) {
    return undefined;
  }
  return readDataFile<ScenarioObservationSet>(observationsPath);
}

export async function loadScenarioObservationSourceConfigIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<{ config: ArchitectureScenarioObservationSourceConfig; configPath: string } | undefined> {
  const configPath =
    typeof args["scenario-observation-source"] === "string"
      ? new URL(args["scenario-observation-source"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!configPath) {
    return undefined;
  }
  const config = await readDataFile<ArchitectureScenarioObservationSourceConfig>(configPath);
  return { config, configPath };
}

export async function loadTopologyModelIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureTopologyModel | undefined> {
  const topologyPath =
    typeof args["topology-model"] === "string"
      ? new URL(args["topology-model"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!topologyPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTopologyModel>(topologyPath);
}

export async function loadBoundaryMapIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureBoundaryMap | undefined> {
  const boundaryMapPath =
    typeof args["boundary-map"] === "string" ? new URL(args["boundary-map"], `file://${context.cwd}/`).pathname : undefined;
  if (!boundaryMapPath) {
    return undefined;
  }
  return readDataFile<ArchitectureBoundaryMap>(boundaryMapPath);
}

export async function loadRuntimeObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<TopologyRuntimeObservationSet | undefined> {
  const runtimePath =
    typeof args["runtime-observations"] === "string"
      ? new URL(args["runtime-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!runtimePath) {
    return undefined;
  }
  return readDataFile<TopologyRuntimeObservationSet>(runtimePath);
}

export async function loadDeliveryObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureDeliveryObservationSet | undefined> {
  const deliveryPath =
    typeof args["delivery-observations"] === "string"
      ? new URL(args["delivery-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!deliveryPath) {
    return undefined;
  }
  return readDataFile<ArchitectureDeliveryObservationSet>(deliveryPath);
}

export async function loadDeliveryRawObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureDeliveryRawObservationSet | undefined> {
  const deliveryRawPath =
    typeof args["delivery-raw-observations"] === "string"
      ? new URL(args["delivery-raw-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!deliveryRawPath) {
    return undefined;
  }
  return readDataFile<ArchitectureDeliveryRawObservationSet>(deliveryRawPath);
}

export async function loadDeliveryExportIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureDeliveryExportBundle | undefined> {
  const deliveryExportPath =
    typeof args["delivery-export"] === "string"
      ? new URL(args["delivery-export"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!deliveryExportPath) {
    return undefined;
  }
  return readDataFile<ArchitectureDeliveryExportBundle>(deliveryExportPath);
}

export async function loadDeliveryNormalizationProfileIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureDeliveryNormalizationProfile | undefined> {
  const normalizationPath =
    typeof args["delivery-normalization-profile"] === "string"
      ? new URL(args["delivery-normalization-profile"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!normalizationPath) {
    return undefined;
  }
  return readDataFile<ArchitectureDeliveryNormalizationProfile>(normalizationPath);
}

export async function loadDeliverySourceConfigIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<{ config: ArchitectureDeliverySourceConfig; configPath: string } | undefined> {
  const configPath =
    typeof args["delivery-source"] === "string"
      ? new URL(args["delivery-source"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!configPath) {
    return undefined;
  }
  const config = await readDataFile<ArchitectureDeliverySourceConfig>(configPath);
  return { config, configPath };
}

export async function loadTelemetryObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureTelemetryObservationSet | undefined> {
  const telemetryPath =
    typeof args["telemetry-observations"] === "string"
      ? new URL(args["telemetry-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!telemetryPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTelemetryObservationSet>(telemetryPath);
}

export async function loadTelemetryRawObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureTelemetryRawObservationSet | undefined> {
  const telemetryRawPath =
    typeof args["telemetry-raw-observations"] === "string"
      ? new URL(args["telemetry-raw-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!telemetryRawPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTelemetryRawObservationSet>(telemetryRawPath);
}

export async function loadTelemetryExportIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureTelemetryExportBundle | undefined> {
  const telemetryExportPath =
    typeof args["telemetry-export"] === "string"
      ? new URL(args["telemetry-export"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!telemetryExportPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTelemetryExportBundle>(telemetryExportPath);
}

export async function loadTelemetryNormalizationProfileIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureTelemetryNormalizationProfile | undefined> {
  const normalizationPath =
    typeof args["telemetry-normalization-profile"] === "string"
      ? new URL(args["telemetry-normalization-profile"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!normalizationPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTelemetryNormalizationProfile>(normalizationPath);
}

export async function loadTelemetrySourceConfigIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<{ config: ArchitectureTelemetrySourceConfig; configPath: string } | undefined> {
  const configPath =
    typeof args["telemetry-source"] === "string"
      ? new URL(args["telemetry-source"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!configPath) {
    return undefined;
  }
  const config = await readDataFile<ArchitectureTelemetrySourceConfig>(configPath);
  return { config, configPath };
}

export async function loadPatternRuntimeObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitecturePatternRuntimeObservationSet | undefined> {
  const runtimePath =
    typeof args["pattern-runtime-observations"] === "string"
      ? new URL(args["pattern-runtime-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!runtimePath) {
    return undefined;
  }
  return readDataFile<ArchitecturePatternRuntimeObservationSet>(runtimePath);
}

export async function loadPatternRuntimeRawObservationsIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitecturePatternRuntimeRawObservationSet | undefined> {
  const runtimeRawPath =
    typeof args["pattern-runtime-raw-observations"] === "string"
      ? new URL(args["pattern-runtime-raw-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!runtimeRawPath) {
    return undefined;
  }
  return readDataFile<ArchitecturePatternRuntimeRawObservationSet>(runtimeRawPath);
}

export async function loadPatternRuntimeNormalizationProfileIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitecturePatternRuntimeNormalizationProfile | undefined> {
  const normalizationPath =
    typeof args["pattern-runtime-normalization-profile"] === "string"
      ? new URL(args["pattern-runtime-normalization-profile"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!normalizationPath) {
    return undefined;
  }
  return readDataFile<ArchitecturePatternRuntimeNormalizationProfile>(normalizationPath);
}

export async function loadComplexityExportIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ArchitectureComplexityExportBundle | undefined> {
  const complexityExportPath =
    typeof args["complexity-export"] === "string"
      ? new URL(args["complexity-export"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!complexityExportPath) {
    return undefined;
  }
  return readDataFile<ArchitectureComplexityExportBundle>(complexityExportPath);
}

export async function loadComplexitySourceConfigIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<{ config: ArchitectureComplexitySourceConfig; configPath: string } | undefined> {
  const configPath =
    typeof args["complexity-source"] === "string"
      ? new URL(args["complexity-source"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!configPath) {
    return undefined;
  }
  const config = await readDataFile<ArchitectureComplexitySourceConfig>(configPath);
  return { config, configPath };
}

export function getRootPath(args: CommandArgs, context: CommandContext): string {
  return typeof args.repo === "string" ? new URL(args.repo, `file://${context.cwd}/`).pathname : context.cwd;
}

export function getDocsRoot(args: CommandArgs, context: CommandContext): string {
  return typeof args["docs-root"] === "string"
    ? new URL(args["docs-root"], `file://${context.cwd}/`).pathname
    : context.cwd;
}

export function getProfile(args: CommandArgs): string {
  return typeof args.profile === "string" ? args.profile : "default";
}

export function getExtractor(args: CommandArgs): ExtractionBackend {
  return args.extractor === "cli" ? "cli" : "heuristic";
}

export function getProvider(args: CommandArgs): ExtractionProviderName | undefined {
  if (args.provider === "codex" || args.provider === "claude") {
    return args.provider;
  }
  return undefined;
}

export function getPromptProfile(args: CommandArgs): string {
  return typeof args["prompt-profile"] === "string" ? args["prompt-profile"] : "default";
}

export function getFallback(args: CommandArgs): "heuristic" | "none" {
  return args.fallback === "none" ? "none" : "heuristic";
}

export async function loadReviewLogIfRequested(
  args: CommandArgs,
  context: CommandContext
): Promise<ReviewResolutionLog | undefined> {
  const reviewLogPath =
    typeof args["review-log"] === "string"
      ? new URL(args["review-log"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!reviewLogPath) {
    return undefined;
  }
  return readDataFile<ReviewResolutionLog>(reviewLogPath);
}

export async function buildExtractionOptions(args: CommandArgs, context: CommandContext) {
  const provider = getProvider(args);
  const providerCommand = typeof args["provider-cmd"] === "string" ? args["provider-cmd"] : undefined;
  const reviewLog = await loadReviewLogIfRequested(args, context);
  return {
    root: getDocsRoot(args, context),
    cwd: context.cwd,
    extractor: getExtractor(args),
    ...(provider ? { provider } : {}),
    ...(providerCommand ? { providerCommand } : {}),
    promptProfile: getPromptProfile(args),
    fallback: getFallback(args),
    ...(reviewLog ? { reviewLog } : {}),
    applyReviewLog: args["apply-review-log"] === true
  } as const;
}

export async function resolveOptionalScenarioSource(args: CommandArgs, context: CommandContext) {
  const sourceConfig = await loadScenarioObservationSourceConfigIfRequested(args, context);
  return sourceConfig ? resolveScenarioObservationSourceConfig(sourceConfig) : undefined;
}

export async function resolveOptionalTelemetrySource(args: CommandArgs, context: CommandContext) {
  const sourceConfig = await loadTelemetrySourceConfigIfRequested(args, context);
  return sourceConfig ? resolveTelemetrySourceConfig(sourceConfig) : undefined;
}

export async function resolveOptionalDeliverySource(args: CommandArgs, context: CommandContext) {
  const sourceConfig = await loadDeliverySourceConfigIfRequested(args, context);
  return sourceConfig ? resolveDeliverySourceConfig(sourceConfig) : undefined;
}

export async function resolveOptionalComplexitySource(args: CommandArgs, context: CommandContext) {
  const sourceConfig = await loadComplexitySourceConfigIfRequested(args, context);
  return sourceConfig ? resolveComplexitySourceConfig(sourceConfig) : undefined;
}
