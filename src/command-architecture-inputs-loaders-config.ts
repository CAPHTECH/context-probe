import {
  loadComplexitySourceConfigIfRequested,
  loadContractBaselineSourceConfigIfRequested,
  loadDeliverySourceConfigIfRequested,
  loadScenarioObservationSourceConfigIfRequested,
  loadTelemetrySourceConfigIfRequested,
} from "./command-helpers.js";
import type {
  ArchitectureComplexitySourceConfig,
  ArchitectureContractBaselineSourceConfig,
  ArchitectureDeliverySourceConfig,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetrySourceConfig,
  CommandContext,
} from "./core/contracts.js";

export interface LoadedArchitectureInputSourceConfigs {
  scenarioObservationSourceConfig?:
    | { config: ArchitectureScenarioObservationSourceConfig; configPath: string }
    | undefined;
  contractBaselineSourceConfig?: { config: ArchitectureContractBaselineSourceConfig; configPath: string } | undefined;
  deliverySourceConfig?: { config: ArchitectureDeliverySourceConfig; configPath: string } | undefined;
  telemetrySourceConfig?: { config: ArchitectureTelemetrySourceConfig; configPath: string } | undefined;
  complexitySourceConfig?: { config: ArchitectureComplexitySourceConfig; configPath: string } | undefined;
}

export async function loadArchitectureInputSourceConfigs(
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<LoadedArchitectureInputSourceConfigs> {
  const [
    scenarioObservationSourceConfig,
    contractBaselineSourceConfig,
    deliverySourceConfig,
    telemetrySourceConfig,
    complexitySourceConfig,
  ] = await Promise.all([
    loadScenarioObservationSourceConfigIfRequested(args, context),
    loadContractBaselineSourceConfigIfRequested(args, context),
    loadDeliverySourceConfigIfRequested(args, context),
    loadTelemetrySourceConfigIfRequested(args, context),
    loadComplexitySourceConfigIfRequested(args, context),
  ]);

  return {
    scenarioObservationSourceConfig,
    contractBaselineSourceConfig,
    deliverySourceConfig,
    telemetrySourceConfig,
    complexitySourceConfig,
  };
}
