import type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetrySourceConfig,
  ScenarioObservationSet,
} from "../core/contracts.js";
import { resolveCommandSourceConfig } from "./architecture-source-loader-command.js";
import { resolveFileSourceConfig } from "./architecture-source-loader-file.js";
import type { ResolvedCanonicalSource } from "./architecture-source-loader-shared.js";

async function resolveSourceConfig<T>(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
  label: string;
}): Promise<ResolvedCanonicalSource<T>> {
  if (input.config.sourceType === "file") {
    return resolveFileSourceConfig<T>(input);
  }
  if (input.config.sourceType === "command") {
    return resolveCommandSourceConfig<T>(input);
  }
  throw new Error(`${input.label} sourceType=${String(input.config.sourceType)} is not supported.`);
}

export async function resolveTelemetrySourceConfig(input: {
  config: ArchitectureTelemetrySourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureTelemetryExportBundle>> {
  return resolveSourceConfig<ArchitectureTelemetryExportBundle>({
    ...input,
    label: "telemetry",
  });
}

export async function resolveDeliverySourceConfig(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureDeliveryExportBundle>> {
  return resolveSourceConfig<ArchitectureDeliveryExportBundle>({
    ...input,
    label: "delivery",
  });
}

export async function resolveComplexitySourceConfig(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureComplexityExportBundle>> {
  return resolveSourceConfig<ArchitectureComplexityExportBundle>({
    ...input,
    label: "complexity",
  });
}

export async function resolveScenarioObservationSourceConfig(input: {
  config: ArchitectureScenarioObservationSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ScenarioObservationSet>> {
  return resolveSourceConfig<ScenarioObservationSet>({
    ...input,
    label: "scenario observation",
  });
}

export async function resolveContractBaselineSourceConfig(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureContractBaseline>> {
  return resolveSourceConfig<ArchitectureContractBaseline>({
    ...input,
    label: "contract baseline",
  });
}
