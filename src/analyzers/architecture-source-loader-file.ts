import type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ScenarioObservationSet,
} from "../core/contracts.js";
import { readDataFile } from "../core/io.js";
import { type ResolvedCanonicalSource, resolveFromBase } from "./architecture-source-loader-shared.js";

export async function resolveFileSourceConfig<T>(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
  label: string;
}): Promise<ResolvedCanonicalSource<T>> {
  const baseDir = input.configPath.slice(0, input.configPath.lastIndexOf("/")) || ".";
  if (!input.config.path) {
    throw new Error(`${input.label} source config requires 'path' when sourceType=file.`);
  }
  const resolvedPath = resolveFromBase(baseDir, input.config.path);
  const data = await readDataFile<T>(resolvedPath);
  return {
    data,
    configPath: input.configPath,
    sourceType: "file",
    resolvedPath,
    ...(input.config.note ? { note: input.config.note } : {}),
    confidence: 0.86,
    unknowns: [],
    findings: [
      {
        kind: "source_file_loaded",
        confidence: 0.86,
        note: `Loaded canonical input from the file source in ${input.label} source config.`,
        sourceType: "file",
        sourcePath: resolvedPath,
      },
    ],
  };
}

export type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ScenarioObservationSet,
};
