import path from "node:path";

import type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ScenarioObservationSet,
} from "../core/contracts.js";

export interface SourceResolutionFinding {
  kind: "source_file_loaded" | "source_command_loaded";
  confidence: number;
  note: string;
  sourceType: "file" | "command";
  sourcePath?: string;
  command?: string;
  cwd?: string;
}

export interface ResolvedCanonicalSource<T> {
  data: T;
  configPath: string;
  sourceType: "file" | "command";
  resolvedPath?: string;
  command?: string;
  cwd?: string;
  note?: string;
  confidence: number;
  unknowns: string[];
  findings: SourceResolutionFinding[];
}

export function resolveFromBase(baseDir: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(baseDir, target);
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
