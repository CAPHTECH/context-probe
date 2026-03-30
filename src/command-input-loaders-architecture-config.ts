import { loadOptionalConfigFile } from "./command-input-loaders-core.js";
import type { CommandArgs } from "./command-path-helpers.js";
import type {
  ArchitectureComplexitySourceConfig,
  ArchitectureContractBaselineSourceConfig,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliverySourceConfig,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetrySourceConfig,
  CommandContext,
} from "./core/contracts.js";

export function loadScenarioObservationSourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureScenarioObservationSourceConfig>(
    args,
    "scenario-observation-source",
    context,
  );
}

export function loadContractBaselineSourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureContractBaselineSourceConfig>(args, "contract-baseline-source", context);
}

export function loadDeliveryNormalizationProfileIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureDeliveryNormalizationProfile>(
    args,
    "delivery-normalization-profile",
    context,
  );
}

export function loadDeliverySourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureDeliverySourceConfig>(args, "delivery-source", context);
}

export function loadTelemetryNormalizationProfileIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureTelemetryNormalizationProfile>(
    args,
    "telemetry-normalization-profile",
    context,
  );
}

export function loadTelemetrySourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureTelemetrySourceConfig>(args, "telemetry-source", context);
}

export function loadPatternRuntimeNormalizationProfileIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitecturePatternRuntimeNormalizationProfile>(
    args,
    "pattern-runtime-normalization-profile",
    context,
  );
}

export function loadComplexitySourceConfigIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalConfigFile<ArchitectureComplexitySourceConfig>(args, "complexity-source", context);
}
